import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_TOKEN } from '../../../../../common/tokens';
import { numberTable, paymentTable, tandaTable } from '../../../../../database/tandea.schema';
import type {
  CoberturaNumeroMuerto,
  CoberturaRepositoryPort,
  PagoCubierto,
} from '../../../../domain/ports/out/cobertura-repository.port';
import type { PeriodicidadTanda } from '../../../../domain/services/calcular-plan';
import type { NumeroStatus } from '../../../../domain/entities/numero-tanda.entity';
import type { TandaParaCobertura } from '../../../../domain/services/evaluar-turno';

@Injectable()
export class DrizzleCoberturaRepository implements CoberturaRepositoryPort {
  constructor(
    @Inject(DATABASE_TOKEN)
    private readonly db: NodePgDatabase,
  ) {}

  async listarTandasActivas(): Promise<TandaParaCobertura[]> {
    const tandas = await this.db
      .select({
        idTanda: tandaTable.idTanda,
        nombre: tandaTable.name,
        idAdmin: tandaTable.idAdmin,
        startDate: tandaTable.startDate,
        periodicidad: tandaTable.periodicity,
        montoCuota: tandaTable.contributionAmount,
        numParticipantes: tandaTable.numParticipants,
        numVueltas: tandaTable.numRounds,
        tieneNumeroMuerto: tandaTable.hasDeadNumber,
        diasGracia: tandaTable.graceDays,
      })
      .from(tandaTable)
      .where(
        and(
          eq(tandaTable.status, 'ACTIVA'),
          eq(tandaTable.active, true),
          isNull(tandaTable.deletedAt),
        ),
      );

    if (tandas.length === 0) return [];

    const numeros = await this.db
      .select({
        idTanda: numberTable.idTanda,
        idNumber: numberTable.idNumber,
        numero: numberTable.numberValue,
        idUser: numberTable.idUser,
        isDeadNumber: numberTable.isDeadNumber,
        status: numberTable.status,
        // Columnas escritas completas: en un select de una sola tabla Drizzle no las califica y
        // el exists compararía el pago consigo mismo (siempre verdadero)
        tienePagoActivo: sql<boolean>`exists (
          select 1 from "payment" as p
          where p."id_number" = "number"."id_number"
            and p."status" in ('PENDIENTE', 'CONFIRMADO')
        )`,
      })
      .from(numberTable)
      .where(
        and(
          inArray(numberTable.idTanda, tandas.map((t) => t.idTanda)),
          isNull(numberTable.deletedAt),
        ),
      );

    return tandas.map((t) => {
      const deLaTanda = numeros.filter((n) => n.idTanda === t.idTanda);
      return {
        ...t,
        periodicidad: t.periodicidad as PeriodicidadTanda,
        montoCuota: Number(t.montoCuota),
        idNumeroMuerto: deLaTanda.find((n) => n.isDeadNumber)?.idNumber ?? null,
        numeros: deLaTanda
          .filter((n) => !n.isDeadNumber && n.idUser !== null)
          .map((n) => ({
            idNumber: n.idNumber,
            numero: n.numero,
            idUser: n.idUser!,
            status: n.status as NumeroStatus,
            tienePagoActivo: Boolean(n.tienePagoActivo),
          })),
      };
    });
  }

  async cubrirConNumeroMuerto(datos: CoberturaNumeroMuerto): Promise<PagoCubierto[]> {
    if (datos.idNumbers.length === 0) return [];
    const cuota = datos.montoCuota.toFixed(2);

    return this.db.transaction(async (tx) => {
      // Bloquea las filas para que dos corridas simultáneas no cubran el mismo número
      await tx
        .select({ idNumber: numberTable.idNumber })
        .from(numberTable)
        .where(inArray(numberTable.idNumber, datos.idNumbers))
        .for('update');

      const cubiertos: PagoCubierto[] = [];
      for (const idNumber of datos.idNumbers) {
        const [yaPago] = await tx
          .select({ idPayment: paymentTable.idPayment })
          .from(paymentTable)
          .where(
            and(
              eq(paymentTable.idNumber, idNumber),
              inArray(paymentTable.status, ['PENDIENTE', 'CONFIRMADO']),
            ),
          )
          .limit(1);
        if (yaPago) continue;

        // Cobertura del sistema: sin montos en efectivo/transferencia ni confirmación del participante
        const [pago] = await tx
          .insert(paymentTable)
          .values({
            idNumber,
            idDeadNumber: datos.idNumeroMuerto,
            transferAmount: '0',
            cashAmount: '0',
            totalAmount: cuota,
            confirmedByParticipant: false,
            confirmedByAdmin: true,
            status: 'CONFIRMADO',
          })
          .returning({ idPayment: paymentTable.idPayment });
        cubiertos.push({ idPayment: pago.idPayment, idNumber });
      }
      return cubiertos;
    });
  }

  async marcarEnRiesgo(idNumber: number): Promise<boolean> {
    const filas = await this.db
      .update(numberTable)
      .set({ status: 'EN_RIESGO' })
      .where(and(eq(numberTable.idNumber, idNumber), eq(numberTable.status, 'PENDIENTE')))
      .returning({ idNumber: numberTable.idNumber });
    return filas.length > 0;
  }

  async quitarRiesgo(idNumbers: number[]): Promise<void> {
    if (idNumbers.length === 0) return;
    await this.db
      .update(numberTable)
      .set({ status: 'PENDIENTE' })
      .where(and(inArray(numberTable.idNumber, idNumbers), eq(numberTable.status, 'EN_RIESGO')));
  }
}

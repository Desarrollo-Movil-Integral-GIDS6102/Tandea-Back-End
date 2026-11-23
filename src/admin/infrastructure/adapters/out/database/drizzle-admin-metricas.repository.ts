import { Inject, Injectable } from '@nestjs/common';
import { and, count, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_TOKEN } from '../../../../../common/tokens';
import {
  disputeTable,
  paymentTable,
  roleTable,
  tandaTable,
  userTable,
} from '../../../../../database/tandea.schema';
import type {
  AdminMetricasRepositoryPort,
  ConteoTandas,
  ConteoUsuarios,
  MontoMensual,
} from '../../../../domain/ports/out/admin-metricas-repository.port';

/** Nombre del rol de los participantes: el administrador no cuenta como usuario de la plataforma. */
const ROL_USUARIO = 'usuario';

@Injectable()
export class DrizzleAdminMetricasRepository implements AdminMetricasRepositoryPort {
  constructor(
    @Inject(DATABASE_TOKEN)
    private readonly db: NodePgDatabase,
  ) {}

  async contarUsuarios(): Promise<ConteoUsuarios> {
    const [fila] = await this.db
      .select({
        total: count(),
        activos: sql<number>`count(*) filter (where ${userTable.active})`.mapWith(Number),
      })
      .from(userTable)
      .innerJoin(roleTable, eq(roleTable.idRole, userTable.idRole))
      .where(and(eq(roleTable.nameRole, ROL_USUARIO), isNull(userTable.deletedAt)));

    const total = fila?.total ?? 0;
    const activos = fila?.activos ?? 0;
    return { total, activos, suspendidos: total - activos };
  }

  async contarTandas(): Promise<ConteoTandas> {
    const filas = await this.db
      .select({ status: tandaTable.status, total: count() })
      .from(tandaTable)
      .where(isNull(tandaTable.deletedAt))
      .groupBy(tandaTable.status);

    const porEstado = new Map(filas.map((f) => [f.status, f.total]));
    const conteo = {
      pendientes: porEstado.get('PENDIENTE') ?? 0,
      activas: porEstado.get('ACTIVA') ?? 0,
      finalizadas: porEstado.get('FINALIZADA') ?? 0,
      suspendidas: porEstado.get('SUSPENDIDA') ?? 0,
      canceladas: porEstado.get('CANCELADA') ?? 0,
    };
    return { total: Object.values(conteo).reduce((a, b) => a + b, 0), ...conteo };
  }

  async sumarMontoGestionado(): Promise<number> {
    const [fila] = await this.db
      .select({ monto: sql<string>`coalesce(sum(${paymentTable.totalAmount}), 0)` })
      .from(paymentTable)
      .where(eq(paymentTable.status, 'CONFIRMADO'));
    return Number(fila?.monto ?? 0);
  }

  async contarDisputasPendientes(): Promise<number> {
    const [fila] = await this.db
      .select({ total: count() })
      .from(disputeTable)
      .where(inArray(disputeTable.status, ['ABIERTA', 'EN_REVISION']));
    return fila?.total ?? 0;
  }

  async sumarMontoPorMes(desde: string): Promise<MontoMensual[]> {
    // El mes se corta en hora de la Ciudad de México, igual que el resto de fechas del negocio
    const mes = sql<string>`to_char(${paymentTable.createdAt} at time zone 'America/Mexico_City', 'YYYY-MM')`;
    const filas = await this.db
      .select({
        mes,
        monto: sql<string>`sum(${paymentTable.totalAmount})`,
        pagos: count(),
      })
      .from(paymentTable)
      .where(
        and(
          eq(paymentTable.status, 'CONFIRMADO'),
          gte(paymentTable.createdAt, sql`(${desde}::date)::timestamp at time zone 'America/Mexico_City'`),
        ),
      )
      .groupBy(mes)
      .orderBy(mes);

    return filas.map((f) => ({ mes: f.mes, monto: Number(f.monto), pagos: f.pagos }));
  }
}

import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  COBERTURA_REPOSITORY_PORT,
  type CoberturaRepositoryPort,
} from '../../domain/ports/out/cobertura-repository.port';
import { TURNO_EVENTS_PORT, type TurnoEventsPort } from '../../domain/ports/out/turno-events.port';
import {
  planificarTurno,
  type NumeroParaCobertura,
  type TandaParaCobertura,
} from '../../domain/services/evaluar-turno';

export const ZONA_HORARIA_TURNOS = 'America/Mexico_City';

export interface ResultadoCobertura {
  enRiesgo: number;
  regularizados: number;
  /** Pagos que el número muerto cubrió. */
  cubiertos: number;
}

/**
 * CoberturaTurnosService — Revisión diaria de los turnos que ya salieron de la gracia (AP-10).
 *
 * Para cada tanda ACTIVA mira el turno vencido y, si faltan pagos y no hay número muerto que
 * los cubra, marca el turno del beneficiario EN_RIESGO y avisa con `turno.en_riesgo`. Si los
 * pagos se regularizan, el turno vuelve a PENDIENTE. Es idempotente: correrlo dos veces el
 * mismo día no repite avisos.
 */
@Injectable()
export class CoberturaTurnosService {
  private readonly logger = new Logger(CoberturaTurnosService.name);

  constructor(
    @Inject(COBERTURA_REPOSITORY_PORT)
    private readonly repositorio: CoberturaRepositoryPort,
    @Inject(TURNO_EVENTS_PORT)
    private readonly eventos: TurnoEventsPort,
  ) {}

  async revisarTurnosVencidos(ahora: Date = new Date()): Promise<ResultadoCobertura> {
    const hoy = ahora.toLocaleDateString('en-CA', { timeZone: ZONA_HORARIA_TURNOS });
    const resultado: ResultadoCobertura = { enRiesgo: 0, regularizados: 0, cubiertos: 0 };

    for (const tanda of await this.repositorio.listarTandasActivas()) {
      try {
        await this.revisarTanda(tanda, hoy, resultado);
      } catch (error: unknown) {
        // Una tanda con datos inválidos no debe detener la revisión de las demás
        this.logger.warn(
          `No se pudo revisar el turno vencido de la tanda ${tanda.idTanda}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    this.logger.log(
      `Turnos vencidos (${hoy}): ${resultado.cubiertos} pagos cubiertos por el número muerto, ${resultado.enRiesgo} en riesgo, ${resultado.regularizados} regularizados.`,
    );
    return resultado;
  }

  /** El número muerto paga la cuota de quienes no pagaron, todo en una transacción (AP-10). */
  private async cubrirConNumeroMuerto(
    tanda: TandaParaCobertura,
    faltantes: NumeroParaCobertura[],
    numeroDelTurno: number,
    resultado: ResultadoCobertura,
  ): Promise<void> {
    const pagos = await this.repositorio.cubrirConNumeroMuerto({
      idNumeroMuerto: tanda.idNumeroMuerto!,
      montoCuota: tanda.montoCuota,
      idNumbers: faltantes.map((f) => f.idNumber),
    });
    if (pagos.length === 0) return;
    resultado.cubiertos += pagos.length;

    const porNumero = new Map(faltantes.map((f) => [f.idNumber, f]));
    try {
      await this.eventos.publicarNumeroMuertoUsado({
        idTanda: tanda.idTanda,
        nombreTanda: tanda.nombre,
        idNumeroMuerto: tanda.idNumeroMuerto!,
        idOrganizador: tanda.idAdmin,
        numeroDelTurno,
        // En centavos para no arrastrar errores de punto flotante
        montoCubierto: (Math.round(tanda.montoCuota * 100) * pagos.length) / 100,
        cubiertos: pagos.map((p) => ({
          idPayment: p.idPayment,
          idNumber: p.idNumber,
          numero: porNumero.get(p.idNumber)!.numero,
          idUser: porNumero.get(p.idNumber)!.idUser,
        })),
      });
    } catch (error: unknown) {
      // Los pagos de cobertura ya quedaron guardados; un fallo del bus no debe deshacerlos
      this.logger.error(
        `No se pudo publicar numero_muerto.usado de la tanda ${tanda.idTanda}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async revisarTanda(
    tanda: TandaParaCobertura,
    hoy: string,
    resultado: ResultadoCobertura,
  ): Promise<void> {
    const plan = planificarTurno(tanda, hoy);

    if (plan.aRegularizar.length > 0) {
      await this.repositorio.quitarRiesgo(plan.aRegularizar.map((n) => n.idNumber));
      resultado.regularizados += plan.aRegularizar.length;
    }

    if (!plan.beneficiario || !plan.turno) return;

    if (plan.decision === 'CUBRIR_CON_NUMERO_MUERTO' && tanda.idNumeroMuerto !== null) {
      await this.cubrirConNumeroMuerto(tanda, plan.faltantes, plan.turno.numero, resultado);
      return;
    }
    if (plan.decision !== 'EN_RIESGO') return;

    // Solo avisa la primera vez: si ya estaba EN_RIESGO no cambia nada
    if (!(await this.repositorio.marcarEnRiesgo(plan.beneficiario.idNumber))) return;
    resultado.enRiesgo++;

    try {
      await this.eventos.publicarTurnoEnRiesgo({
        idTanda: tanda.idTanda,
        nombreTanda: tanda.nombre,
        idNumber: plan.beneficiario.idNumber,
        numero: plan.beneficiario.numero,
        idOrganizador: tanda.idAdmin,
        idBeneficiario: plan.beneficiario.idUser,
        pagosFaltantes: plan.faltantes.length,
        // En centavos para no arrastrar errores de punto flotante
        montoFaltante: (Math.round(tanda.montoCuota * 100) * plan.faltantes.length) / 100,
      });
    } catch (error: unknown) {
      // El estado ya quedó guardado; un fallo del bus no debe deshacerlo
      this.logger.error(
        `No se pudo publicar turno.en_riesgo del número ${plan.beneficiario.idNumber}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

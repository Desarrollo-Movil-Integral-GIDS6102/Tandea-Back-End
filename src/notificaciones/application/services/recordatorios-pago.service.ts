import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  NOTIFICACION_REPOSITORY_PORT,
  TIPO_NOTIFICACION,
  type NotificacionRepositoryPort,
} from '../../domain/ports/out/notificacion-repository.port';
import {
  seleccionarRecordatorios,
  type RecordatorioPago,
} from '../../domain/services/recordatorios-pago';
import { NotificacionesService } from './notificaciones.service';

export const ZONA_HORARIA = 'America/Mexico_City';
const DIAS_ANTES_POR_DEFECTO = 1;

export interface ResultadoRecordatorios {
  enviados: number;
  omitidosPorDuplicado: number;
}

/**
 * RecordatoriosPagoService — Recordatorio antes de la fecha límite (AP-08).
 *
 * Lo dispara el cron diario. Para cada tanda ACTIVA calcula el turno en cobro
 * con `generarCalendario` y avisa a quien no ha pagado cuando faltan
 * `RECORDATORIO_DIAS_ANTES` días (1 por defecto) para la fecha límite
 * (fechaCobro + días de gracia). No repite el aviso si ya se mandó hoy.
 */
@Injectable()
export class RecordatoriosPagoService {
  private readonly logger = new Logger(RecordatoriosPagoService.name);

  constructor(
    @Inject(NOTIFICACION_REPOSITORY_PORT)
    private readonly repositorio: NotificacionRepositoryPort,
    private readonly notificaciones: NotificacionesService,
  ) {}

  async enviarRecordatorios(
    ahora: Date = new Date(),
    diasAntes: number = diasAntesConfigurados(),
  ): Promise<ResultadoRecordatorios> {
    const hoy = fechaLocal(ahora);
    const inicioDelDia = inicioDelDiaLocal(hoy);
    const resultado: ResultadoRecordatorios = { enviados: 0, omitidosPorDuplicado: 0 };

    const tandas = await this.repositorio.listarTandasParaRecordatorio();
    for (const tanda of tandas) {
      let recordatorios: RecordatorioPago[];
      try {
        recordatorios = seleccionarRecordatorios(tanda, hoy, diasAntes);
      } catch (error: unknown) {
        // Una tanda con datos inválidos no debe detener los avisos de las demás
        this.logger.warn(
          `No se pudo calcular el calendario de la tanda ${tanda.idTanda}: ${error instanceof Error ? error.message : String(error)}`,
        );
        continue;
      }

      for (const r of recordatorios) {
        const yaAvisado = await this.repositorio.existeNotificacionDesde(
          r.idUser,
          r.idTanda,
          TIPO_NOTIFICACION.RECORDATORIO_PAGO,
          inicioDelDia,
        );
        if (yaAvisado) {
          resultado.omitidosPorDuplicado++;
          continue;
        }

        await this.notificaciones.notificar({
          idUser: r.idUser,
          idTanda: r.idTanda,
          type: TIPO_NOTIFICACION.RECORDATORIO_PAGO,
          titulo: 'Recuerda tu pago',
          mensaje: mensajeRecordatorio(r),
          route: `/tandas/detalle/${r.idTanda}`,
        });
        resultado.enviados++;
      }
    }

    this.logger.log(
      `Recordatorios de pago (${hoy}): ${resultado.enviados} enviados, ${resultado.omitidosPorDuplicado} ya avisados hoy.`,
    );
    return resultado;
  }
}

export function mensajeRecordatorio(r: RecordatorioPago): string {
  const monto = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(r.monto);
  const numeros =
    r.numeros.length === 1 ? `del número ${r.numeros[0]}` : `de los números ${r.numeros.join(', ')}`;
  const [anio, mes, dia] = r.fechaLimite.split('-');
  const cuando =
    r.diasRestantes === 0 ? 'hoy' : r.diasRestantes === 1 ? 'mañana' : `en ${r.diasRestantes} días`;
  return `Tu pago de ${monto} ${numeros} en la tanda "${r.nombreTanda}" vence ${cuando} (${dia}/${mes}/${anio}).`;
}

function diasAntesConfigurados(): number {
  const valor = Number(process.env.RECORDATORIO_DIAS_ANTES);
  return Number.isInteger(valor) && valor >= 0 ? valor : DIAS_ANTES_POR_DEFECTO;
}

/** Fecha YYYY-MM-DD en la Ciudad de México, igual que la regla del turno #0 en pagos. */
function fechaLocal(fecha: Date): string {
  return fecha.toLocaleDateString('en-CA', { timeZone: ZONA_HORARIA });
}

/** CDMX está fija en UTC-6 (sin horario de verano desde 2022). */
function inicioDelDiaLocal(hoy: string): Date {
  return new Date(`${hoy}T00:00:00.000-06:00`);
}

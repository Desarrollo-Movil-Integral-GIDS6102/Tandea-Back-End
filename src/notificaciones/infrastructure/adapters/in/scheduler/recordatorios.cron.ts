import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  RecordatoriosPagoService,
  ZONA_HORARIA,
} from '../../../../application/services/recordatorios-pago.service';

/**
 * Adaptador de entrada: tarea programada diaria de notificaciones.
 *
 * Corre a las 9:00 de la Ciudad de México: recordatorio antes de la fecha
 * límite (AP-08), pago vencido y turno de cobro del día siguiente.
 */
@Injectable()
export class RecordatoriosCron {
  private readonly logger = new Logger(RecordatoriosCron.name);

  constructor(private readonly recordatorios: RecordatoriosPagoService) {}

  @Cron('0 9 * * *', { name: 'notificaciones-diarias', timeZone: ZONA_HORARIA })
  async ejecutarDiario(): Promise<void> {
    // Cada aviso por separado: si uno falla, el otro se manda igual
    try {
      await this.recordatorios.enviarRecordatorios();
    } catch (error: unknown) {
      this.logger.error(
        `Falló el envío de recordatorios de pago: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    try {
      await this.recordatorios.enviarAvisosDeTurno();
    } catch (error: unknown) {
      this.logger.error(
        `Falló el envío de avisos de pago vencido / cobro próximo: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

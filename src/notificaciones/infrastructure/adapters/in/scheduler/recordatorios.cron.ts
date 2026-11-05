import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  RecordatoriosPagoService,
  ZONA_HORARIA,
} from '../../../../application/services/recordatorios-pago.service';

/**
 * Adaptador de entrada: tarea programada diaria de notificaciones.
 *
 * Corre a las 9:00 de la Ciudad de México. Aquí se agregan los demás avisos
 * del mismo cron (pago vencido, turno de cobro próximo).
 */
@Injectable()
export class RecordatoriosCron {
  private readonly logger = new Logger(RecordatoriosCron.name);

  constructor(private readonly recordatorios: RecordatoriosPagoService) {}

  @Cron('0 9 * * *', { name: 'notificaciones-diarias', timeZone: ZONA_HORARIA })
  async ejecutarDiario(): Promise<void> {
    try {
      await this.recordatorios.enviarRecordatorios();
    } catch (error: unknown) {
      this.logger.error(
        `Falló el envío de recordatorios de pago: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

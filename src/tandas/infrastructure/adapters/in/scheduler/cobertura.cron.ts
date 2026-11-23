import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  CoberturaTurnosService,
  ZONA_HORARIA_TURNOS,
} from '../../../../application/services/cobertura-turnos.service';

/**
 * Adaptador de entrada: revisión diaria de los turnos vencidos (AP-10).
 *
 * Corre a las 9:05 de la Ciudad de México, justo después de los avisos de las 9:00
 * (pago vencido), cuando ya salió de la gracia el turno que se estaba cobrando.
 */
@Injectable()
export class CoberturaCron {
  private readonly logger = new Logger(CoberturaCron.name);

  constructor(private readonly cobertura: CoberturaTurnosService) {}

  @Cron('5 9 * * *', { name: 'cobertura-turnos', timeZone: ZONA_HORARIA_TURNOS })
  async ejecutarDiario(): Promise<void> {
    try {
      await this.cobertura.revisarTurnosVencidos();
    } catch (error: unknown) {
      this.logger.error(
        `Falló la revisión de turnos vencidos: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

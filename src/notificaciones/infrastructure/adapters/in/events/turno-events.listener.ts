import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  NUMERO_MUERTO_USADO,
  TURNO_EN_RIESGO,
  type NumeroMuertoUsadoEvent,
  type TurnoEnRiesgoEvent,
} from '../../../../../tandas/domain/ports/out/turno-events.port';
import { NotificacionesService } from '../../../../application/services/notificaciones.service';

/**
 * Adaptador de entrada: escucha los eventos internos de los turnos.
 * Nunca deja escapar un error: el estado del turno ya quedó guardado.
 */
@Injectable()
export class TurnoEventsListener {
  private readonly logger = new Logger(TurnoEventsListener.name);

  constructor(private readonly notificaciones: NotificacionesService) {}

  @OnEvent(TURNO_EN_RIESGO, { async: true })
  async onTurnoEnRiesgo(evento: TurnoEnRiesgoEvent): Promise<void> {
    try {
      await this.notificaciones.alTurnoEnRiesgo(evento);
    } catch (error: unknown) {
      this.logger.error(
        `Falló el manejo de ${TURNO_EN_RIESGO} del número ${evento.idNumber}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  @OnEvent(NUMERO_MUERTO_USADO, { async: true })
  async onNumeroMuertoUsado(evento: NumeroMuertoUsadoEvent): Promise<void> {
    try {
      await this.notificaciones.alUsarseNumeroMuerto(evento);
    } catch (error: unknown) {
      this.logger.error(
        `Falló el manejo de ${NUMERO_MUERTO_USADO} de la tanda ${evento.idTanda}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

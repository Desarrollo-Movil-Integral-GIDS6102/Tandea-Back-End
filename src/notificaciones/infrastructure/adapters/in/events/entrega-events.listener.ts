import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ENTREGA_REGISTRADA,
  type EntregaRegistradaEvent,
} from '../../../../../entregas/domain/ports/out/entrega-events.port';
import { NotificacionesService } from '../../../../application/services/notificaciones.service';

/**
 * Adaptador de entrada: escucha los eventos internos de Entregas.
 * Nunca deja escapar un error: la entrega ya quedó guardada.
 */
@Injectable()
export class EntregaEventsListener {
  private readonly logger = new Logger(EntregaEventsListener.name);

  constructor(private readonly notificaciones: NotificacionesService) {}

  @OnEvent(ENTREGA_REGISTRADA, { async: true })
  async onEntregaRegistrada(evento: EntregaRegistradaEvent): Promise<void> {
    try {
      await this.notificaciones.alRegistrarEntrega(evento);
    } catch (error: unknown) {
      this.logger.error(
        `Falló el manejo de ${ENTREGA_REGISTRADA} del payout ${evento.idPayout}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

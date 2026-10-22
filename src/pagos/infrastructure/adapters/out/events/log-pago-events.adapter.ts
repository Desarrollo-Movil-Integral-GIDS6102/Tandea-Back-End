import { Injectable, Logger } from '@nestjs/common';
import {
  PAGO_REGISTRADO,
  PagoEventsPort,
  PagoRegistradoEvent,
} from '../../../../domain/ports/out/pago-events.port';

/**
 * Adaptador temporal de eventos: solo deja el evento en el log.
 *
 * TODO([BE-NOTIF] Emitir y escuchar eventos internos (pago.registrado, pago.confirmado)):
 * reemplazar por un adaptador sobre el bus de eventos que defina esa tarjeta.
 */
@Injectable()
export class LogPagoEventsAdapter implements PagoEventsPort {
  private readonly logger = new Logger(LogPagoEventsAdapter.name);

  async publicarPagoRegistrado(evento: PagoRegistradoEvent): Promise<void> {
    this.logger.log(`${PAGO_REGISTRADO} ${JSON.stringify(evento)}`);
  }
}

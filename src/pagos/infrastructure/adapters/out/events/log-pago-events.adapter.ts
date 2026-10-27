import { Injectable, Logger } from '@nestjs/common';
import {
  PAGO_CONFIRMADO,
  PAGO_RECHAZADO,
  PAGO_REGISTRADO,
  PagoConfirmadoEvent,
  PagoEventsPort,
  PagoRechazadoEvent,
  PagoRegistradoEvent,
} from '../../../../domain/ports/out/pago-events.port';

/**
 * Adaptador de eventos basado en Logger.
 *
 * Publica eventos del ciclo de vida de pagos sin acoplar el dominio a infraestructura concreta.
 */
@Injectable()
export class LogPagoEventsAdapter implements PagoEventsPort {
  private readonly logger = new Logger(LogPagoEventsAdapter.name);

  async publicarPagoRegistrado(evento: PagoRegistradoEvent): Promise<void> {
    this.logger.log(`${PAGO_REGISTRADO} ${JSON.stringify(evento)}`);
  }

  async publicarPagoConfirmado(evento: PagoConfirmadoEvent): Promise<void> {
    this.logger.log(`${PAGO_CONFIRMADO} ${JSON.stringify(evento)}`);
  }

  async publicarPagoRechazado(evento: PagoRechazadoEvent): Promise<void> {
    this.logger.log(`${PAGO_RECHAZADO} ${JSON.stringify(evento)}`);
  }
}

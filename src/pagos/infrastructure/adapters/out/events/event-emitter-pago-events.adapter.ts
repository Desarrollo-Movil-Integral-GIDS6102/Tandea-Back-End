import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
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
 * Adaptador de eventos de Pagos sobre el bus interno de NestJS (EventEmitter2).
 *
 * Pagos solo emite; quien escucha (p. ej. NotificacionModule) se suscribe con
 * @OnEvent sin que este módulo lo conozca. Los listeners corren de forma
 * asíncrona, así que la respuesta HTTP no espera a que se envíen notificaciones.
 */
@Injectable()
export class EventEmitterPagoEventsAdapter implements PagoEventsPort {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  async publicarPagoRegistrado(evento: PagoRegistradoEvent): Promise<void> {
    this.eventEmitter.emit(PAGO_REGISTRADO, evento);
  }

  async publicarPagoConfirmado(evento: PagoConfirmadoEvent): Promise<void> {
    this.eventEmitter.emit(PAGO_CONFIRMADO, evento);
  }

  async publicarPagoRechazado(evento: PagoRechazadoEvent): Promise<void> {
    this.eventEmitter.emit(PAGO_RECHAZADO, evento);
  }
}

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ENTREGA_REGISTRADA,
  type EntregaEventsPort,
  type EntregaRegistradaEvent,
} from '../../../../domain/ports/out/entrega-events.port';

/**
 * Adaptador de eventos de Entregas sobre el bus interno de NestJS (EventEmitter2).
 * Entregas solo emite; NotificacionModule escucha con @OnEvent.
 */
@Injectable()
export class EventEmitterEntregaEventsAdapter implements EntregaEventsPort {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  async publicarEntregaRegistrada(evento: EntregaRegistradaEvent): Promise<void> {
    this.eventEmitter.emit(ENTREGA_REGISTRADA, evento);
  }
}

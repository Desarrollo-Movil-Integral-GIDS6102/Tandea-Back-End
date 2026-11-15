import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  NUMERO_MUERTO_USADO,
  TURNO_EN_RIESGO,
  type NumeroMuertoUsadoEvent,
  type TurnoEnRiesgoEvent,
  type TurnoEventsPort,
} from '../../../../domain/ports/out/turno-events.port';

/**
 * Adaptador de eventos de los turnos sobre el bus interno de NestJS (EventEmitter2).
 * Solo emite; quien escucha (NotificacionModule) se suscribe con @OnEvent.
 */
@Injectable()
export class EventEmitterTurnoEventsAdapter implements TurnoEventsPort {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  async publicarTurnoEnRiesgo(evento: TurnoEnRiesgoEvent): Promise<void> {
    this.eventEmitter.emit(TURNO_EN_RIESGO, evento);
  }

  async publicarNumeroMuertoUsado(evento: NumeroMuertoUsadoEvent): Promise<void> {
    this.eventEmitter.emit(NUMERO_MUERTO_USADO, evento);
  }
}

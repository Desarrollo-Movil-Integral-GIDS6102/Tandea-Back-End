import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ADMIN_EVENTS_PORT,
  type AdminEventsPort,
  DISPUTA_RESUELTA_EVENT,
  type DisputaResueltaEvent,
  USUARIO_SUSPENDIDO_EVENT,
  type UsuarioSuspendidoEvent,
} from '../../../../domain/ports/out/admin-events.port';

export { ADMIN_EVENTS_PORT };

/**
 * Adaptador de eventos de Administración Global sobre el bus interno de NestJS (EventEmitter2).
 *
 * Los casos de uso de Admin emiten `usuario.suspendido` y `disputa.resuelta` tras persistir
 * los cambios y el registro en `audit_log`. Los listeners corren de forma asíncrona para que
 * la respuesta HTTP o la transacción principal no dependan del envío de correo electrónico.
 */
@Injectable()
export class EventEmitterAdminEventsAdapter implements AdminEventsPort {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  async publicarUsuarioSuspendido(evento: UsuarioSuspendidoEvent): Promise<void> {
    this.eventEmitter.emit(USUARIO_SUSPENDIDO_EVENT, evento);
  }

  async publicarDisputaResuelta(evento: DisputaResueltaEvent): Promise<void> {
    this.eventEmitter.emit(DISPUTA_RESUELTA_EVENT, evento);
  }
}

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';

// Application
import { NotificacionesService } from './application/services/notificaciones.service';

// Inbound Adapters (eventos internos)
import { PagoEventsListener } from './infrastructure/adapters/in/events/pago-events.listener';

// Outbound Adapters
import { DrizzleNotificacionRepository } from './infrastructure/adapters/out/database/drizzle-notificacion.repository';
import { LogNotificacionAdapter } from './infrastructure/adapters/out/push/log-notificacion.adapter';

// Domain Ports
import { NOTIFICACION_REPOSITORY_PORT } from './domain/ports/out/notificacion-repository.port';
import { NOTIFICACION_PORT } from './domain/ports/out/notificacion.port';

/**
 * NotificacionModule — Escucha los eventos internos y avisa a los usuarios.
 *
 * Ningún otro módulo importa a este: Pagos (y después Tandas/Entregas) solo
 * emiten eventos por EventEmitter2 y este módulo se suscribe con @OnEvent.
 *
 * Mapeo de Puertos y Adaptadores:
 *  - Entrada: eventos pago.* ➔ PagoEventsListener ➔ NotificacionesService
 *  - Salida: NOTIFICACION_REPOSITORY_PORT ➔ DrizzleNotificacionRepository
 *  - Salida: NOTIFICACION_PORT ➔ LogNotificacionAdapter (cambiar a NotificacionFcmAdapter en INT-NOTIF)
 */
@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: NOTIFICACION_REPOSITORY_PORT,
      useClass: DrizzleNotificacionRepository,
    },
    {
      provide: NOTIFICACION_PORT,
      useClass: LogNotificacionAdapter,
    },
    NotificacionesService,
    PagoEventsListener,
  ],
  exports: [NotificacionesService],
})
export class NotificacionModule {}

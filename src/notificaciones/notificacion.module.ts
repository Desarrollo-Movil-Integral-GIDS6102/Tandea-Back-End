import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';

// Application
import { NotificacionesService } from './application/services/notificaciones.service';
import { RecordatoriosPagoService } from './application/services/recordatorios-pago.service';

// Inbound Adapters (eventos internos y tareas programadas)
import { PagoEventsListener } from './infrastructure/adapters/in/events/pago-events.listener';
import { RecordatoriosCron } from './infrastructure/adapters/in/scheduler/recordatorios.cron';

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
 *  - Entrada: cron diario 9:00 CDMX ➔ RecordatoriosCron ➔ RecordatoriosPagoService (AP-08)
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
    RecordatoriosPagoService,
    PagoEventsListener,
    RecordatoriosCron,
  ],
  exports: [NotificacionesService, RecordatoriosPagoService],
})
export class NotificacionModule {}

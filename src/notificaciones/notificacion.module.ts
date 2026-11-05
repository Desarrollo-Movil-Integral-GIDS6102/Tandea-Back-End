import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';

// Application
import { NotificacionesService } from './application/services/notificaciones.service';
import { RecordatoriosPagoService } from './application/services/recordatorios-pago.service';
import { FcmTokenService } from './application/services/fcm-token.service';

// Inbound Adapters (HTTP, eventos internos y tareas programadas)
import { UsersFcmController } from './infrastructure/adapters/in/http/controllers/users-fcm.controller';
import { PagoEventsListener } from './infrastructure/adapters/in/events/pago-events.listener';
import { RecordatoriosCron } from './infrastructure/adapters/in/scheduler/recordatorios.cron';

// Outbound Adapters
import { DrizzleNotificacionRepository } from './infrastructure/adapters/out/database/drizzle-notificacion.repository';
import { DrizzleFcmTokenRepository } from './infrastructure/adapters/out/database/drizzle-fcm-token.repository';
import { NotificacionFcmAdapter } from './infrastructure/adapters/out/push/notificacion-fcm.adapter';

// Domain Ports
import { NOTIFICACION_REPOSITORY_PORT } from './domain/ports/out/notificacion-repository.port';
import { NOTIFICACION_PORT } from './domain/ports/out/notificacion.port';
import { FCM_TOKEN_REPOSITORY_PORT } from './domain/ports/out/fcm-token-repository.port';
import { FCM_TOKEN_USE_CASE_PORT } from './domain/ports/in/fcm-token-use-case.port';

/**
 * NotificacionModule — Escucha los eventos internos y avisa a los usuarios.
 *
 * Mapeo de Puertos y Adaptadores:
 *  - Entrada HTTP: PATCH /users/me/fcm-token ➔ UsersFcmController ➔ FcmTokenService
 *  - Entrada: eventos pago.* ➔ PagoEventsListener ➔ NotificacionesService
 *  - Entrada: cron diario 9:00 CDMX ➔ RecordatoriosCron ➔ RecordatoriosPagoService (AP-08)
 *  - Salida: NOTIFICACION_REPOSITORY_PORT ➔ DrizzleNotificacionRepository
 *  - Salida: FCM_TOKEN_REPOSITORY_PORT ➔ DrizzleFcmTokenRepository
 *  - Salida: NOTIFICACION_PORT ➔ NotificacionFcmAdapter (INT-NOTIF)
 */
@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [UsersFcmController],
  providers: [
    {
      provide: NOTIFICACION_REPOSITORY_PORT,
      useClass: DrizzleNotificacionRepository,
    },
    {
      provide: FCM_TOKEN_REPOSITORY_PORT,
      useClass: DrizzleFcmTokenRepository,
    },
    {
      provide: NOTIFICACION_PORT,
      useClass: NotificacionFcmAdapter,
    },
    {
      provide: FCM_TOKEN_USE_CASE_PORT,
      useClass: FcmTokenService,
    },
    NotificacionesService,
    RecordatoriosPagoService,
    FcmTokenService,
    NotificacionFcmAdapter,
    DrizzleFcmTokenRepository,
    PagoEventsListener,
    RecordatoriosCron,
  ],
  exports: [
    NotificacionesService,
    RecordatoriosPagoService,
    NOTIFICACION_PORT,
    FCM_TOKEN_REPOSITORY_PORT,
    FCM_TOKEN_USE_CASE_PORT,
  ],
})
export class NotificacionModule {}

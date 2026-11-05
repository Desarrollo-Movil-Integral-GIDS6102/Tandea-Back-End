import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { PagoModule } from './pagos/pago.module';
import { AuthModule } from './auth/auth.module';
import { TandaModule } from './tandas/tanda.module';
import { EntregaModule } from './entregas/entrega.module';
import { NotificacionModule } from './notificaciones/notificacion.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

/**
 * AppModule — Módulo raíz del Monolito Modular.
 *
 * Convención: cada módulo de negocio se registra aquí.
 * Futuros módulos: ParticipanteModule, etc.
 *
 * EventEmitterModule es el bus de eventos internos: los módulos de negocio solo
 * emiten (pago.registrado, pago.confirmado…) y NotificacionModule los escucha,
 * así ningún módulo importa a notificaciones. ScheduleModule habilita las
 * tareas programadas (@Cron), como los recordatorios diarios de pago.
 */
@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    PagoModule,
    TandaModule,
    EntregaModule,
    NotificacionModule,
    // ParticipanteModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

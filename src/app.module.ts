import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { PagoModule } from './pagos/pago.module';
import { AuthModule } from './auth/auth.module';

/**
 * AppModule — Módulo raíz del Monolito Modular.
 *
 * Convención: cada módulo de negocio se registra aquí.
 * Futuros módulos: TandaModule, ParticipanteModule, NotificacionModule, etc.
 */
@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    PagoModule,
    // TandaModule,
    // ParticipanteModule,
    // NotificacionModule,
  ],
})
export class AppModule {}

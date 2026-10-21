import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { PagoModule } from './pagos/pago.module';
import { AuthModule } from './auth/auth.module';
import { TandaModule } from './tandas/tanda.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

/**
 * AppModule — Módulo raíz del Monolito Modular.
 *
 * Convención: cada módulo de negocio se registra aquí.
 * Futuros módulos: ParticipanteModule, NotificacionModule, etc.
 */
@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    PagoModule,
    TandaModule,
    // ParticipanteModule,
    // NotificacionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

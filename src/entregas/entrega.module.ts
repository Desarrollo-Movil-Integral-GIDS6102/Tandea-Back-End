import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { PagoModule } from '../pagos/pago.module';
import { EntregaController } from './infrastructure/adapters/in/http/entrega.controller';
import { EntregaService } from './application/services/entrega.service';
import { DrizzleEntregaRepository } from './infrastructure/adapters/out/database/drizzle-entrega.repository';
import { ENTREGA_REPOSITORY_PORT } from './domain/ports/out/entrega-repository.port';
import { ENTREGA_USE_CASES_PORT } from './domain/ports/in/entrega-use-cases.port';

@Module({
  imports: [DatabaseModule, AuthModule, PagoModule],
  controllers: [EntregaController],
  providers: [
    { provide: ENTREGA_REPOSITORY_PORT, useClass: DrizzleEntregaRepository },
    { provide: ENTREGA_USE_CASES_PORT, useClass: EntregaService },
  ],
})
export class EntregaModule {}

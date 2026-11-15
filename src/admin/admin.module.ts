import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { AdminController } from './infrastructure/adapters/in/http/admin.controller';
import { AdminMetricasService } from './application/services/admin-metricas.service';
import { DrizzleAdminMetricasRepository } from './infrastructure/adapters/out/database/drizzle-admin-metricas.repository';
import { ADMIN_METRICAS_USE_CASE_PORT } from './domain/ports/in/admin-metricas-use-case.port';
import { ADMIN_METRICAS_REPOSITORY_PORT } from './domain/ports/out/admin-metricas-repository.port';

/**
 * AdminModule — Herramientas del Administrador Global.
 *
 *  - Entrada HTTP: GET /admin/metricas ➔ AdminController ➔ AdminMetricasService
 *  - Salida: ADMIN_METRICAS_REPOSITORY_PORT ➔ DrizzleAdminMetricasRepository
 */
@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [AdminController],
  providers: [
    { provide: ADMIN_METRICAS_USE_CASE_PORT, useClass: AdminMetricasService },
    { provide: ADMIN_METRICAS_REPOSITORY_PORT, useClass: DrizzleAdminMetricasRepository },
  ],
})
export class AdminModule {}

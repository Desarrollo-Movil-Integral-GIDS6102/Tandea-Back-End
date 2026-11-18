import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { AdminController } from './infrastructure/adapters/in/http/admin.controller';
import { AdminMetricasService } from './application/services/admin-metricas.service';
import { AdminUsuariosService } from './application/services/admin-usuarios.service';
import { DrizzleAdminMetricasRepository } from './infrastructure/adapters/out/database/drizzle-admin-metricas.repository';
import { DrizzleAdminUsuariosRepository } from './infrastructure/adapters/out/database/drizzle-admin-usuarios.repository';
import { ADMIN_METRICAS_USE_CASE_PORT } from './domain/ports/in/admin-metricas-use-case.port';
import { ADMIN_METRICAS_REPOSITORY_PORT } from './domain/ports/out/admin-metricas-repository.port';
import { ADMIN_USUARIOS_USE_CASE_PORT } from './domain/ports/in/admin-usuarios-use-case.port';
import { ADMIN_USUARIOS_REPOSITORY_PORT } from './domain/ports/out/admin-usuarios-repository.port';

/**
 * AdminModule — Herramientas del Administrador Global.
 *
 *  - Entrada HTTP:
 *      GET /admin/metricas ➔ AdminController ➔ AdminMetricasService
 *      GET /admin/usuarios, PATCH /admin/usuarios/:id/suspender ➔ AdminController ➔ AdminUsuariosService
 *  - Salida:
 *      ADMIN_METRICAS_REPOSITORY_PORT ➔ DrizzleAdminMetricasRepository
 *      ADMIN_USUARIOS_REPOSITORY_PORT ➔ DrizzleAdminUsuariosRepository
 */
@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [AdminController],
  providers: [
    { provide: ADMIN_METRICAS_USE_CASE_PORT, useClass: AdminMetricasService },
    { provide: ADMIN_METRICAS_REPOSITORY_PORT, useClass: DrizzleAdminMetricasRepository },
    { provide: ADMIN_USUARIOS_USE_CASE_PORT, useClass: AdminUsuariosService },
    { provide: ADMIN_USUARIOS_REPOSITORY_PORT, useClass: DrizzleAdminUsuariosRepository },
  ],
})
export class AdminModule {}

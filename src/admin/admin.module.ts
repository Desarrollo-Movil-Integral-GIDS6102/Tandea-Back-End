import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { AdminController } from './infrastructure/adapters/in/http/admin.controller';
import { DisputasController } from './infrastructure/adapters/in/http/disputas.controller';
import { AdminMetricasService } from './application/services/admin-metricas.service';
import { AdminUsuariosService } from './application/services/admin-usuarios.service';
import { AdminDisputasService } from './application/services/admin-disputas.service';
import { AdminConfigService } from './application/services/admin-config.service';
import { DrizzleAdminMetricasRepository } from './infrastructure/adapters/out/database/drizzle-admin-metricas.repository';
import { DrizzleAdminUsuariosRepository } from './infrastructure/adapters/out/database/drizzle-admin-usuarios.repository';
import { DrizzleAdminDisputasRepository } from './infrastructure/adapters/out/database/drizzle-admin-disputas.repository';
import { DrizzleAdminConfigRepository } from './infrastructure/adapters/out/database/drizzle-admin-config.repository';

import { ADMIN_METRICAS_USE_CASE_PORT } from './domain/ports/in/admin-metricas-use-case.port';
import { ADMIN_METRICAS_REPOSITORY_PORT } from './domain/ports/out/admin-metricas-repository.port';
import { ADMIN_USUARIOS_USE_CASE_PORT } from './domain/ports/in/admin-usuarios-use-case.port';
import { ADMIN_USUARIOS_REPOSITORY_PORT } from './domain/ports/out/admin-usuarios-repository.port';
import { ADMIN_DISPUTAS_USE_CASE_PORT } from './domain/ports/in/admin-disputas-use-case.port';
import { ADMIN_DISPUTAS_REPOSITORY_PORT } from './domain/ports/out/admin-disputas-repository.port';
import { ADMIN_CONFIG_USE_CASE_PORT } from './domain/ports/in/admin-config-use-case.port';
import { ADMIN_CONFIG_REPOSITORY_PORT } from './domain/ports/out/admin-config-repository.port';


/**
 * AdminModule — Herramientas del Administrador Global y gestión de disputas.
 *
 *  - Entrada HTTP:
 *      GET /admin/metricas ➔ AdminController ➔ AdminMetricasService
 *      GET /admin/usuarios, PATCH /admin/usuarios/:id/suspender ➔ AdminController ➔ AdminUsuariosService
 *      POST /disputas ➔ DisputasController ➔ AdminDisputasService
 *      GET /admin/disputas, GET /admin/disputas/:id, PATCH /admin/disputas/:id/resolver ➔ AdminController ➔ AdminDisputasService
 *      GET /admin/config, PUT /admin/config ➔ AdminController ➔ AdminConfigService

 *  - Salida:
 *      ADMIN_METRICAS_REPOSITORY_PORT ➔ DrizzleAdminMetricasRepository
 *      ADMIN_USUARIOS_REPOSITORY_PORT ➔ DrizzleAdminUsuariosRepository
 *      ADMIN_DISPUTAS_REPOSITORY_PORT ➔ DrizzleAdminDisputasRepository
 *      ADMIN_CONFIG_REPOSITORY_PORT ➔ DrizzleAdminConfigRepository

 */
@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [AdminController, DisputasController],
  providers: [
    { provide: ADMIN_METRICAS_USE_CASE_PORT, useClass: AdminMetricasService },
    { provide: ADMIN_METRICAS_REPOSITORY_PORT, useClass: DrizzleAdminMetricasRepository },
    { provide: ADMIN_USUARIOS_USE_CASE_PORT, useClass: AdminUsuariosService },
    { provide: ADMIN_USUARIOS_REPOSITORY_PORT, useClass: DrizzleAdminUsuariosRepository },
    { provide: ADMIN_DISPUTAS_USE_CASE_PORT, useClass: AdminDisputasService },
    { provide: ADMIN_DISPUTAS_REPOSITORY_PORT, useClass: DrizzleAdminDisputasRepository },
    { provide: ADMIN_CONFIG_USE_CASE_PORT, useClass: AdminConfigService },
    { provide: ADMIN_CONFIG_REPOSITORY_PORT, useClass: DrizzleAdminConfigRepository },

  ],
})
export class AdminModule {}

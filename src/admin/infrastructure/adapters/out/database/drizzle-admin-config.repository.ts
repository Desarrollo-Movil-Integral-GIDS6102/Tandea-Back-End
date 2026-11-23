import { Inject, Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_TOKEN } from '../../../../../common/tokens';
import {
  auditLogTable,
  platformConfigTable,
} from '../../../../../database/tandea.schema';
import type {
  ActualizarConfiguracionCommand,
  ConfiguracionPlataforma,
} from '../../../../domain/ports/in/admin-config-use-case.port';
import type { AdminConfigRepositoryPort } from '../../../../domain/ports/out/admin-config-repository.port';

export const ACCION_CONFIG_ACTUALIZADA = 'CONFIG_ACTUALIZADA';

@Injectable()
export class DrizzleAdminConfigRepository implements AdminConfigRepositoryPort {
  constructor(
    @Inject(DATABASE_TOKEN)
    private readonly db: NodePgDatabase,
  ) {}

  async obtenerConfiguracion(): Promise<ConfiguracionPlataforma | null> {
    const [fila] = await this.db
      .select({
        idConfig: platformConfigTable.idConfig,
        maxUsersPerTanda: platformConfigTable.maxUsersPerTanda,
        maxActiveTandasPerUser: platformConfigTable.maxActiveTandasPerUser,
        maxGraceDays: platformConfigTable.maxGraceDays,
        idUpdatedBy: platformConfigTable.idUpdatedBy,
        updatedAt: platformConfigTable.updatedAt,
      })
      .from(platformConfigTable)
      .orderBy(asc(platformConfigTable.idConfig))
      .limit(1);

    return fila ?? null;
  }

  async guardarConfiguracion(
    comando: ActualizarConfiguracionCommand,
  ): Promise<ConfiguracionPlataforma> {
    return this.db.transaction(async (tx) => {
      const ahora = new Date();
      const [existente] = await tx
        .select({ idConfig: platformConfigTable.idConfig })
        .from(platformConfigTable)
        .orderBy(asc(platformConfigTable.idConfig))
        .limit(1);

      let guardada: ConfiguracionPlataforma;

      if (existente) {
        const [actualizada] = await tx
          .update(platformConfigTable)
          .set({
            maxUsersPerTanda: comando.maxUsersPerTanda,
            maxActiveTandasPerUser: comando.maxActiveTandasPerUser,
            maxGraceDays: comando.maxGraceDays,
            idUpdatedBy: comando.idUpdatedBy,
            updatedAt: ahora,
          })
          .where(eq(platformConfigTable.idConfig, existente.idConfig))
          .returning({
            idConfig: platformConfigTable.idConfig,
            maxUsersPerTanda: platformConfigTable.maxUsersPerTanda,
            maxActiveTandasPerUser: platformConfigTable.maxActiveTandasPerUser,
            maxGraceDays: platformConfigTable.maxGraceDays,
            idUpdatedBy: platformConfigTable.idUpdatedBy,
            updatedAt: platformConfigTable.updatedAt,
          });
        guardada = actualizada;
      } else {
        const [insertada] = await tx
          .insert(platformConfigTable)
          .values({
            maxUsersPerTanda: comando.maxUsersPerTanda,
            maxActiveTandasPerUser: comando.maxActiveTandasPerUser,
            maxGraceDays: comando.maxGraceDays,
            idUpdatedBy: comando.idUpdatedBy,
            updatedAt: ahora,
          })
          .returning({
            idConfig: platformConfigTable.idConfig,
            maxUsersPerTanda: platformConfigTable.maxUsersPerTanda,
            maxActiveTandasPerUser: platformConfigTable.maxActiveTandasPerUser,
            maxGraceDays: platformConfigTable.maxGraceDays,
            idUpdatedBy: platformConfigTable.idUpdatedBy,
            updatedAt: platformConfigTable.updatedAt,
          });
        guardada = insertada;
      }

      await tx.insert(auditLogTable).values({
        idUser: comando.idUpdatedBy,
        actionType: ACCION_CONFIG_ACTUALIZADA,
        entityType: 'platform_config',
        entityId: guardada.idConfig,
        description: `Configuración global actualizada: maxUsersPerTanda=${comando.maxUsersPerTanda}, maxActiveTandasPerUser=${comando.maxActiveTandasPerUser}, maxGraceDays=${comando.maxGraceDays}`,
      });

      return guardada;
    });
  }
}

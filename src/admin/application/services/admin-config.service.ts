import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type {
  ActualizarConfiguracionCommand,
  AdminConfigUseCasePort,
  ConfiguracionPlataforma,
} from '../../domain/ports/in/admin-config-use-case.port';
import {
  ADMIN_CONFIG_REPOSITORY_PORT,
  type AdminConfigRepositoryPort,
} from '../../domain/ports/out/admin-config-repository.port';

export const CONFIG_POR_DEFECTO = {
  idConfig: 1,
  maxUsersPerTanda: 20,
  maxActiveTandasPerUser: 5,
  maxGraceDays: 3,
} as const;

/**
 * [SP-4 BE-ADMIN] Lectura y actualización de parámetros globales de la plataforma
 * (`platform_config`: máximo de usuarios por tanda, tandas activas por usuario y días de gracia).
 * Guarda siempre `id_updated_by` con el Administrador Global que realizó el cambio.
 */
@Injectable()
export class AdminConfigService implements AdminConfigUseCasePort {
  constructor(
    @Inject(ADMIN_CONFIG_REPOSITORY_PORT)
    private readonly repositorio: AdminConfigRepositoryPort,
  ) {}

  async obtenerConfiguracion(): Promise<ConfiguracionPlataforma> {
    const config = await this.repositorio.obtenerConfiguracion();
    if (config) {
      return config;
    }

    return {
      ...CONFIG_POR_DEFECTO,
      idUpdatedBy: null,
      updatedAt: new Date(),
    };
  }

  async actualizarConfiguracion(
    comando: ActualizarConfiguracionCommand,
  ): Promise<ConfiguracionPlataforma> {
    if (!Number.isInteger(comando.maxUsersPerTanda) || comando.maxUsersPerTanda < 3) {
      throw new BadRequestException(
        'El máximo de participantes por tanda debe ser un entero mayor o igual a 3',
      );
    }
    if (!Number.isInteger(comando.maxActiveTandasPerUser) || comando.maxActiveTandasPerUser < 1) {
      throw new BadRequestException(
        'El máximo de tandas activas por usuario debe ser un entero mayor o igual a 1',
      );
    }
    if (!Number.isInteger(comando.maxGraceDays) || comando.maxGraceDays < 0) {
      throw new BadRequestException(
        'El máximo de días de gracia debe ser un entero mayor o igual a 0',
      );
    }

    return this.repositorio.guardarConfiguracion(comando);
  }
}

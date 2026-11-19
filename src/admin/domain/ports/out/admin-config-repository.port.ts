import type {
  ActualizarConfiguracionCommand,
  ConfiguracionPlataforma,
} from '../in/admin-config-use-case.port';

export const ADMIN_CONFIG_REPOSITORY_PORT = Symbol('ADMIN_CONFIG_REPOSITORY_PORT');

export interface AdminConfigRepositoryPort {
  obtenerConfiguracion(): Promise<ConfiguracionPlataforma | null>;
  guardarConfiguracion(
    comando: ActualizarConfiguracionCommand,
  ): Promise<ConfiguracionPlataforma>;
}

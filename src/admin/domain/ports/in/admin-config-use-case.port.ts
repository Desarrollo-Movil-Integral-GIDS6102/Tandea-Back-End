export const ADMIN_CONFIG_USE_CASE_PORT = Symbol('ADMIN_CONFIG_USE_CASE_PORT');

export interface ConfiguracionPlataforma {
  idConfig: number;
  maxUsersPerTanda: number;
  maxActiveTandasPerUser: number;
  maxGraceDays: number;
  idUpdatedBy: number | null;
  updatedAt: Date;
}

export interface ActualizarConfiguracionCommand {
  maxUsersPerTanda: number;
  maxActiveTandasPerUser: number;
  maxGraceDays: number;
  idUpdatedBy: number;
}

export interface AdminConfigUseCasePort {
  obtenerConfiguracion(): Promise<ConfiguracionPlataforma>;
  actualizarConfiguracion(
    comando: ActualizarConfiguracionCommand,
  ): Promise<ConfiguracionPlataforma>;
}

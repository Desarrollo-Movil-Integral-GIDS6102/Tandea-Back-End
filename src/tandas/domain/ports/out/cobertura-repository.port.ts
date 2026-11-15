import type { TandaParaCobertura } from '../../services/evaluar-turno';

export const COBERTURA_REPOSITORY_PORT = Symbol('COBERTURA_REPOSITORY_PORT');

/**
 * Puerto de salida: lo que necesita la revisión diaria de los turnos vencidos (AP-10).
 */
export interface CoberturaRepositoryPort {
  /** Tandas ACTIVAS con sus números reales y si cada uno ya tiene un pago en curso. */
  listarTandasActivas(): Promise<TandaParaCobertura[]>;
  /** PENDIENTE → EN_RIESGO; false si el número ya no estaba PENDIENTE (así el aviso no se repite). */
  marcarEnRiesgo(idNumber: number): Promise<boolean>;
  /** EN_RIESGO → PENDIENTE cuando ya no hay pagos faltantes. */
  quitarRiesgo(idNumbers: number[]): Promise<void>;
}

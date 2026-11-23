import type { TandaParaCobertura } from '../../services/evaluar-turno';

export const COBERTURA_REPOSITORY_PORT = Symbol('COBERTURA_REPOSITORY_PORT');

export interface CoberturaNumeroMuerto {
  idNumeroMuerto: number;
  /** Cuota de cada participante, en pesos. */
  montoCuota: number;
  /** Números (`number.id_number`) que no pagaron y se van a cubrir. */
  idNumbers: number[];
}

export interface PagoCubierto {
  idPayment: number;
  idNumber: number;
}

/**
 * Puerto de salida: lo que necesita la revisión diaria de los turnos vencidos (AP-10).
 */
export interface CoberturaRepositoryPort {
  /** Tandas ACTIVAS con sus números reales y si cada uno ya tiene un pago en curso. */
  listarTandasActivas(): Promise<TandaParaCobertura[]>;
  /**
   * Registra en UNA transacción un pago de cobertura (CONFIRMADO, vinculado al número muerto)
   * por cada número que sigue sin pago en curso. Devuelve solo los que se crearon: un número que
   * pagó mientras tanto se omite, así que correrlo dos veces nunca cubre dos veces.
   */
  cubrirConNumeroMuerto(datos: CoberturaNumeroMuerto): Promise<PagoCubierto[]>;
  /** PENDIENTE → EN_RIESGO; false si el número ya no estaba PENDIENTE (así el aviso no se repite). */
  marcarEnRiesgo(idNumber: number): Promise<boolean>;
  /** EN_RIESGO → PENDIENTE cuando ya no hay pagos faltantes. */
  quitarRiesgo(idNumbers: number[]): Promise<void>;
}

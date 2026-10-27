import { Pago } from '../../entities/Pago';

/**
 * Datos del número (turno) necesarios para registrar un pago.
 * `tanda` es null si la tanda fue eliminada.
 */
export interface NumeroConCuota {
  idNumber: number;
  idUser: number | null;
  roundNumber: number;
  tanda: {
    idTanda: number;
    contributionAmount: number;
    idAdmin?: number;
  } | null;
}

/**
 * Token de Inyección de Dependencias para el puerto del Repositorio de Pagos.
 * Permite a NestJS inyectar la implementación de infraestructura (Drizzle)
 * sin que el dominio ni la aplicación dependan directamente de la clase concreta.
 */
export const PAGO_REPOSITORY_PORT = Symbol('PAGO_REPOSITORY_PORT');

/**
 * Puerto de Salida (Driven / Secondary Port): PagoRepositoryPort
 *
 * Define el contrato de persistencia que la capa de infraestructura
 * (ej. DrizzlePagoRepository) DEBE implementar.
 */
export interface PagoRepositoryPort {
  /**
   * Persiste un nuevo pago (tabla `payment`) y, si trae comprobante,
   * su fila en `evidence`, ambos en una sola transacción.
   * Lanza `PagoDuplicadoError` si el número ya tiene un pago pendiente o confirmado.
   */
  create(pago: Pago): Promise<Pago>;

  /**
   * Busca un número (turno) activo junto con la cuota de su tanda.
   */
  buscarNumeroConCuota(idNumber: number): Promise<NumeroConCuota | null>;

  /**
   * Indica si el número ya tiene un pago pendiente o confirmado
   * (un número pertenece a una sola vuelta, así que equivale a "esta vuelta").
   */
  existePagoActivo(idNumber: number): Promise<boolean>;

  /**
   * Busca un pago por su identificador (`id_payment`).
   */
  findById(idPayment: number): Promise<Pago | null>;

  /**
   * Actualiza el estado y datos de una entidad Pago existente.
   */
  update(pago: Pago): Promise<Pago>;
}

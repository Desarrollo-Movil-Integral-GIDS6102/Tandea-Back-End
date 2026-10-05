import { Pago } from '../../entities/pago.entity';

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
   * Persiste un nuevo pago en el almacenamiento secundario.
   */
  create(pago: Pago): Promise<Pago>;

  /**
   * Busca un pago por su identificador único UUID.
   */
  findById(id: string): Promise<Pago | null>;

  /**
   * Actualiza el estado y datos de una entidad Pago existente.
   */
  update(pago: Pago): Promise<Pago>;
}

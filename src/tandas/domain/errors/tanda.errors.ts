/**
 * Errores de Dominio para el módulo de Tandas (Arquitectura Hexagonal + DDD).
 *
 * Reglas:
 * - Dominio puro: Solo TypeScript sin dependencias externas (@nestjs/*, fastify, drizzle-orm, pg, zod).
 * - Todas las excepciones de negocio extienden de DomainError.
 * - Los adaptadores primarios (HTTP Exception Filters) traducen estos errores a códigos HTTP.
 */

export abstract class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/**
 * Error lanzado cuando los parámetros de cálculo o configuración del plan de tanda son inválidos.
 */
export class PlanTandaInvalidoError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}

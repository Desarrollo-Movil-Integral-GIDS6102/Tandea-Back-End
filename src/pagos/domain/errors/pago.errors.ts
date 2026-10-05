/**
 * Errores de Dominio para el módulo de Pagos.
 *
 * En Arquitectura Hexagonal:
 * - El Dominio NUNCA depende del framework (@nestjs/common) ni de HTTP.
 * - Todos los errores de negocio extienden de DomainError.
 * - Los adaptadores primarios (HTTP Controllers / Exception Filters)
 *   son los encargados de traducir estos errores a códigos de estado HTTP.
 */

export abstract class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class PagoNotFoundError extends DomainError {
  constructor(public readonly id: string) {
    super(`Pago con id "${id}" no encontrado`);
  }
}

export class PagoYaConfirmadoError extends DomainError {
  constructor() {
    super('Este pago ya está completamente confirmado');
  }
}

export class ConfirmacionOrganizadorPreviaError extends DomainError {
  constructor() {
    super('El organizador ya confirmó este pago');
  }
}

export class OrganizadorDebeConfirmarPrimeroError extends DomainError {
  constructor() {
    super('El organizador debe confirmar primero antes de que el receptor pueda confirmar');
  }
}

export class ReglaNegocioPagoError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}

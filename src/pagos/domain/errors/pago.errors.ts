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

export class ConfirmacionParticipantePreviaError extends DomainError {
  constructor() {
    super('El participante ya confirmó este pago previamente');
  }
}

export class ConfirmacionAdminPreviaError extends DomainError {
  constructor() {
    super('El administrador ya confirmó este pago previamente');
  }
}

export class OrganizadorDebeConfirmarPrimeroError extends DomainError {
  constructor() {
    super('El organizador debe confirmar primero antes de que el receptor pueda confirmar');
  }
}

export class PagoRechazadoError extends DomainError {
  constructor() {
    super('No se pueden realizar acciones de confirmación sobre un pago rechazado');
  }
}

export class ReglaNegocioPagoError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}


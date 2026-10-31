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
  constructor(public readonly id: number | string) {
    super(`Pago con id "${id}" no encontrado`);
  }
}

export class NumeroNoEncontradoError extends DomainError {
  constructor(public readonly idNumber: number) {
    super(`El número (turno) con id ${idNumber} no existe`);
  }
}

export class TandaNoEncontradaError extends DomainError {
  constructor(public readonly idNumber: number) {
    super(`La tanda del número (turno) con id ${idNumber} no existe`);
  }
}

export class NumeroAjenoError extends DomainError {
  constructor() {
    super('El número (turno) no pertenece al usuario autenticado');
  }
}

export class UsuarioNoAutorizadoError extends DomainError {
  constructor(
    message = 'Solo el organizador de la tanda o un administrador global pueden realizar esta acción',
  ) {
    super(message);
  }
}

export class PagoDuplicadoError extends DomainError {
  constructor(public readonly idNumber: number) {
    super(
      `Ya existe un pago pendiente o confirmado para el número (turno) ${idNumber} en esta vuelta`,
    );
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

export class ReglaNegocioPagoError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}

export class PagoRechazadoError extends DomainError {
  constructor() {
    super('El pago fue rechazado y no admite más confirmaciones');
  }
}

export class PagoYaRechazadoError extends DomainError {
  constructor() {
    super('Este pago ya fue rechazado previamente');
  }
}

export class MotivoRechazoRequeridoError extends DomainError {
  constructor() {
    super('El motivo de rechazo es obligatorio');
  }
}

export class ComprobanteRequeridoError extends ReglaNegocioPagoError {
  constructor(metodoPago: string) {
    super(`El pago por "${metodoPago}" requiere adjuntar el comprobante en el campo "file"`);
  }
}

/**
 * Error lanzado cuando la suma de montoEfectivo y montoTransferencia
 * no coincide exactamente con el monto total declarado en un pago híbrido (AP-03).
 */
export class MontoHibridoInvalidoError extends ReglaNegocioPagoError {
  constructor(
    public readonly montoEfectivo: number,
    public readonly montoTransferencia: number,
    public readonly sumaCalculada: number,
    public readonly montoEsperado: number,
  ) {
    super(
      `La suma de efectivo ($${montoEfectivo}) y transferencia ($${montoTransferencia}) es $${sumaCalculada}, pero debe ser igual a la cuota total de $${montoEsperado}`,
    );
  }
}

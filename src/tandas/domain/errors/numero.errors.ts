import { DomainError } from './tanda.errors';

export { DomainError };

/**
 * Error lanzado cuando un participante intenta tomar un número que ya tiene dueño en la misma tanda y vuelta.
 */
export class NumeroYaTomadoError extends DomainError {
  constructor(public readonly numero: number, public readonly roundNumber: number = 1) {
    super(`El número ${numero} en la vuelta ${roundNumber} ya ha sido tomado por otro participante.`);
  }
}

/**
 * Error lanzado cuando se intenta seleccionar el número configurado como número muerto (respaldo de caja).
 */
export class NumeroMuertoNoElegibleError extends DomainError {
  constructor(public readonly numero: number) {
    super(`El número ${numero} está reservado como número muerto y no puede ser seleccionado por participantes.`);
  }
}

/**
 * Error lanzado cuando se intenta acceder o asignar un número que no existe en la tanda.
 */
export class NumeroInexistenteError extends DomainError {
  constructor(public readonly numero: number, public readonly idTanda?: number) {
    super(`El número ${numero} no existe${idTanda ? ` en la tanda ${idTanda}` : ''}.`);
  }
}

/**
 * Error lanzado cuando el valor del número está fuera del rango permitido de la tanda.
 */
export class NumeroFueraDeRangoError extends DomainError {
  constructor(public readonly numero: number, public readonly max: number) {
    super(`El número ${numero} está fuera del rango permitido (debe ser entre 1 y ${max}).`);
  }
}

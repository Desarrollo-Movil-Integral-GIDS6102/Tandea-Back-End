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


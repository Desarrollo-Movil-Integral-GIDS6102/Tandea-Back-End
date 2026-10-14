import { NumeroTanda } from '../../entities/numero-tanda.entity';

export interface ElegirNumeroCommand {
  idTanda: number;
  idUsuario: number;
  valorNumero: number;
  roundNumber?: number; // por defecto 1 si no se especifica
}

export interface ElegirNumeroUseCasePort {
  elegirNumero(command: ElegirNumeroCommand): Promise<NumeroTanda>;
}

export const ELEGIR_NUMERO_USE_CASE_PORT = Symbol('ELEGIR_NUMERO_USE_CASE_PORT');

import { NumeroTanda } from '../../entities/numero-tanda.entity';

export interface CreateNumberData {
  idTanda: number;
  roundNumber: number;
  numberValue: number;
  idUser?: number | null;
  isDeadNumber: boolean;
  status: string;
}

export interface NumberRecord {
  idNumber: number;
  idTanda: number;
  roundNumber: number;
  numberValue: number;
  idUser: number | null;
  isDeadNumber: boolean;
  status: string;
  userName?: string | null;
  userLastName?: string | null;
  userEmail?: string | null;
  /** Pago vigente (PENDIENTE o CONFIRMADO) del número; un pago rechazado no cuenta. */
  idPayment?: number | null;
  estadoPago?: string | null;
  montoPagado?: number | null;
  fechaPago?: Date | null;
}

export interface NumberRepositoryPort {
  createNumber(data: CreateNumberData): Promise<NumberRecord>;
  /** Inserta varios números en una sola sentencia (todos o ninguno). */
  createNumbers(data: CreateNumberData[]): Promise<void>;
  findOccupiedNumbers(idTanda: number, roundNumber: number): Promise<number[]>;
  findByUserInTanda(idTanda: number, idUser: number): Promise<NumberRecord[]>;
  countParticipants(idTanda: number): Promise<number>;
  /** Números (sin el muerto) que no tienen pago PENDIENTE ni CONFIRMADO; opcionalmente solo los de un usuario. */
  countNumbersWithoutPayment(idTanda: number, idUser?: number): Promise<number>;
  findNumbersByTanda(idTanda: number): Promise<NumberRecord[]>;
  asignarSiLibre(
    idTanda: number,
    roundNumber: number,
    numberValue: number,
    idUsuario: number,
  ): Promise<NumeroTanda>;
  findByTandaRoundAndValue(
    idTanda: number,
    roundNumber: number,
    numberValue: number,
  ): Promise<NumeroTanda | null>;
}

export const NUMBER_REPOSITORY_PORT = Symbol('NUMBER_REPOSITORY_PORT');

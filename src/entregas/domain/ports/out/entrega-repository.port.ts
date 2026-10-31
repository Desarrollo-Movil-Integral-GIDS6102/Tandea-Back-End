export const ENTREGA_REPOSITORY_PORT = Symbol('ENTREGA_REPOSITORY_PORT');

export interface NumeroParaEntrega {
  idNumber: number;
  numberValue: number;
  idUser: number | null;
  isDeadNumber: boolean;
  status: string;
  idTanda: number;
  idAdmin: number;
  tandaStatus: string;
  contributionAmount: number;
  numParticipants: number;
}

export interface EntregaRecord {
  idPayout: number;
  idNumber: number;
  numberValue: number;
  idTanda: number;
  nombreTanda: string;
  idUser: number | null;
  idAdmin: number;
  transferAmount: number;
  cashAmount: number;
  totalAmount: number;
  confirmedByAdmin: boolean;
  confirmedByRecipient: boolean;
  status: string;
  evidenceUrl: string | null;
  createdAt: Date;
}

export interface RegistrarEntregaData {
  idNumber: number;
  transferAmount: number;
  cashAmount: number;
  totalAmount: number;
  evidenceUrl: string;
}

export interface EntregaRepositoryPort {
  buscarNumero(idNumber: number): Promise<NumeroParaEntrega | null>;
  /** Número de participante más bajo cuyo turno no se ha cerrado. */
  buscarTurnoVigente(idTanda: number): Promise<number | null>;
  /** Crea payout y evidence en una transacción; null si el turno ya tenía entrega. */
  registrar(data: RegistrarEntregaData): Promise<number | null>;
  buscarPorId(idPayout: number): Promise<EntregaRecord | null>;
  /** Cierra el turno y finaliza la tanda si era el último; false si ya estaba cerrado. */
  confirmarRecepcion(idPayout: number): Promise<boolean>;
  crearDisputa(idTanda: number, idPayout: number, idReporter: number, motivo: string): Promise<void>;
}

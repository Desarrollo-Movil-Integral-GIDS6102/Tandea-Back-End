// src/tandas/domain/ports/out/number-repository.port.ts

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
  userEmail?: string | null;
}

export interface NumberRepositoryPort {
  createNumber(data: CreateNumberData): Promise<NumberRecord>;
  findOccupiedNumbers(idTanda: number, roundNumber: number): Promise<number[]>;
  findByUserInTanda(idTanda: number, idUser: number): Promise<NumberRecord[]>;
  countParticipants(idTanda: number): Promise<number>;
  findNumbersByTanda(idTanda: number): Promise<NumberRecord[]>;
}

export const NUMBER_REPOSITORY_PORT = Symbol('NUMBER_REPOSITORY_PORT');

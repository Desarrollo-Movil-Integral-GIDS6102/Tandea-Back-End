// src/tandas/domain/ports/out/tanda-repository.port.ts
import { Tanda, TandaStatus } from '../../entities/tanda.entity';

export interface TandaFilterOptions {
  userId: number;
  userRole: string;
  scope?: 'dueno' | 'participante' | 'todos';
  name?: string;
  status?: TandaStatus;
  startDateFrom?: string;
  startDateTo?: string;
  sortBy?: 'name' | 'startDate' | 'createdAt' | 'contributionAmount';
  sortOrder?: 'asc' | 'desc';
  page: number;
  limit: number;
}

export interface TandaRepositoryPort {
  create(tanda: Tanda): Promise<Tanda>;
  findById(idTanda: number): Promise<Tanda | null>;
  findByInviteCode(inviteCode: string): Promise<Tanda | null>;
  update(tanda: Tanda): Promise<Tanda>;
  updateStatus(idTanda: number, status: TandaStatus): Promise<Tanda>;
  softDelete(idTanda: number): Promise<void>;
  findAll(options: TandaFilterOptions): Promise<{ data: Tanda[]; total: number }>;
}

export const TANDA_REPOSITORY_PORT = Symbol('TANDA_REPOSITORY_PORT');

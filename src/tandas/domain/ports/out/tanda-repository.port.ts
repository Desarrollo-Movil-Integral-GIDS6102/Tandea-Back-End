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

/** PAGO = aporte de un participante (payment); COBRO = entrega del turno (payout). */
export type TipoMovimiento = 'PAGO' | 'COBRO';

/** Posición en el historial: los movimientos van del más reciente al más antiguo. */
export interface CursorHistorial {
  /** created_at en UTC con microsegundos, para no saltar filas con el mismo milisegundo. */
  fecha: string;
  tipo: TipoMovimiento;
  id: number;
}

export interface MovimientoRecord {
  tipo: TipoMovimiento;
  id: number;
  idNumber: number;
  numero: number;
  idUser: number | null;
  nombre: string | null;
  monto: number;
  transferAmount: number;
  cashAmount: number;
  estado: string;
  /** created_at en UTC con microsegundos (mismo formato que CursorHistorial.fecha). */
  fecha: string;
}

export interface ListarMovimientosOptions {
  idUser?: number;
  cursor?: CursorHistorial;
  /** Se devuelven hasta `limit + 1` filas para saber si hay otra página. */
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
  /** Pagos y cobros de la tanda unidos vía `number`, del más reciente al más antiguo (AP-09). */
  listarMovimientos(idTanda: number, options: ListarMovimientosOptions): Promise<MovimientoRecord[]>;
}

export const TANDA_REPOSITORY_PORT = Symbol('TANDA_REPOSITORY_PORT');

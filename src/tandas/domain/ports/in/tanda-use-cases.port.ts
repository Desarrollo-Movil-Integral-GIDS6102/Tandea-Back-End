// src/tandas/domain/ports/in/tanda-use-cases.port.ts
import { Tanda, TandaStatus, TandaProps } from '../../entities/tanda.entity';
import { NumberRecord } from '../out/number-repository.port';

export interface CreateTandaCommand {
  name: string;
  description?: string;
  startDate: string;
  contributionAmount: number;
  numParticipants: number;
  numRounds?: number;
  graceDays?: number;
  hasDeadNumber?: boolean;
  idTandaType?: number;
  idAdmin: number;
}

export interface UpdateTandaCommand {
  name?: string;
  description?: string | null;
}

export interface ListTandasQuery {
  page?: number;
  limit?: number;
  search?: string;
  name?: string;
  status?: TandaStatus;
  startDateFrom?: string;
  startDateTo?: string;
  scope?: 'dueno' | 'participante' | 'todos';
  sortBy?: 'name' | 'startDate' | 'createdAt' | 'contributionAmount';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedTandasResult {
  data: (TandaProps & {
    rolUsuario?: 'DUENO' | 'PARTICIPANTE' | 'AMBOS' | 'ADMIN_GLOBAL';
    indicadorPago: 'al_dia' | 'pendiente';
  })[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TandaDetalle extends TandaProps {
  rolUsuario?: 'DUENO' | 'PARTICIPANTE' | 'AMBOS' | 'ADMIN_GLOBAL';
  participantes?: NumberRecord[];
  misNumeros?: NumberRecord[];
  numerosDisponibles?: number[];
}

export type TandaConDisponibles = TandaProps & { numerosDisponibles: number[] };

export interface JoinTandaCommand {
  inviteCode: string;
  idUser: number;
  /** Números elegidos; si se omite se asignan los primeros `cantidad` libres. */
  selectedNumbers?: number[];
  cantidad?: number;
}

export interface JoinTandaResult {
  tanda: Tanda;
  numeroAsignado: number;
  numerosAsignados: number[];
  isDeadNumber: boolean;
}

export interface TandaUseCasesPort {
  crearTanda(command: CreateTandaCommand): Promise<Tanda>;
  obtenerTandaPorId(idTanda: number, userId: number, role: string): Promise<TandaDetalle>;
  obtenerPorCodigoInvitacion(inviteCode: string): Promise<TandaConDisponibles>;
  listarTandas(query: ListTandasQuery, userId: number, role: string): Promise<PaginatedTandasResult>;
  actualizarTanda(idTanda: number, command: UpdateTandaCommand, userId: number, role: string): Promise<Tanda>;
  cambiarEstadoTanda(idTanda: number, status: TandaStatus, userId: number, role: string): Promise<Tanda>;
  eliminarTanda(idTanda: number, userId: number, role: string): Promise<void>;
  unirseTanda(command: JoinTandaCommand): Promise<JoinTandaResult>;
}

export const TANDA_USE_CASES_PORT = Symbol('TANDA_USE_CASES_PORT');

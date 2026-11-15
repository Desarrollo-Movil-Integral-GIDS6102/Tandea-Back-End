// src/tandas/domain/ports/in/tanda-use-cases.port.ts
import { Tanda, TandaStatus, TandaProps } from '../../entities/tanda.entity';
import type { PeriodicidadTanda } from '../../services/calcular-plan';
import type { TurnoCalendario } from '../../services/generar-calendario';
import { NumberRecord } from '../out/number-repository.port';
import type { TipoMovimiento } from '../out/tanda-repository.port';

export interface CreateTandaCommand {
  name: string;
  description?: string;
  startDate: string;
  contributionAmount: number;
  numParticipants: number;
  numRounds?: number;
  graceDays?: number;
  periodicity?: PeriodicidadTanda;
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

export interface SeguimientoParticipante {
  idNumber: number;
  numberValue: number;
  nombre: string;
  isDeadNumber: boolean;
  /** Estado del turno del número: PENDIENTE, EN_RIESGO, ENTREGA_PENDIENTE_CONFIRMACION o ENTREGADO. */
  estadoTurno: string;
  idPayment: number | null;
  /** true si su cuota la cubrió el número muerto porque no pagó a tiempo (AP-10). */
  cubiertoPorNumeroMuerto: boolean;
  estadoPago: string;
  montoPagado: number;
  fechaPago: Date | null;
}

/** El número muerto de la tanda: su estado y cuánto ha cubierto. */
export interface SeguimientoNumeroMuerto {
  idNumber: number;
  numberValue: number;
  estadoTurno: string;
  pagosCubiertos: number;
  montoCubierto: number;
}

export interface SeguimientoTanda {
  tanda: Pick<TandaProps, 'idTanda' | 'name' | 'numRounds' | 'contributionAmount'>;
  vueltaActual: number;
  cuota: number;
  /** null si la tanda no tiene número muerto. */
  numeroMuerto: SeguimientoNumeroMuerto | null;
  participantes: SeguimientoParticipante[];
}

export interface CalendarioTanda {
  tanda: Pick<
    TandaProps,
    'idTanda' | 'name' | 'startDate' | 'endDate' | 'periodicity' | 'numRounds' | 'hasDeadNumber' | 'graceDays'
  >;
  /** Primer día en que se aceptan pagos (después del turno #0 si hay número muerto). */
  fechaInicioPagos: string;
  turnos: TurnoCalendario[];
}

export interface HistorialQuery {
  /** Solo el organizador o el admin global pueden filtrar por otro participante. */
  userId?: number;
  /** Valor de `nextCursor` de la página anterior. */
  cursor?: string;
  limit: number;
}

export interface MovimientoHistorial {
  tipo: TipoMovimiento;
  id: number;
  idNumber: number;
  numero: number;
  usuario: { idUser: number; nombre: string | null } | null;
  monto: number;
  transferAmount: number;
  cashAmount: number;
  estado: string;
  fecha: string;
}

export interface HistorialTanda {
  items: MovimientoHistorial[];
  /** null cuando ya no hay más movimientos. */
  nextCursor: string | null;
}

export interface JoinTandaCommand {
  inviteCode: string;
  idUser: number;
  /** Números elegidos; si se omite se asignan los primeros `cantidad` libres. */
  selectedNumbers?: number[];
  cantidad?: number;
  /** Solo sorteo: pedir un bloque de números seguidos. */
  consecutivos?: boolean;
}

export interface JoinTandaResult {
  tanda: Tanda;
  numeroAsignado: number;
  numerosAsignados: number[];
  /** Solo sorteo: si los números asignados forman un bloque seguido. */
  consecutivos?: boolean;
  isDeadNumber: boolean;
}

export interface TandaUseCasesPort {
  crearTanda(command: CreateTandaCommand): Promise<Tanda>;
  obtenerTandaPorId(idTanda: number, userId: number, role: string): Promise<TandaDetalle>;
  obtenerSeguimiento(idTanda: number, userId: number, role: string): Promise<SeguimientoTanda>;
  obtenerCalendario(idTanda: number, userId: number, role: string): Promise<CalendarioTanda>;
  obtenerHistorial(idTanda: number, userId: number, role: string, query: HistorialQuery): Promise<HistorialTanda>;
  obtenerPorCodigoInvitacion(inviteCode: string): Promise<TandaConDisponibles>;
  listarTandas(query: ListTandasQuery, userId: number, role: string): Promise<PaginatedTandasResult>;
  actualizarTanda(idTanda: number, command: UpdateTandaCommand, userId: number, role: string): Promise<Tanda>;
  cambiarEstadoTanda(idTanda: number, status: TandaStatus, userId: number, role: string): Promise<Tanda>;
  eliminarTanda(idTanda: number, userId: number, role: string): Promise<void>;
  unirseTanda(command: JoinTandaCommand): Promise<JoinTandaResult>;
}

export const TANDA_USE_CASES_PORT = Symbol('TANDA_USE_CASES_PORT');

export const ADMIN_DISPUTAS_USE_CASE_PORT = Symbol('ADMIN_DISPUTAS_USE_CASE_PORT');

export type EstadoDisputa = 'ABIERTA' | 'EN_REVISION' | 'RESUELTA' | 'DESCARTADA';

export type AccionResolucionDisputa = 'mantener' | 'revertir' | 'suspender';

export interface DisputaResumen {
  idDispute: number;
  idTanda: number;
  nombreTanda: string;
  idReporter: number;
  nombreReporter: string;
  emailReporter: string;
  idResolver: number | null;
  reason: string;
  status: EstadoDisputa;
  resolutionNotes: string | null;
  idPayment: number | null;
  idPayout: number | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
}

export interface EntradaBitacoraDisputa {
  idLog: number;
  idUser: number;
  actionType: string;
  entityType: string;
  entityId: number;
  description: string;
  createdAt: Date;
}

export interface DisputaDetalle extends DisputaResumen {
  bitacora: EntradaBitacoraDisputa[];
}

export interface CrearDisputaCommand {
  idTanda: number;
  idReporter: number;
  rolReporter: string;
  motivo: string;
  idPayment?: number;
  idPayout?: number;
}

export interface ListarDisputasFiltro {
  status?: EstadoDisputa;
  idTanda?: number;
}

export interface ResolverDisputaCommand {
  idDispute: number;
  idAdminGlobal: number;
  accion: AccionResolucionDisputa;
  notas: string;
}

export interface AdminDisputasUseCasePort {
  crearDisputa(comando: CrearDisputaCommand): Promise<DisputaResumen>;
  listarDisputas(filtro?: ListarDisputasFiltro): Promise<DisputaResumen[]>;
  obtenerDisputa(idDispute: number): Promise<DisputaDetalle>;
  resolverDisputa(comando: ResolverDisputaCommand): Promise<DisputaResumen>;
}

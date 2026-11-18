import type {
  AccionResolucionDisputa,
  DisputaDetalle,
  DisputaResumen,
  ListarDisputasFiltro,
} from '../in/admin-disputas-use-case.port';

export const ADMIN_DISPUTAS_REPOSITORY_PORT = Symbol('ADMIN_DISPUTAS_REPOSITORY_PORT');

export interface TandaParaDisputa {
  idTanda: number;
  idAdmin: number;
  name: string;
}

export interface NuevaDisputaDatos {
  idTanda: number;
  idReporter: number;
  reason: string;
  idPayment?: number | null;
  idPayout?: number | null;
}

export interface ResolucionDisputaTransaccion {
  idDispute: number;
  idTanda: number;
  idPayment: number | null;
  idPayout: number | null;
  idAdminGlobal: number;
  accion: AccionResolucionDisputa;
  notas: string;
  actionType: string;
  auditDescription: string;
}

export interface AdminDisputasRepositoryPort {
  obtenerTanda(idTanda: number): Promise<TandaParaDisputa | null>;
  esParticipanteDeTanda(idTanda: number, idUser: number): Promise<boolean>;
  pagoPerteneceATanda(idPayment: number, idTanda: number): Promise<boolean>;
  entregaPerteneceATanda(idPayout: number, idTanda: number): Promise<boolean>;
  crearDisputa(datos: NuevaDisputaDatos): Promise<DisputaResumen>;
  listarDisputas(filtro?: ListarDisputasFiltro): Promise<DisputaResumen[]>;
  obtenerPorId(idDispute: number): Promise<DisputaDetalle | null>;
  /**
   * Resuelve la disputa, aplica la acción sobre el estado (sin modificar ningún monto)
   * e inserta el registro en `audit_log` dentro de la misma transacción.
   */
  resolverConAuditoria(datos: ResolucionDisputaTransaccion): Promise<DisputaResumen>;
}

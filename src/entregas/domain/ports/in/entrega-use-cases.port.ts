import type { ComprobanteArchivo } from '../../../../pagos/domain/ports/in/pago-use-cases.port';
import type { EntregaRecord } from '../out/entrega-repository.port';

export const ENTREGA_USE_CASES_PORT = Symbol('ENTREGA_USE_CASES_PORT');

export interface UsuarioEntrega {
  idUser: number;
  role: string;
}

export interface RegistrarEntregaCommand {
  idNumber: number;
  transferAmount: number;
  cashAmount: number;
  evidencia: ComprobanteArchivo;
}

export interface EntregaUseCasesPort {
  registrar(command: RegistrarEntregaCommand, usuario: UsuarioEntrega): Promise<EntregaRecord>;
  obtener(idPayout: number, usuario: UsuarioEntrega): Promise<EntregaRecord>;
  confirmar(idPayout: number, usuario: UsuarioEntrega): Promise<EntregaRecord>;
  reportarProblema(idPayout: number, motivo: string, usuario: UsuarioEntrega): Promise<void>;
}

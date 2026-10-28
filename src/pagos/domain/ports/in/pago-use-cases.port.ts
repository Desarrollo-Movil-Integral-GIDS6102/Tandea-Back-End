import { Pago, MetodoPago } from '../../entities/Pago';

/**
 * Archivo del comprobante ya validado por el adaptador de entrada.
 */
export interface ComprobanteArchivo {
  buffer: Buffer;
  mimetype: string;
  nombreOriginal: string;
}

export interface RegistrarPagoCommand {
  /** Usuario autenticado (JWT) que registra el pago. */
  idUser: number;
  idNumber: number;
  metodoPago: MetodoPago;
  /** Si se omite, se toma la cuota de la tanda (según el método). */
  transferAmount?: number;
  cashAmount?: number;
  comprobante?: ComprobanteArchivo | null;
}

/**
 * Identidad y rol del usuario autenticado en la capa de casos de uso (agnóstica de transporte).
 */
export interface UsuarioAutenticado {
  idUser: number;
  email: string;
  role: string;
}

export const PAGO_SERVICE_PORT = Symbol('PAGO_SERVICE_PORT');

/**
 * Puerto de Entrada (Driving / Primary Port): PagoUseCasesPort
 *
 * Expone las operaciones y casos de uso del módulo de Pagos
 * para ser consumidos por los adaptadores de entrada (HTTP Controller, CLI, WebSockets, etc.).
 */
export interface PagoUseCasesPort {
  registrar(command: RegistrarPagoCommand): Promise<Pago>;
  obtenerPago(id: number): Promise<Pago>;
  confirmar(id: number, usuario: UsuarioAutenticado): Promise<Pago>;
  rechazar(id: number, motivo: string, usuario: UsuarioAutenticado): Promise<Pago>;
  confirmarOrganizador(id: number, usuario?: UsuarioAutenticado): Promise<Pago>;
  confirmarReceptor(id: number): Promise<Pago>;
  actualizarResultadoOcr(id: number, montoDetectado: number): Promise<Pago>;
}

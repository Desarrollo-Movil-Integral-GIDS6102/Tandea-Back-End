import { Pago, MetodoPago } from '../../entities/Pago';

export interface CrearPagoCommand {
  idNumber: number;
  metodoPago: MetodoPago;
  transferAmount?: number;
  cashAmount?: number;
  comprobanteUrl?: string | null;
}

export const PAGO_SERVICE_PORT = Symbol('PAGO_SERVICE_PORT');

/**
 * Puerto de Entrada (Driving / Primary Port): PagoUseCasesPort
 *
 * Expone las operaciones y casos de uso del módulo de Pagos
 * para ser consumidos por los adaptadores de entrada (HTTP Controller, CLI, WebSockets, etc.).
 */
export interface PagoUseCasesPort {
  crearPago(command: CrearPagoCommand): Promise<Pago>;
  obtenerPago(id: number): Promise<Pago>;
  confirmarOrganizador(id: number): Promise<Pago>;
  confirmarReceptor(id: number): Promise<Pago>;
  actualizarResultadoOcr(id: number, montoDetectado: number): Promise<Pago>;
}

import { Pago, MetodoPago } from '../../entities/pago.entity';

export interface CrearPagoCommand {
  tandaId: string;
  participanteId: string;
  numeroPago: number;
  monto: number;
  montoEfectivo: number;
  montoTransferencia: number;
  metodoPago: MetodoPago;
  comprobanteUrl?: string | null;
  fechaPago: Date;
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
  obtenerPago(id: string): Promise<Pago>;
  confirmarOrganizador(id: string): Promise<Pago>;
  confirmarReceptor(id: string): Promise<Pago>;
  actualizarResultadoOcr(id: string, montoDetectado: number): Promise<Pago>;
}

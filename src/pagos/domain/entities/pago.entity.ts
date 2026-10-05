import {
  ConfirmacionOrganizadorPreviaError,
  OrganizadorDebeConfirmarPrimeroError,
  PagoYaConfirmadoError,
} from '../errors/pago.errors';

export type MetodoPago = 'efectivo' | 'transferencia' | 'hibrido';
export type EstadoPago = 'pendiente' | 'confirmado_parcial' | 'confirmado' | 'rechazado';

export interface PagoProps {
  id: string;
  tandaId: string;
  participanteId: string;
  numeroPago: number;
  monto: number;
  montoEfectivo: number;
  montoTransferencia: number;
  metodoPago: MetodoPago;
  estado: EstadoPago;
  comprobanteUrl: string | null;
  montoOcrValidado: number | null;
  ocrAprobado: boolean | null;
  confirmadoOrganizadorEn: Date | null;
  confirmadoReceptorEn: Date | null;
  fechaPago: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type CreatePagoProps = Omit<
  PagoProps,
  | 'id'
  | 'estado'
  | 'montoOcrValidado'
  | 'ocrAprobado'
  | 'confirmadoOrganizadorEn'
  | 'confirmadoReceptorEn'
  | 'createdAt'
  | 'updatedAt'
> & {
  id?: string;
  estado?: EstadoPago;
  comprobanteUrl?: string | null;
};

/**
 * Entidad de Dominio Rica: Pago
 *
 * En Arquitectura Hexagonal / DDD:
 *  - Encapsula estado y reglas de negocio invariantes.
 *  - No contiene decoradores de ORM, ni referencias a frameworks.
 *  - Es la única autorizada a modificar su estado interno según las reglas del negocio.
 */
export class Pago {
  private constructor(private props: PagoProps) {}

  /**
   * Reconstituye una entidad Pago desde la persistencia u orígenes confiables.
   */
  public static reconstitute(props: PagoProps): Pago {
    return new Pago(props);
  }

  /**
   * Crea una nueva instancia de Pago garantizando el estado inicial por defecto.
   */
  public static create(props: CreatePagoProps): Pago {
    const now = new Date();
    return new Pago({
      id: props.id ?? crypto.randomUUID(),
      tandaId: props.tandaId,
      participanteId: props.participanteId,
      numeroPago: props.numeroPago,
      monto: props.monto,
      montoEfectivo: props.montoEfectivo,
      montoTransferencia: props.montoTransferencia,
      metodoPago: props.metodoPago,
      estado: props.estado ?? 'pendiente',
      comprobanteUrl: props.comprobanteUrl ?? null,
      montoOcrValidado: null,
      ocrAprobado: null,
      confirmadoOrganizadorEn: null,
      confirmadoReceptorEn: null,
      fechaPago: props.fechaPago,
      createdAt: now,
      updatedAt: now,
    });
  }

  // ── Getters de Dominio ───────────────────────────────────────────────────

  get id(): string {
    return this.props.id;
  }

  get tandaId(): string {
    return this.props.tandaId;
  }

  get participanteId(): string {
    return this.props.participanteId;
  }

  get numeroPago(): number {
    return this.props.numeroPago;
  }

  get monto(): number {
    return this.props.monto;
  }

  get montoEfectivo(): number {
    return this.props.montoEfectivo;
  }

  get montoTransferencia(): number {
    return this.props.montoTransferencia;
  }

  get metodoPago(): MetodoPago {
    return this.props.metodoPago;
  }

  get estado(): EstadoPago {
    return this.props.estado;
  }

  get comprobanteUrl(): string | null {
    return this.props.comprobanteUrl;
  }

  get montoOcrValidado(): number | null {
    return this.props.montoOcrValidado;
  }

  get ocrAprobado(): boolean | null {
    return this.props.ocrAprobado;
  }

  get confirmadoOrganizadorEn(): Date | null {
    return this.props.confirmadoOrganizadorEn;
  }

  get confirmadoReceptorEn(): Date | null {
    return this.props.confirmadoReceptorEn;
  }

  get fechaPago(): Date {
    return this.props.fechaPago;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // ── Reglas de Negocio / Transición de Estados ────────────────────────────

  /**
   * Primera confirmación del flujo de doble confirmación:
   * El organizador valida que recibió el pago.
   */
  public confirmarPorOrganizador(): void {
    if (this.props.estado === 'confirmado') {
      throw new PagoYaConfirmadoError();
    }

    if (this.props.confirmadoOrganizadorEn) {
      throw new ConfirmacionOrganizadorPreviaError();
    }

    const now = new Date();
    this.props.confirmadoOrganizadorEn = now;
    this.props.updatedAt = now;

    // Si ya estuviese confirmado por el receptor (caso asíncrono excepcional), pasa a confirmado
    if (this.props.confirmadoReceptorEn) {
      this.props.estado = 'confirmado';
    } else {
      this.props.estado = 'confirmado_parcial';
    }
  }

  /**
   * Segunda confirmación del flujo de doble confirmación:
   * El receptor (ganador de la tanda) confirma que recibió el dinero.
   */
  public confirmarPorReceptor(): void {
    if (this.props.estado === 'confirmado') {
      throw new PagoYaConfirmadoError();
    }

    if (!this.props.confirmadoOrganizadorEn) {
      throw new OrganizadorDebeConfirmarPrimeroError();
    }

    const now = new Date();
    this.props.confirmadoReceptorEn = now;
    this.props.estado = 'confirmado';
    this.props.updatedAt = now;
  }

  /**
   * Actualiza el resultado del procesamiento OCR del comprobante.
   * Aplica la regla de tolerancia de ±1 peso para posibles discrepancias de redondeo.
   */
  public registrarResultadoOcr(montoDetectado: number): void {
    const diferencia = Math.abs(montoDetectado - this.props.montoTransferencia);
    const aprobado = diferencia <= 1;

    this.props.montoOcrValidado = montoDetectado;
    this.props.ocrAprobado = aprobado;
    this.props.updatedAt = new Date();
  }

  /**
   * Retorna una copia inmutable de los datos primitivos de la entidad.
   */
  public toPrimitives(): Readonly<PagoProps> {
    return Object.freeze({ ...this.props });
  }
}

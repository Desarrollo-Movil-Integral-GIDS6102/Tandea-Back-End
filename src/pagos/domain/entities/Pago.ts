import {
  ConfirmacionAdminPreviaError,
  ConfirmacionOrganizadorPreviaError,
  ConfirmacionParticipantePreviaError,
  OrganizadorDebeConfirmarPrimeroError,
  PagoRechazadoError,
  PagoYaConfirmadoError,
} from '../errors/pago.errors';

export type MetodoPago = 'efectivo' | 'transferencia' | 'hibrido';
export type EstadoPago =
  | 'PENDIENTE'
  | 'CONFIRMADO'
  | 'RECHAZADO'
  | 'pendiente'
  | 'confirmado'
  | 'rechazado'
  | 'confirmado_parcial';

export interface PagoProps {
  idPayment?: number;
  id?: string;
  idNumber: number;
  transferAmount: number;
  cashAmount: number;
  totalAmount: number;
  metodoPago: MetodoPago;
  status: 'PENDIENTE' | 'CONFIRMADO' | 'RECHAZADO';
  confirmedByParticipant: boolean;
  confirmedByAdmin: boolean;
  evidenceUrl?: string | null;
  ocrDetectedAmount?: number | null;
  ocrVerified?: boolean;
  rejectionReason?: string | null;
  createdAt: Date;
  updatedAt: Date;

  // Propiedades opcionales para interoperabilidad con módulos existentes
  tandaId?: string;
  participanteId?: string;
  numeroPago?: number;
  confirmadoOrganizadorEn?: Date | null;
  confirmadoReceptorEn?: Date | null;
  fechaPago?: Date;
}

export type CreatePagoProps = {
  idPayment?: number;
  id?: string;
  idNumber: number;
  transferAmount?: number;
  cashAmount?: number;
  totalAmount?: number;
  metodoPago: MetodoPago;
  status?: 'PENDIENTE' | 'CONFIRMADO' | 'RECHAZADO';
  confirmedByParticipant?: boolean;
  confirmedByAdmin?: boolean;
  evidenceUrl?: string | null;
  ocrDetectedAmount?: number | null;
  ocrVerified?: boolean;
  rejectionReason?: string | null;
  createdAt?: Date;
  updatedAt?: Date;

  // Compatibilidad
  monto?: number;
  montoEfectivo?: number;
  montoTransferencia?: number;
  comprobanteUrl?: string | null;
  tandaId?: string;
  participanteId?: string;
  numeroPago?: number;
  fechaPago?: Date;
};

/**
 * Entidad de Dominio Rica: Pago
 *
 * En Arquitectura Hexagonal y Domain-Driven Design (DDD):
 *  - Encapsula estado y reglas de negocio invariantes de transacciones de pago.
 *  - NO contiene dependencias de frameworks (@nestjs, Express, Fastify, etc.).
 *  - NO depende de ORMs (Drizzle, Prisma, TypeORM, etc.).
 *  - Expone métodos de negocio para confirmación por participante, administrador y consulta de estado.
 */
export class Pago {
  protected constructor(protected readonly props: PagoProps) {}

  /**
   * Reconstituye una entidad Pago desde la persistencia o fábrica de confianza.
   */
  public static reconstitute(props: PagoProps): Pago {
    return new Pago({
      ...props,
      status: (props.status?.toUpperCase() as 'PENDIENTE' | 'CONFIRMADO' | 'RECHAZADO') ?? 'PENDIENTE',
      confirmedByParticipant: Boolean(props.confirmedByParticipant),
      confirmedByAdmin: Boolean(props.confirmedByAdmin),
      evidenceUrl: props.evidenceUrl ?? null,
      ocrDetectedAmount: props.ocrDetectedAmount ?? null,
      ocrVerified: Boolean(props.ocrVerified),
      rejectionReason: props.rejectionReason ?? null,
    });
  }

  /**
   * Crea una nueva instancia de Pago asegurando valores iniciales válidos.
   */
  public static create(props: CreatePagoProps): Pago {
    const now = new Date();
    const transferAmount = props.transferAmount ?? props.montoTransferencia ?? 0;
    const cashAmount = props.cashAmount ?? props.montoEfectivo ?? 0;
    const totalAmount =
      props.totalAmount ??
      props.monto ??
      Number((transferAmount + cashAmount).toFixed(2));
    const evidenceUrl = props.evidenceUrl ?? props.comprobanteUrl ?? null;
    const confirmedByParticipant = props.confirmedByParticipant ?? false;
    const confirmedByAdmin = props.confirmedByAdmin ?? false;

    let status: 'PENDIENTE' | 'CONFIRMADO' | 'RECHAZADO' =
      props.status ?? (confirmedByParticipant && confirmedByAdmin ? 'CONFIRMADO' : 'PENDIENTE');

    return new Pago({
      idPayment: props.idPayment,
      id: props.id ?? (props.idPayment !== undefined ? String(props.idPayment) : crypto.randomUUID()),
      idNumber: props.idNumber,
      transferAmount,
      cashAmount,
      totalAmount,
      metodoPago: props.metodoPago,
      status,
      confirmedByParticipant,
      confirmedByAdmin,
      evidenceUrl,
      ocrDetectedAmount: props.ocrDetectedAmount ?? null,
      ocrVerified: props.ocrVerified ?? false,
      rejectionReason: props.rejectionReason ?? null,
      createdAt: props.createdAt ?? now,
      updatedAt: props.updatedAt ?? now,
      tandaId: props.tandaId,
      participanteId: props.participanteId,
      numeroPago: props.numeroPago,
      confirmadoOrganizadorEn: confirmedByAdmin ? now : null,
      confirmadoReceptorEn: null,
      fechaPago: props.fechaPago ?? now,
    });
  }

  // ── Getters de Dominio ───────────────────────────────────────────────────

  get idPayment(): number | undefined {
    return this.props.idPayment;
  }

  get id(): string {
    return this.props.id ?? (this.props.idPayment !== undefined ? String(this.props.idPayment) : '');
  }

  get idNumber(): number {
    return this.props.idNumber;
  }

  get transferAmount(): number {
    return this.props.transferAmount;
  }

  get cashAmount(): number {
    return this.props.cashAmount;
  }

  get totalAmount(): number {
    return this.props.totalAmount;
  }

  get metodoPago(): MetodoPago {
    return this.props.metodoPago;
  }

  get status(): 'PENDIENTE' | 'CONFIRMADO' | 'RECHAZADO' {
    return this.props.status;
  }

  get confirmedByParticipant(): boolean {
    return this.props.confirmedByParticipant;
  }

  get confirmedByAdmin(): boolean {
    return this.props.confirmedByAdmin;
  }

  get evidenceUrl(): string | null {
    return this.props.evidenceUrl ?? null;
  }

  get ocrDetectedAmount(): number | null {
    return this.props.ocrDetectedAmount ?? null;
  }

  get ocrVerified(): boolean {
    return this.props.ocrVerified ?? false;
  }

  get rejectionReason(): string | null {
    return this.props.rejectionReason ?? null;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // ── Getters de compatibilidad con versiones previas ──────────────────────

  get monto(): number {
    return this.props.totalAmount;
  }

  get montoEfectivo(): number {
    return this.props.cashAmount;
  }

  get montoTransferencia(): number {
    return this.props.transferAmount;
  }

  get estado(): string {
    return this.props.status.toLowerCase();
  }

  get comprobanteUrl(): string | null {
    return this.props.evidenceUrl ?? null;
  }

  get tandaId(): string {
    return this.props.tandaId ?? '';
  }

  get participanteId(): string {
    return this.props.participanteId ?? '';
  }

  get numeroPago(): number {
    return this.props.numeroPago ?? this.props.idNumber;
  }

  get confirmadoOrganizadorEn(): Date | null {
    return this.props.confirmadoOrganizadorEn ?? null;
  }

  get confirmadoReceptorEn(): Date | null {
    return this.props.confirmadoReceptorEn ?? null;
  }

  get fechaPago(): Date {
    return this.props.fechaPago ?? this.props.createdAt;
  }

  get ocrAprobado(): boolean | null {
    return this.props.ocrVerified ?? null;
  }

  get montoOcrValidado(): number | null {
    return this.props.ocrDetectedAmount ?? null;
  }

  // ── Reglas de Negocio / Transiciones de Estado ───────────────────────────

  /**
   * Confirma el pago por parte del participante (quien declara haber realizado el pago).
   */
  public confirmarPorParticipante(): void {
    if (this.props.status === 'RECHAZADO') {
      throw new PagoRechazadoError();
    }
    if (this.estaConfirmado()) {
      throw new PagoYaConfirmadoError();
    }
    if (this.props.confirmedByParticipant) {
      throw new ConfirmacionParticipantePreviaError();
    }

    this.props.confirmedByParticipant = true;
    this.props.updatedAt = new Date();

    if (this.props.confirmedByAdmin) {
      this.props.status = 'CONFIRMADO';
    }
  }

  /**
   * Confirma el pago por parte del administrador / organizador tras validar recepción de fondos.
   */
  public confirmarPorAdmin(): void {
    if (this.props.status === 'RECHAZADO') {
      throw new PagoRechazadoError();
    }
    if (this.estaConfirmado()) {
      throw new PagoYaConfirmadoError();
    }
    if (this.props.confirmedByAdmin) {
      throw new ConfirmacionAdminPreviaError();
    }

    const now = new Date();
    this.props.confirmedByAdmin = true;
    this.props.confirmadoOrganizadorEn = now;
    this.props.updatedAt = now;

    if (this.props.confirmedByParticipant) {
      this.props.status = 'CONFIRMADO';
    }
  }

  /**
   * Determina si el pago está completamente confirmado (ambas partes confirmadas o estado CONFIRMADO).
   */
  public estaConfirmado(): boolean {
    return (
      (this.props.confirmedByParticipant && this.props.confirmedByAdmin) ||
      this.props.status === 'CONFIRMADO'
    );
  }

  /**
   * Alias de compatibilidad para confirmarPorAdmin ejecutado por el organizador.
   */
  public confirmarPorOrganizador(): void {
    if (this.props.status === 'RECHAZADO') {
      throw new PagoRechazadoError();
    }
    if (this.estaConfirmado()) {
      throw new PagoYaConfirmadoError();
    }
    if (this.props.confirmedByAdmin) {
      throw new ConfirmacionOrganizadorPreviaError();
    }
    this.confirmarPorAdmin();
  }

  /**
   * Compatibilidad para segundo paso de entrega al receptor.
   */
  public confirmarPorReceptor(): void {
    if (this.props.status === 'RECHAZADO') {
      throw new PagoRechazadoError();
    }
    if (this.estaConfirmado()) {
      throw new PagoYaConfirmadoError();
    }
    if (!this.props.confirmedByAdmin) {
      throw new OrganizadorDebeConfirmarPrimeroError();
    }

    const now = new Date();
    this.props.confirmadoReceptorEn = now;
    this.props.confirmedByParticipant = true;
    this.props.status = 'CONFIRMADO';
    this.props.updatedAt = now;
  }

  /**
   * Rechaza el pago por fondos no recibidos o comprobante inválido.
   * Guarda el motivo del rechazo si se proporciona.
   */
  public rechazar(motivo?: string): void {
    if (this.estaConfirmado()) {
      throw new PagoYaConfirmadoError();
    }
    this.props.status = 'RECHAZADO';
    if (motivo !== undefined) {
      this.props.rejectionReason = motivo;
    }
    this.props.updatedAt = new Date();
  }

  /**
   * Actualiza el resultado del procesamiento OCR con tolerancia de ±1 unidad.
   */
  public registrarResultadoOcr(montoDetectado: number): void {
    const diferencia = Math.abs(montoDetectado - this.props.transferAmount);
    const aprobado = diferencia <= 1;

    this.props.ocrDetectedAmount = montoDetectado;
    this.props.ocrVerified = aprobado;
    this.props.updatedAt = new Date();
  }

  /**
   * Retorna una representación inmutable de los datos primitivos de la entidad.
   */
  public toPrimitives(): Readonly<PagoProps> {
    return Object.freeze({ ...this.props });
  }
}

export { PagoFactory, type CrearPagoFactoryDto } from '../factories/pago.factory';

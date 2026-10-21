export type TandaStatus = 'PENDIENTE' | 'ACTIVA' | 'FINALIZADA' | 'SUSPENDIDA' | 'CANCELADA';

export interface TandaProps {
  idTanda?: number;
  name: string;
  description?: string | null;
  startDate: string; // Formato YYYY-MM-DD
  endDate?: string | null;
  contributionAmount: number;
  numParticipants: number;
  numRounds: number;
  graceDays: number;
  hasDeadNumber: boolean;
  idTandaType: number;
  idAdmin: number;
  status?: TandaStatus;
  active?: boolean;
  inviteCode: string;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

export class Tanda {
  private props: TandaProps;

  constructor(props: TandaProps) {
    this.props = { ...props };
    this.validate();
  }

  private validate(): void {
    if (this.props.numParticipants < 2) {
      throw new Error('Una tanda debe tener al menos 2 participantes');
    }
    if (this.props.contributionAmount <= 0) {
      throw new Error('El monto de contribución debe ser mayor a 0');
    }
    if (this.props.graceDays < 0) {
      throw new Error('Los días de gracia no pueden ser negativos');
    }
    if (this.props.numRounds < 1) {
      throw new Error('Debe haber al menos 1 ronda');
    }
  }

  get idTanda(): number | undefined { return this.props.idTanda; }
  get name(): string { return this.props.name; }
  get description(): string | null | undefined { return this.props.description; }
  get startDate(): string { return this.props.startDate; }
  get endDate(): string | null | undefined { return this.props.endDate; }
  get contributionAmount(): number { return this.props.contributionAmount; }
  get numParticipants(): number { return this.props.numParticipants; }
  get numRounds(): number { return this.props.numRounds; }
  get graceDays(): number { return this.props.graceDays; }
  get hasDeadNumber(): boolean { return this.props.hasDeadNumber; }
  get idTandaType(): number { return this.props.idTandaType; }
  get idAdmin(): number { return this.props.idAdmin; }
  get status(): TandaStatus { return this.props.status ?? 'PENDIENTE'; }
  get active(): boolean { return this.props.active ?? true; }
  get inviteCode(): string { return this.props.inviteCode; }
  get createdAt(): Date | undefined { return this.props.createdAt; }
  get updatedAt(): Date | undefined { return this.props.updatedAt; }
  get deletedAt(): Date | null | undefined { return this.props.deletedAt; }

  updateDetails(name?: string, description?: string | null): void {
    if (name !== undefined) {
      if (name.trim().length < 3) {
        throw new Error('El nombre de la tanda debe tener al menos 3 caracteres');
      }
      this.props.name = name.trim();
    }
    if (description !== undefined) {
      this.props.description = description;
    }
    this.props.updatedAt = new Date();
  }

  updateStatus(newStatus: TandaStatus): void {
    this.props.status = newStatus;
    this.props.updatedAt = new Date();
  }

  softDelete(): void {
    this.props.active = false;
    this.props.status = 'CANCELADA';
    this.props.deletedAt = new Date();
    this.props.updatedAt = new Date();
  }

  toPrimitives(): TandaProps {
    return { ...this.props, status: this.status, active: this.active };
  }
}

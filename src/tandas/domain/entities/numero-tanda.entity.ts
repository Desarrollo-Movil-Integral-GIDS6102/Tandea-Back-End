import {
  NumeroYaTomadoError,
  NumeroMuertoNoElegibleError,
  NumeroFueraDeRangoError,
} from '../errors/numero.errors';

/** El número muerto (caja de respaldo) siempre es el #0; los participantes usan #1..#N. */
export const NUMERO_MUERTO = 0;

export type NumeroStatus =
  | 'PENDIENTE'
  | 'EN_RIESGO'
  | 'ENTREGA_PENDIENTE_CONFIRMACION'
  | 'ENTREGADO';

export interface NumeroTandaProps {
  idNumber?: number;
  idTanda: number;
  roundNumber: number;
  numberValue: number;
  idUser: number | null;
  isDeadNumber: boolean;
  status?: NumeroStatus;
  active?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

/**
 * Entidad rica de dominio para la gestión del turno / número dentro de una tanda.
 * No depende de ningún framework ni librería externa.
 */
export class NumeroTanda {
  private props: NumeroTandaProps;

  constructor(props: NumeroTandaProps) {
    this.props = {
      ...props,
      status: props.status ?? 'PENDIENTE',
      active: props.active ?? true,
    };
    this.validate();
  }

  private validate(): void {
    const minimo = this.props.isDeadNumber ? NUMERO_MUERTO : 1;
    if (this.props.numberValue < minimo) {
      throw new NumeroFueraDeRangoError(this.props.numberValue, minimo);
    }
    if (this.props.roundNumber < 1) {
      throw new Error('El número de vuelta debe ser mayor o igual a 1');
    }
  }

  get idNumber(): number | undefined {
    return this.props.idNumber;
  }

  get idTanda(): number {
    return this.props.idTanda;
  }

  get roundNumber(): number {
    return this.props.roundNumber;
  }

  get numberValue(): number {
    return this.props.numberValue;
  }

  get idUser(): number | null {
    return this.props.idUser;
  }

  get isDeadNumber(): boolean {
    return this.props.isDeadNumber;
  }

  get status(): NumeroStatus {
    return this.props.status ?? 'PENDIENTE';
  }

  get active(): boolean {
    return this.props.active ?? true;
  }

  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }

  get updatedAt(): Date | undefined {
    return this.props.updatedAt;
  }

  get deletedAt(): Date | null | undefined {
    return this.props.deletedAt;
  }

  /**
   * Asigna el número a un usuario participante respetando las reglas de negocio.
   * Lanza NumeroMuertoNoElegibleError si es número muerto.
   * Lanza NumeroYaTomadoError si ya tiene dueño asignado.
   */
  asignarA(idUsuario: number): void {
    if (this.props.isDeadNumber) {
      throw new NumeroMuertoNoElegibleError(this.props.numberValue);
    }

    if (this.props.idUser !== null) {
      throw new NumeroYaTomadoError(this.props.numberValue, this.props.roundNumber);
    }

    if (typeof idUsuario !== 'number' || !Number.isInteger(idUsuario) || idUsuario <= 0) {
      throw new Error('El id de usuario debe ser un número entero positivo.');
    }

    this.props.idUser = idUsuario;
    this.props.updatedAt = new Date();
  }

  liberar(): void {
    if (this.props.isDeadNumber) {
      throw new NumeroMuertoNoElegibleError(this.props.numberValue);
    }
    this.props.idUser = null;
    this.props.updatedAt = new Date();
  }

  toPrimitives(): NumeroTandaProps {
    return { ...this.props, status: this.status, active: this.active };
  }
}

import type { NumeroStatus } from '../entities/numero-tanda.entity';
import type { PeriodicidadTanda } from './calcular-plan';
import { generarCalendario, type TurnoCalendario } from './generar-calendario';

/** Número real (con dueño) de la vuelta 1 y si ya tiene un pago en curso (PENDIENTE o CONFIRMADO). */
export interface NumeroParaCobertura {
  idNumber: number;
  numero: number;
  idUser: number;
  status: NumeroStatus;
  tienePagoActivo: boolean;
}

export interface TandaParaCobertura {
  idTanda: number;
  nombre: string;
  idAdmin: number;
  startDate: string; // YYYY-MM-DD
  periodicidad: PeriodicidadTanda;
  montoCuota: number;
  numParticipantes: number;
  numVueltas: number;
  tieneNumeroMuerto: boolean;
  diasGracia: number;
  /** Fila `number` del #0 (null si la tanda no tiene número muerto). */
  idNumeroMuerto: number | null;
  numeros: NumeroParaCobertura[];
}

/** Qué hacer con el turno cuya fecha límite ya pasó. */
export type DecisionTurno = 'SIN_FALTANTES' | 'EN_RIESGO';

export interface PlanDeTurno {
  /** Turno cuya gracia ya venció; null si todavía no hay ninguno o no tiene beneficiario. */
  turno: TurnoCalendario | null;
  /** Dueño del turno que se está cobrando. */
  beneficiario: NumeroParaCobertura | null;
  /** Números sin pago en curso. */
  faltantes: NumeroParaCobertura[];
  decision: DecisionTurno | null;
  /** Números que estaban EN_RIESGO y ya no tienen pagos faltantes: vuelven a PENDIENTE. */
  aRegularizar: NumeroParaCobertura[];
}

/**
 * Último turno del calendario cuya fecha límite (fechaCobro + días de gracia) ya pasó,
 * es decir, el que se está cobrando y ya salió de la gracia. Devuelve null si ninguno.
 */
export function turnoVencido(tanda: TandaParaCobertura, hoy: string): TurnoCalendario | null {
  const calendario = generarCalendario({
    startDate: tanda.startDate,
    periodicidad: tanda.periodicidad,
    montoCuota: tanda.montoCuota,
    numParticipantes: tanda.numParticipantes,
    numVueltas: tanda.numVueltas,
    tieneNumeroMuerto: tanda.tieneNumeroMuerto,
    numeros: [],
  });
  const vencidos = calendario.filter((t) => sumarDias(t.fechaCobro, tanda.diasGracia) < hoy);
  return vencidos[vencidos.length - 1] ?? null;
}

/**
 * Función pura de dominio (AP-10): revisa el turno que acaba de salir de la gracia y decide
 * qué pasa con los pagos que faltan.
 *
 *  - Sin pagos faltantes no hay nada que hacer (y si el beneficiario estaba EN_RIESGO, se regulariza).
 *  - Con faltantes y SIN número muerto, el turno del beneficiario queda EN_RIESGO.
 *  - El turno #0 no tiene beneficiario, así que no hay nada en riesgo.
 *  - Las tandas con número muerto las atiende la cobertura (otra regla).
 */
export function planificarTurno(tanda: TandaParaCobertura, hoy: string): PlanDeTurno {
  const faltantes = tanda.numeros.filter((n) => !n.tienePagoActivo);
  const aRegularizar = faltantes.length === 0 ? tanda.numeros.filter((n) => n.status === 'EN_RIESGO') : [];

  const sinPlan: PlanDeTurno = { turno: null, beneficiario: null, faltantes, decision: null, aRegularizar };

  const turno = turnoVencido(tanda, hoy);
  if (!turno || turno.esNumeroMuerto) return sinPlan;

  const beneficiario = tanda.numeros.find((n) => n.numero === turno.numero) ?? null;
  if (!beneficiario || beneficiario.status === 'ENTREGADO' || beneficiario.status === 'ENTREGA_PENDIENTE_CONFIRMACION') {
    return sinPlan;
  }

  if (faltantes.length === 0) {
    return { turno, beneficiario, faltantes, decision: 'SIN_FALTANTES', aRegularizar };
  }
  if (tanda.tieneNumeroMuerto) {
    return { turno, beneficiario, faltantes, decision: null, aRegularizar };
  }
  return { turno, beneficiario, faltantes, decision: 'EN_RIESGO', aRegularizar };
}

// Mediodía UTC para que el día no cambie con la zona horaria del servidor
function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

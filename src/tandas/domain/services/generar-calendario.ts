import { PlanTandaInvalidoError } from '../errors/tanda.errors';
import { NUMERO_MUERTO } from '../entities/numero-tanda.entity';
import { sumarPeriodos, type PeriodicidadTanda } from './calcular-plan';

/** Número apartado de la vuelta 1 con su dueño (null si sigue libre o es el muerto). */
export interface NumeroCalendario {
  numberValue: number;
  idUser: number | null;
  nombre: string | null;
}

export interface GenerarCalendarioInput {
  startDate: string; // Formato YYYY-MM-DD
  periodicidad: PeriodicidadTanda;
  montoCuota: number;
  numParticipantes: number;
  numVueltas: number;
  tieneNumeroMuerto: boolean;
  /** Solo se guardan los números de la vuelta 1; el mismo orden se repite en cada vuelta. */
  numeros: NumeroCalendario[];
}

export interface TurnoCalendario {
  readonly turno: number;
  readonly vuelta: number;
  readonly numero: number;
  readonly esNumeroMuerto: boolean;
  readonly usuario: { idUser: number; nombre: string | null } | null;
  readonly fechaCobro: string; // Formato YYYY-MM-DD
  readonly montoAEsperar: number;
}

/**
 * Función pura de dominio que arma el calendario de turnos de una tanda (AP-06).
 * No se guarda en BD: se recalcula cada vez a partir de la tanda y sus números.
 *
 * Reglas de negocio:
 * 1. En cada vuelta los turnos van en orden de número: #0 (si hay número muerto) y luego #1..#N.
 * 2. fechaCobro del turno k (1-based, contando todas las vueltas) = startDate + (k - 1) periodos,
 *    igual que `calcularPlan`, así el último turno cae en la fechaFin de la tanda.
 * 3. En todos los turnos, incluido el #0 del número muerto, todos los participantes pagan
 *    y se espera la cuota de cada número (cuota * N). El #0 solo se distingue porque no tiene dueño.
 */
export function generarCalendario(input: GenerarCalendarioInput): TurnoCalendario[] {
  const fechaInicio = fechaDesdeIso(input.startDate);

  const usuarios = new Map(
    input.numeros
      .filter((n) => n.numberValue !== NUMERO_MUERTO && n.idUser !== null)
      .map((n) => [n.numberValue, { idUser: n.idUser!, nombre: n.nombre }]),
  );

  const ordenVuelta = [
    ...(input.tieneNumeroMuerto ? [NUMERO_MUERTO] : []),
    ...Array.from({ length: input.numParticipantes }, (_, i) => i + 1),
  ];

  // En centavos para no arrastrar errores de punto flotante
  const montoTurnoCentavos = Math.round(input.montoCuota * 100) * input.numParticipantes;
  const montoTurno = Number((montoTurnoCentavos / 100).toFixed(2));

  const calendario: TurnoCalendario[] = [];
  for (let vuelta = 1; vuelta <= input.numVueltas; vuelta++) {
    for (const numero of ordenVuelta) {
      const esNumeroMuerto = numero === NUMERO_MUERTO;
      calendario.push(
        Object.freeze({
          turno: calendario.length + 1,
          vuelta,
          numero,
          esNumeroMuerto,
          usuario: usuarios.get(numero) ?? null,
          fechaCobro: aIso(sumarPeriodos(fechaInicio, input.periodicidad, calendario.length)),
          montoAEsperar: montoTurno,
        }),
      );
    }
  }

  return calendario;
}

/**
 * Primer día en que se aceptan pagos: siempre la startDate, porque el turno #0
 * del número muerto también se paga.
 */
export function fechaInicioPagos(
  startDate: string,
  _periodicidad: PeriodicidadTanda,
  _tieneNumeroMuerto: boolean,
): string {
  return aIso(fechaDesdeIso(startDate));
}

// Mediodía UTC para que el día no cambie al operar con la zona horaria del servidor
function fechaDesdeIso(fecha: string): Date {
  const resultado = new Date(`${fecha}T12:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(resultado.getTime())) {
    throw new PlanTandaInvalidoError(`La fecha de inicio '${fecha}' no tiene formato YYYY-MM-DD.`);
  }
  return resultado;
}

function aIso(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

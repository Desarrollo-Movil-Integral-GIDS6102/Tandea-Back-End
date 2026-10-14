import { PlanTandaInvalidoError } from '../errors/tanda.errors';

export type PeriodicidadTanda = 'diaria' | 'semanal' | 'quincenal' | 'mensual';

export interface PlanTandaInput {
  periodicidad: PeriodicidadTanda;
  montoCuota: number;
  numParticipantes: number;
  numVueltas: number;
  tieneNumeroMuerto: boolean;
  fechaInicio: Date;
}

export interface PlanTandaResult {
  readonly totalNumeros: number;
  readonly totalPagos: number;
  readonly totalTurnos: number;
  readonly montoPorTurno: number;
  readonly montoTotalPorParticipante: number;
  readonly fechaFin: Date;
}

const PERIODICIDADES_VALIDAS: readonly PeriodicidadTanda[] = [
  'diaria',
  'semanal',
  'quincenal',
  'mensual',
];

/**
 * Función pura de dominio para calcular el plan y calendario financiero de una tanda (AP-01).
 *
 * Reglas de negocio:
 * 1. totalNumeros = numParticipantes + (tieneNumeroMuerto ? 1 : 0).
 * 2. totalPagos = totalNumeros * numVueltas (aportaciones que realiza cada participante en toda la tanda).
 * 3. montoPorTurno = montoCuota * totalNumeros (monto recaudado y entregado al beneficiario del turno).
 * 4. montoTotalPorParticipante = montoCuota * totalPagos (suma total aportada por participante).
 * 5. totalTurnos = totalNumeros * numVueltas.
 * 6. fechaFin = fecha del último turno = fechaInicio + (totalTurnos - 1) periodos.
 *    - diaria: +1 día por turno
 *    - semanal: +7 días por turno
 *    - quincenal: +15 días por turno
 *    - mensual: +1 mes calendario (ajustando al último día si el mes destino tiene menos días)
 * 7. Precisión monetaria: se opera en centavos enteros para evitar errores de coma flotante de IEEE 754.
 */
export function calcularPlan(input: PlanTandaInput): PlanTandaResult;
export function calcularPlan(
  periodicidad: PeriodicidadTanda,
  montoCuota: number,
  numParticipantes: number,
  numVueltas: number,
  tieneNumeroMuerto: boolean,
  fechaInicio: Date,
): PlanTandaResult;
export function calcularPlan(
  inputOrPeriodicidad: PlanTandaInput | PeriodicidadTanda,
  montoCuotaArg?: number,
  numParticipantesArg?: number,
  numVueltasArg?: number,
  tieneNumeroMuertoArg?: boolean,
  fechaInicioArg?: Date,
): PlanTandaResult {
  // Normalizar parámetros de entrada (soporta objeto de opciones o argumentos posicionales)
  const periodicidad =
    typeof inputOrPeriodicidad === 'object'
      ? inputOrPeriodicidad.periodicidad
      : inputOrPeriodicidad;
  const montoCuota =
    typeof inputOrPeriodicidad === 'object'
      ? inputOrPeriodicidad.montoCuota
      : montoCuotaArg!;
  const numParticipantes =
    typeof inputOrPeriodicidad === 'object'
      ? inputOrPeriodicidad.numParticipantes
      : numParticipantesArg!;
  const numVueltas =
    typeof inputOrPeriodicidad === 'object'
      ? inputOrPeriodicidad.numVueltas
      : numVueltasArg!;
  const tieneNumeroMuerto =
    typeof inputOrPeriodicidad === 'object'
      ? inputOrPeriodicidad.tieneNumeroMuerto
      : tieneNumeroMuertoArg!;
  const fechaInicio =
    typeof inputOrPeriodicidad === 'object'
      ? inputOrPeriodicidad.fechaInicio
      : fechaInicioArg!;

  // ── Validaciones de Dominio ────────────────────────────────────────────────
  if (!PERIODICIDADES_VALIDAS.includes(periodicidad)) {
    throw new PlanTandaInvalidoError(
      `Periodicidad '${String(periodicidad)}' inválida. Debe ser una de: ${PERIODICIDADES_VALIDAS.join(', ')}`,
    );
  }

  if (
    typeof numParticipantes !== 'number' ||
    !Number.isInteger(numParticipantes) ||
    numParticipantes < 2
  ) {
    throw new PlanTandaInvalidoError(
      'El número de participantes debe ser un número entero mayor o igual a 2.',
    );
  }

  if (
    typeof numVueltas !== 'number' ||
    !Number.isInteger(numVueltas) ||
    numVueltas < 1
  ) {
    throw new PlanTandaInvalidoError(
      'El número de vueltas debe ser un número entero mayor o igual a 1.',
    );
  }

  if (
    typeof montoCuota !== 'number' ||
    Number.isNaN(montoCuota) ||
    !Number.isFinite(montoCuota) ||
    montoCuota <= 0
  ) {
    throw new PlanTandaInvalidoError(
      'El monto de la cuota debe ser un número positivo mayor a 0.',
    );
  }

  if (!(fechaInicio instanceof Date) || Number.isNaN(fechaInicio.getTime())) {
    throw new PlanTandaInvalidoError(
      'La fecha de inicio proporcionada no es una fecha válida.',
    );
  }

  if (typeof tieneNumeroMuerto !== 'boolean') {
    throw new PlanTandaInvalidoError(
      'El valor de tieneNumeroMuerto debe ser un booleano.',
    );
  }

  // ── Cálculos de Números y Turnos ───────────────────────────────────────────
  const totalNumeros = numParticipantes + (tieneNumeroMuerto ? 1 : 0);
  const totalPagos = totalNumeros * numVueltas;
  const totalTurnos = totalNumeros * numVueltas;

  // ── Cálculos Monetarios en Centavos (sin imprecisión flotante) ──────────────
  const cuotaCentavos = Math.round(montoCuota * 100);
  const montoPorTurnoCentavos = cuotaCentavos * totalNumeros;
  const montoTotalPorParticipanteCentavos = cuotaCentavos * totalPagos;

  const montoPorTurno = Number((montoPorTurnoCentavos / 100).toFixed(2));
  const montoTotalPorParticipante = Number(
    (montoTotalPorParticipanteCentavos / 100).toFixed(2),
  );

  // ── Cálculo de fechaFin (fecha del último turno) ───────────────────────────
  // Periodos a sumar = totalTurnos - 1
  const periodos = totalTurnos - 1;
  const fechaFin = new Date(fechaInicio.getTime());

  if (periodos > 0) {
    switch (periodicidad) {
      case 'diaria':
        fechaFin.setDate(fechaFin.getDate() + periodos);
        break;
      case 'semanal':
        fechaFin.setDate(fechaFin.getDate() + periodos * 7);
        break;
      case 'quincenal':
        fechaFin.setDate(fechaFin.getDate() + periodos * 15);
        break;
      case 'mensual': {
        const targetYear =
          fechaInicio.getFullYear() +
          Math.floor((fechaInicio.getMonth() + periodos) / 12);
        const targetMonth = (fechaInicio.getMonth() + periodos) % 12;
        // Último día del mes de destino (el día 0 del mes siguiente da el último día del mes actual)
        const lastDayOfTargetMonth = new Date(
          targetYear,
          targetMonth + 1,
          0,
        ).getDate();
        const targetDay = Math.min(fechaInicio.getDate(), lastDayOfTargetMonth);

        fechaFin.setFullYear(targetYear, targetMonth, targetDay);
        break;
      }
    }
  }

  // Retornar objeto inmutable
  return Object.freeze({
    totalNumeros,
    totalPagos,
    totalTurnos,
    montoPorTurno,
    montoTotalPorParticipante,
    fechaFin,
  });
}

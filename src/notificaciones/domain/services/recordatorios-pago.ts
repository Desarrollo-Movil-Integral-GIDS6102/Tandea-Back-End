import { generarCalendario, type TurnoCalendario } from '../../../tandas/domain/services/generar-calendario';
import type { PeriodicidadTanda } from '../../../tandas/domain/services/calcular-plan';

/** Número de un participante y si ya tiene un pago en curso (PENDIENTE o CONFIRMADO). */
export interface NumeroParaRecordatorio {
  idNumber: number;
  numero: number;
  idUser: number;
  tienePagoActivo: boolean;
}

export interface TandaParaRecordatorio {
  idTanda: number;
  nombre: string;
  startDate: string; // YYYY-MM-DD
  periodicidad: PeriodicidadTanda;
  montoCuota: number;
  numParticipantes: number;
  numVueltas: number;
  tieneNumeroMuerto: boolean;
  diasGracia: number;
  numeros: NumeroParaRecordatorio[];
}

/** Un aviso por participante y tanda; agrupa todos sus números sin pagar. */
export interface RecordatorioPago {
  idUser: number;
  idTanda: number;
  nombreTanda: string;
  numeros: number[];
  monto: number;
  fechaLimite: string; // YYYY-MM-DD
  diasRestantes: number;
}

/**
 * Turno que se está cobrando hoy: el primero que genera pagos y cuya fecha
 * límite (fechaCobro + días de gracia) todavía no pasa. El turno #0 del
 * número muerto no genera pagos y se salta.
 */
export function turnoEnCobro(
  tanda: TandaParaRecordatorio,
  hoy: string,
): { turno: TurnoCalendario; fechaLimite: string } | null {
  const calendario = generarCalendario({
    startDate: tanda.startDate,
    periodicidad: tanda.periodicidad,
    montoCuota: tanda.montoCuota,
    numParticipantes: tanda.numParticipantes,
    numVueltas: tanda.numVueltas,
    tieneNumeroMuerto: tanda.tieneNumeroMuerto,
    numeros: [],
  });

  for (const turno of calendario) {
    if (turno.montoAEsperar === 0) continue;
    const fechaLimite = sumarDias(turno.fechaCobro, tanda.diasGracia);
    if (fechaLimite >= hoy) return { turno, fechaLimite };
  }
  return null;
}

/**
 * Función pura de dominio (AP-08): decide a quién recordar que pague.
 *
 * Se avisa cuando faltan exactamente `diasAntes` días para la fecha límite del
 * turno en cobro, solo a los números sin pago en curso. Un pago PENDIENTE ya fue
 * registrado y solo espera al organizador, así que no se le recuerda.
 */
export function seleccionarRecordatorios(
  tanda: TandaParaRecordatorio,
  hoy: string,
  diasAntes: number,
): RecordatorioPago[] {
  const enCobro = turnoEnCobro(tanda, hoy);
  if (!enCobro) return [];

  const diasRestantes = diasEntre(hoy, enCobro.fechaLimite);
  if (diasRestantes !== diasAntes) return [];

  const porUsuario = new Map<number, number[]>();
  for (const n of tanda.numeros) {
    if (n.tienePagoActivo) continue;
    porUsuario.set(n.idUser, [...(porUsuario.get(n.idUser) ?? []), n.numero]);
  }

  return [...porUsuario.entries()].map(([idUser, numeros]) => ({
    idUser,
    idTanda: tanda.idTanda,
    nombreTanda: tanda.nombre,
    numeros: numeros.sort((a, b) => a - b),
    // En centavos para no arrastrar errores de punto flotante
    monto: (Math.round(tanda.montoCuota * 100) * numeros.length) / 100,
    fechaLimite: enCobro.fechaLimite,
    diasRestantes,
  }));
}

// Mediodía UTC para que el día no cambie con la zona horaria del servidor
function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function diasEntre(desde: string, hasta: string): number {
  const ms = new Date(`${hasta}T12:00:00.000Z`).getTime() - new Date(`${desde}T12:00:00.000Z`).getTime();
  return Math.round(ms / 86_400_000);
}

export interface DatosMontoAEntregar {
  /** Cuota que paga cada número, en pesos. */
  montoCuota: number;
  numParticipantes: number;
  /** Cuotas de la tanda que no están CONFIRMADAS (sin pago, pendientes de revisar o rechazadas). */
  cuotasNoConfirmadas: number;
}

export interface MontoAEntregar {
  /** Lo que se juntaría si todos hubieran pagado: cuota × participantes. */
  totalTurno: number;
  /** Lo que se descuenta por las cuotas no confirmadas. */
  descuento: number;
  /** Lo que realmente se le entrega a quien cobra el turno (nunca negativo). */
  montoAEntregar: number;
  cuotasNoConfirmadas: number;
}

/**
 * Función pura de dominio (AP-10): monto que recibe quien cobra el turno =
 * total del turno − cuotas no confirmadas. No hay columnas cacheadas: quien la usa cuenta
 * las cuotas consultando `payment`.
 *
 * Trabaja en centavos para no arrastrar errores de punto flotante.
 */
export function calcularMontoAEntregar(datos: DatosMontoAEntregar): MontoAEntregar {
  const cuotaCentavos = Math.round(datos.montoCuota * 100);
  const noConfirmadas = Math.min(Math.max(datos.cuotasNoConfirmadas, 0), datos.numParticipantes);

  const totalCentavos = cuotaCentavos * datos.numParticipantes;
  const descuentoCentavos = cuotaCentavos * noConfirmadas;

  return {
    totalTurno: totalCentavos / 100,
    descuento: descuentoCentavos / 100,
    montoAEntregar: Math.max(totalCentavos - descuentoCentavos, 0) / 100,
    cuotasNoConfirmadas: noConfirmadas,
  };
}

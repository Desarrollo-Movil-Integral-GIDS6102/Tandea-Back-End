/**
 * Utilidades puras de dominio para cálculos y validaciones monetarias (AP-03).
 *
 * Reglas arquitectónicas:
 * - TypeScript puro (sin @nestjs/*, fastify, drizzle, zod, etc.).
 * - Opera en centavos enteros para evitar imprecisiones de punto flotante IEEE 754.
 */

/**
 * Valida que un valor sea un monto monetario válido:
 * - Tipo numérico finito.
 * - No negativo (>= 0).
 * - Con un máximo de 2 decimales (sin fracciones de centavo).
 */
export function esMontoMonetarioValido(valor: unknown): valor is number {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || Number.isNaN(valor)) {
    return false;
  }
  if (valor < 0) {
    return false;
  }
  const centavos = Math.round(valor * 100);
  return Math.abs(valor - centavos / 100) < 1e-9;
}

/**
 * Convierte un monto decimal a centavos enteros normalizados.
 */
export function toCentavos(monto: number): number {
  return Math.round(monto * 100);
}

/**
 * Verifica si la suma de montos parciales en centavos enteros equivale exactamente al monto total.
 */
export function sumarCentavosExactos(
  montoEfectivo: number,
  montoTransferencia: number,
  montoTotal: number,
): boolean {
  return toCentavos(montoEfectivo) + toCentavos(montoTransferencia) === toCentavos(montoTotal);
}

import type { MontoMensual } from '../ports/out/admin-metricas-repository.port';

/** Cuántos meses muestra la gráfica del panel (el actual y los 11 anteriores). */
export const MESES_DE_LA_GRAFICA = 12;

const ZONA_HORARIA = 'America/Mexico_City';

/** Mes actual (YYYY-MM) según la hora de la Ciudad de México. */
export function mesActual(ahora: Date): string {
  return ahora.toLocaleDateString('en-CA', { timeZone: ZONA_HORARIA }).slice(0, 7);
}

/** Lista los `cantidad` meses que terminan en `mesFinal`, del más antiguo al más reciente. */
export function ultimosMeses(mesFinal: string, cantidad: number = MESES_DE_LA_GRAFICA): string[] {
  const [anio, mes] = mesFinal.split('-').map(Number);
  return Array.from({ length: cantidad }, (_, i) => {
    const indice = anio * 12 + (mes - 1) - (cantidad - 1 - i);
    return `${Math.floor(indice / 12)}-${String((indice % 12) + 1).padStart(2, '0')}`;
  });
}

/** Primer día (YYYY-MM-DD) del mes más antiguo de la gráfica. */
export function inicioDeLaGrafica(mesFinal: string, cantidad: number = MESES_DE_LA_GRAFICA): string {
  return `${ultimosMeses(mesFinal, cantidad)[0]}-01`;
}

/**
 * Completa con ceros los meses sin pagos para que la gráfica no tenga huecos.
 * Función pura: el repositorio solo devuelve los meses que tuvieron movimiento.
 */
export function completarMeses(
  filas: MontoMensual[],
  mesFinal: string,
  cantidad: number = MESES_DE_LA_GRAFICA,
): MontoMensual[] {
  const porMes = new Map(filas.map((f) => [f.mes, f]));
  return ultimosMeses(mesFinal, cantidad).map((mes) => porMes.get(mes) ?? { mes, monto: 0, pagos: 0 });
}

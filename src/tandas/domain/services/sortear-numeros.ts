export interface SorteoNumerosResult {
  /** Números asignados, de menor a mayor. */
  readonly numeros: number[];
  /** true si los números forman un bloque seguido (p. ej. 4, 5, 6). */
  readonly consecutivos: boolean;
}

/**
 * Función pura de dominio para la asignación por sorteo (BUG-P6).
 *
 * - Elige al azar `cantidad` números entre `libres` (nunca incluye el #0 porque
 *   el número muerto no está entre los libres).
 * - Si se pidieron consecutivos y existe un bloque libre de ese tamaño, sortea
 *   uno de esos bloques; si no existe, asigna igualmente al azar y el resultado
 *   lo indica con `consecutivos: false`.
 *
 * Precondición (la valida el caso de uso): 1 <= cantidad <= libres.length.
 */
export function sortearNumeros(
  libres: number[],
  cantidad: number,
  quiereConsecutivos: boolean,
  aleatorio: () => number = Math.random,
): SorteoNumerosResult {
  const ordenados = [...libres].sort((a, b) => a - b);

  if (quiereConsecutivos) {
    const inicios = ordenados.filter(
      (n, i) => i + cantidad <= ordenados.length && ordenados[i + cantidad - 1] - n === cantidad - 1,
    );
    if (inicios.length > 0) {
      const inicio = inicios[Math.floor(aleatorio() * inicios.length)];
      return {
        numeros: Array.from({ length: cantidad }, (_, k) => inicio + k),
        consecutivos: true,
      };
    }
  }

  // Fisher-Yates parcial: los primeros `cantidad` quedan elegidos al azar
  const pool = [...ordenados];
  for (let i = 0; i < cantidad; i++) {
    const j = i + Math.floor(aleatorio() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const numeros = pool.slice(0, cantidad).sort((a, b) => a - b);

  return {
    numeros,
    consecutivos: numeros.every((n, i) => i === 0 || n === numeros[i - 1] + 1),
  };
}

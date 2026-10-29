import { describe, it, expect } from 'vitest';
import { sortearNumeros } from './sortear-numeros';

describe('sortearNumeros (BUG-P6)', () => {
  it('asigna exactamente la cantidad pedida, sin repetir y solo entre los libres', () => {
    const libres = [1, 3, 4, 7, 9];
    for (let intento = 0; intento < 50; intento++) {
      const { numeros } = sortearNumeros(libres, 3, false);
      expect(numeros).toHaveLength(3);
      expect(new Set(numeros).size).toBe(3);
      expect(numeros.every((n) => libres.includes(n))).toBe(true);
    }
  });

  it('con consecutivos y un bloque disponible, entrega un bloque seguido', () => {
    // Bloques posibles de 3: [3,4,5] y [7,8,9]; aleatorio 0.99 elige el último
    const res = sortearNumeros([1, 3, 4, 5, 7, 8, 9], 3, true, () => 0.99);

    expect(res).toEqual({ numeros: [7, 8, 9], consecutivos: true });
  });

  it('con consecutivos sin bloque disponible, asigna igual y marca que no son consecutivos', () => {
    const res = sortearNumeros([1, 3, 5, 7], 2, true, () => 0);

    expect(res.numeros).toHaveLength(2);
    expect(res.consecutivos).toBe(false);
  });

  it('nunca asigna el #0 porque el número muerto no está entre los libres', () => {
    for (let intento = 0; intento < 50; intento++) {
      expect(sortearNumeros([1, 2, 3], 3, false).numeros).toEqual([1, 2, 3]);
    }
  });
});

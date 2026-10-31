import { describe, it, expect } from 'vitest';
import { DrizzleTandaRepository } from '../src/tandas/infrastructure/adapters/out/database/drizzle-tanda.repository';
import { NumeroYaTomadoError } from '../src/tandas/domain/errors/numero.errors';

describe('[BE-TANDA] createNumbers ante un número tomado al mismo tiempo', () => {
  const repoQueFalla = (error: unknown) =>
    new DrizzleTandaRepository({
      insert: () => ({ values: () => Promise.reject(error) }),
    } as any);

  const datos = [3, 4].map((numberValue) => ({
    idTanda: 7,
    roundNumber: 1,
    numberValue,
    idUser: 30,
    isDeadNumber: false,
    status: 'PENDIENTE',
  }));

  it('nombra el número que Postgres reporta como duplicado', async () => {
    const pgError = {
      cause: {
        code: '23505',
        detail: 'Key (id_tanda, round_number, number_value)=(7, 1, 4) already exists.',
      },
    };

    const error = await repoQueFalla(pgError).createNumbers(datos).catch((e) => e);

    expect(error).toBeInstanceOf(NumeroYaTomadoError);
    expect(error.numero).toBe(4);
  });

  it('propaga otros errores de base de datos', async () => {
    await expect(repoQueFalla(new Error('conexión perdida')).createNumbers(datos)).rejects.toThrow(
      'conexión perdida',
    );
  });
});

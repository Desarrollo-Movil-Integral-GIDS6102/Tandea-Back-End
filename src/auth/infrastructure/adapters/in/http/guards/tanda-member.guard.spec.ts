import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { TandaMemberGuard } from './tanda-member.guard';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

describe('TandaMemberGuard (solo admin de tanda)', () => {
  let guard: TandaMemberGuard;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn(),
    };

    guard = new TandaMemberGuard(mockDb as unknown as NodePgDatabase);
  });

  const createContext = (user: any, params: any = {}, url = '/api/v1/pagos/10/confirmar'): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          params,
          url,
          raw: { url },
        }),
      }),
    } as unknown as ExecutionContext;
  };

  it('lanza ForbiddenException si no hay usuario autenticado', async () => {
    const ctx = createContext(null, { id: '10' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('permite el acceso irrestricto si el usuario tiene rol admin_global', async () => {
    const ctx = createContext({ idUser: 99, role: 'admin_global' }, { id: '10' });
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('permite el acceso si el usuario es el administrador (idAdmin) de la tanda del pago', async () => {
    const adminUser = { idUser: 5, role: 'usuario' };
    const ctx = createContext(adminUser, { id: '10' }, '/api/v1/pagos/10/confirmar');

    mockDb.limit.mockResolvedValue([{ idPayment: 10, idAdmin: 5 }]);

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('lanza ForbiddenException (403) si el usuario NO es el administrador de la tanda del pago', async () => {
    const regularUser = { idUser: 8, role: 'usuario' };
    const ctx = createContext(regularUser, { id: '10' }, '/api/v1/pagos/10/confirmar');

    mockDb.limit.mockResolvedValue([{ idPayment: 10, idAdmin: 5 }]);

    await expect(guard.canActivate(ctx)).rejects.toThrow(
      new ForbiddenException('Solo el administrador de la tanda puede realizar esta acción'),
    );
  });

  it('lanza ForbiddenException (403) en /rechazar si el usuario NO es el admin de la tanda', async () => {
    const regularUser = { idUser: 8, role: 'usuario' };
    const ctx = createContext(regularUser, { id: '10' }, '/api/v1/pagos/10/rechazar');

    mockDb.limit.mockResolvedValue([{ idPayment: 10, idAdmin: 5 }]);

    await expect(guard.canActivate(ctx)).rejects.toThrow(
      new ForbiddenException('Solo el administrador de la tanda puede realizar esta acción'),
    );
  });

  it('permite continuar si el pago no existe en BD para que el caso de uso lance 404', async () => {
    const anyUser = { idUser: 8, role: 'usuario' };
    const ctx = createContext(anyUser, { id: '999' }, '/api/v1/pagos/999/confirmar');

    mockDb.limit.mockResolvedValue([]);

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('permite el acceso si no hay parámetro de id en la ruta', async () => {
    const user = { idUser: 5, role: 'usuario' };
    const ctx = createContext(user, {}, '/api/v1/pagos');

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });
});

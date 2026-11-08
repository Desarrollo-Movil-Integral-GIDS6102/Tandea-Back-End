import { describe, it, expect, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { BandejaService } from './bandeja.service';
import type { NotificacionRepositoryPort } from '../../domain/ports/out/notificacion-repository.port';

const servicio = (repo: Partial<NotificacionRepositoryPort>) =>
  new BandejaService(repo as NotificacionRepositoryPort);

describe('BandejaService', () => {
  it('devuelve la bandeja del usuario con su contador de no leídas', async () => {
    const notificaciones = [{ idNotification: 1, isRead: false }];
    const repo = {
      listarDeUsuario: vi.fn().mockResolvedValue(notificaciones),
      contarNoLeidas: vi.fn().mockResolvedValue(1),
    };

    await expect(servicio(repo as never).listar(7)).resolves.toEqual({ noLeidas: 1, notificaciones });
    expect(repo.listarDeUsuario).toHaveBeenCalledWith(7, expect.any(Number));
    expect(repo.contarNoLeidas).toHaveBeenCalledWith(7);
  });

  it('marca como leída una notificación propia', async () => {
    const marcarLeida = vi.fn().mockResolvedValue(true);
    await servicio({ marcarLeida }).marcarLeida(5, 7);
    expect(marcarLeida).toHaveBeenCalledWith(5, 7);
  });

  it('responde 404 si la notificación no existe o es de otro usuario', async () => {
    const marcarLeida = vi.fn().mockResolvedValue(false);
    await expect(servicio({ marcarLeida }).marcarLeida(5, 7)).rejects.toBeInstanceOf(NotFoundException);
  });
});

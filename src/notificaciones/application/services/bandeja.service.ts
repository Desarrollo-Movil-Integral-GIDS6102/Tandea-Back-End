import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  NOTIFICACION_REPOSITORY_PORT,
  type NotificacionRepositoryPort,
} from '../../domain/ports/out/notificacion-repository.port';
import type { Bandeja, BandejaUseCasePort } from '../../domain/ports/in/bandeja-use-case.port';

// shortcut: la bandeja trae las últimas 100 sin paginar; agregar cursor si un usuario acumula más.
const LIMITE_BANDEJA = 100;

@Injectable()
export class BandejaService implements BandejaUseCasePort {
  constructor(
    @Inject(NOTIFICACION_REPOSITORY_PORT)
    private readonly repositorio: NotificacionRepositoryPort,
  ) {}

  async listar(idUser: number): Promise<Bandeja> {
    const [notificaciones, noLeidas] = await Promise.all([
      this.repositorio.listarDeUsuario(idUser, LIMITE_BANDEJA),
      this.repositorio.contarNoLeidas(idUser),
    ]);
    return { noLeidas, notificaciones };
  }

  async marcarLeida(idNotification: number, idUser: number): Promise<void> {
    // Una notificación ajena responde 404 igual que una inexistente, para no revelar que existe
    if (!(await this.repositorio.marcarLeida(idNotification, idUser))) {
      throw new NotFoundException(`La notificación ${idNotification} no existe`);
    }
  }
}

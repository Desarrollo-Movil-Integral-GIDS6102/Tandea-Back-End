import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  PagoConfirmadoEvent,
  PagoRechazadoEvent,
  PagoRegistradoEvent,
} from '../../../pagos/domain/ports/out/pago-events.port';
import {
  NOTIFICACION_REPOSITORY_PORT,
  TIPO_NOTIFICACION,
  type NotificacionRepositoryPort,
  type TipoNotificacion,
} from '../../domain/ports/out/notificacion-repository.port';
import {
  NOTIFICACION_PORT,
  type NotificacionPort,
} from '../../domain/ports/out/notificacion.port';

interface Aviso {
  idUser: number;
  idTanda: number;
  type: TipoNotificacion;
  titulo: string;
  mensaje: string;
  route: string;
}

/**
 * NotificacionesService — Reacciona a los eventos internos de Pagos.
 *
 * Por cada evento guarda la notificación en la bandeja (`notification`) y
 * después intenta el push. Si el push falla, la notificación ya quedó guardada
 * y el usuario la verá en la bandeja.
 *
 *  - pago.registrado → avisa al organizador que tiene un pago por revisar.
 *  - pago.confirmado → avisa al participante que su pago fue confirmado.
 *  - pago.rechazado  → avisa al participante el motivo del rechazo.
 */
@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger(NotificacionesService.name);

  constructor(
    @Inject(NOTIFICACION_REPOSITORY_PORT)
    private readonly repositorio: NotificacionRepositoryPort,
    @Inject(NOTIFICACION_PORT)
    private readonly push: NotificacionPort,
  ) {}

  async alRegistrarPago(evento: PagoRegistradoEvent): Promise<void> {
    const ctx = await this.buscarContexto(evento.paymentId);
    if (!ctx) return;

    // El organizador que paga su propio número no necesita avisarse a sí mismo
    if (ctx.idParticipante === ctx.idOrganizador) return;

    const quien = ctx.nombreParticipante ?? 'Un participante';
    await this.notificar({
      idUser: ctx.idOrganizador,
      idTanda: ctx.idTanda,
      type: TIPO_NOTIFICACION.PAGO_REGISTRADO,
      titulo: 'Nuevo pago por revisar',
      mensaje: `${quien} registró el pago del número ${ctx.numero} en la tanda "${ctx.nombreTanda}".`,
      route: `/pagos/${ctx.paymentId}/revisar`,
    });
  }

  async alConfirmarPago(evento: PagoConfirmadoEvent): Promise<void> {
    const ctx = await this.buscarContexto(evento.paymentId);
    if (!ctx?.idParticipante) return;

    await this.notificar({
      idUser: ctx.idParticipante,
      idTanda: ctx.idTanda,
      type: TIPO_NOTIFICACION.PAGO_CONFIRMADO,
      titulo: 'Pago confirmado',
      mensaje: `Tu pago del número ${ctx.numero} en la tanda "${ctx.nombreTanda}" fue confirmado.`,
      route: `/tandas/detalle/${ctx.idTanda}`,
    });
  }

  async alRechazarPago(evento: PagoRechazadoEvent): Promise<void> {
    const ctx = await this.buscarContexto(evento.paymentId);
    if (!ctx?.idParticipante) return;

    await this.notificar({
      idUser: ctx.idParticipante,
      idTanda: ctx.idTanda,
      type: TIPO_NOTIFICACION.PAGO_RECHAZADO,
      titulo: 'Pago rechazado',
      mensaje: `Tu pago del número ${ctx.numero} en la tanda "${ctx.nombreTanda}" fue rechazado: ${evento.motivo}`,
      route: `/tandas/detalle/${ctx.idTanda}`,
    });
  }

  private async buscarContexto(paymentId: number) {
    const ctx = await this.repositorio.buscarContextoPago(paymentId);
    if (!ctx) {
      this.logger.warn(`No se encontró el pago ${paymentId}; no se envía notificación.`);
    }
    return ctx;
  }

  private async notificar(aviso: Aviso): Promise<void> {
    await this.repositorio.guardar({
      idUser: aviso.idUser,
      idTanda: aviso.idTanda,
      type: aviso.type,
      message: aviso.mensaje,
    });

    try {
      await this.push.enviar(aviso.idUser, aviso.titulo, aviso.mensaje, {
        type: aviso.type,
        route: aviso.route,
      });
    } catch (error: unknown) {
      this.logger.warn(
        `No se pudo enviar el push ${aviso.type} al usuario ${aviso.idUser}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

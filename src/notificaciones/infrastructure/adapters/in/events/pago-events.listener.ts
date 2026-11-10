import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  PAGO_CONFIRMADO,
  PAGO_RECHAZADO,
  PAGO_REGISTRADO,
  type PagoConfirmadoEvent,
  type PagoRechazadoEvent,
  type PagoRegistradoEvent,
} from '../../../../../pagos/domain/ports/out/pago-events.port';
import { NotificacionesService } from '../../../../application/services/notificaciones.service';

/**
 * Adaptador de entrada: escucha los eventos internos de Pagos.
 *
 * Corre de forma asíncrona respecto a quien emite y nunca deja escapar un
 * error: el pago ya quedó guardado y un fallo aquí no debe afectarlo.
 */
@Injectable()
export class PagoEventsListener {
  private readonly logger = new Logger(PagoEventsListener.name);

  constructor(private readonly notificaciones: NotificacionesService) {}

  @OnEvent(PAGO_REGISTRADO, { async: true })
  async onPagoRegistrado(evento: PagoRegistradoEvent): Promise<void> {
    await this.ejecutar(PAGO_REGISTRADO, evento.paymentId, () =>
      this.notificaciones.alRegistrarPago(evento),
    );
  }

  @OnEvent(PAGO_CONFIRMADO, { async: true })
  async onPagoConfirmado(evento: PagoConfirmadoEvent): Promise<void> {
    await this.ejecutar(PAGO_CONFIRMADO, evento.paymentId, () =>
      this.notificaciones.alConfirmarPago(evento),
    );
  }

  @OnEvent(PAGO_RECHAZADO, { async: true })
  async onPagoRechazado(evento: PagoRechazadoEvent): Promise<void> {
    await this.ejecutar(PAGO_RECHAZADO, evento.paymentId, () =>
      this.notificaciones.alRechazarPago(evento),
    );
  }

  private async ejecutar(
    nombre: string,
    paymentId: number,
    accion: () => Promise<void>,
  ): Promise<void> {
    try {
      await accion();
    } catch (error: unknown) {
      this.logger.error(
        `Falló el manejo de ${nombre} del pago ${paymentId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

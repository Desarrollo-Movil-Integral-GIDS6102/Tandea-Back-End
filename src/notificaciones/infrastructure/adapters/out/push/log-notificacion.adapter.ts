import { Injectable, Logger } from '@nestjs/common';
import type { NotificacionPort } from '../../../../domain/ports/out/notificacion.port';

/**
 * Adaptador temporal de push: solo registra en el log que se habría enviado.
 *
 * Se reemplaza por NotificacionFcmAdapter (tarjeta INT-NOTIF) cambiando el
 * `useClass` de NOTIFICACION_PORT en NotificacionModule. Nunca registra tokens.
 */
@Injectable()
export class LogNotificacionAdapter implements NotificacionPort {
  private readonly logger = new Logger(LogNotificacionAdapter.name);

  async enviar(
    userId: number,
    titulo: string,
    _cuerpo: string,
    data?: Record<string, string>,
  ): Promise<void> {
    this.logger.log(
      `push (sin FCM) → usuario ${userId}: "${titulo}"${data?.route ? ` → ${data.route}` : ''}`,
    );
  }
}

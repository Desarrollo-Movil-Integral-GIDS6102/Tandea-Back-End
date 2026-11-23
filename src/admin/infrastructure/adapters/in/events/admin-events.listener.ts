import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MAIL_PORT, type MailPort } from '../../../../../common/ports/out/mail.port';
import { EmailTemplates } from '../../../../../common/templates/mail/email-templates';
import {
  DISPUTA_RESUELTA_EVENT,
  type DisputaResueltaEvent,
  USUARIO_SUSPENDIDO_EVENT,
  type UsuarioSuspendidoEvent,
} from '../../../../domain/ports/out/admin-events.port';

/**
 * [SP-4 INT-ADMIN] Adaptador de entrada: escucha los eventos de dominio del Administrador Global
 * (`usuario.suspendido` y `disputa.resuelta`) y envía correos electrónicos mediante `MailPort`.
 *
 * Corre de forma asíncrona y protege cada envío con `try/catch`: si el proveedor de correo
 * retorna `false` o lanza una excepción, lo registra en el `Logger` sin propagar el error ni
 * afectar la operación principal ya persistida en base de datos.
 */
@Injectable()
export class AdminEventsListener {
  private readonly logger = new Logger(AdminEventsListener.name);

  constructor(
    @Inject(MAIL_PORT)
    private readonly mailPort: MailPort,
  ) {}

  @OnEvent('usuario.suspendido', { async: true })
  async onUsuarioSuspendido(evento: UsuarioSuspendidoEvent): Promise<void> {
    try {
      const plantilla = EmailTemplates.userSuspended({
        name: evento.name,
        motivo: evento.motivo,
      });

      const enviado = await this.mailPort.sendMail({
        to: evento.email,
        subject: plantilla.subject,
        htmlContent: plantilla.html,
      });

      if (!enviado) {
        this.logger.error(
          `No se pudo enviar el correo de suspensión (${USUARIO_SUSPENDIDO_EVENT}) al usuario ${evento.idUser} (${evento.email})`,
        );
      }
    } catch (error: unknown) {
      this.logger.error(
        `Error al enviar correo de suspensión (${USUARIO_SUSPENDIDO_EVENT}) al usuario ${evento.idUser} (${evento.email}): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  @OnEvent('disputa.resuelta', { async: true })
  async onDisputaResuelta(evento: DisputaResueltaEvent): Promise<void> {
    try {
      const plantilla = EmailTemplates.disputeResolved({
        name: evento.nombreReporter,
        idDispute: evento.idDispute,
        nombreTanda: evento.nombreTanda,
        accion: evento.accion,
        notas: evento.notas,
      });

      const enviado = await this.mailPort.sendMail({
        to: evento.emailReporter,
        subject: plantilla.subject,
        htmlContent: plantilla.html,
      });

      if (!enviado) {
        this.logger.error(
          `No se pudo enviar el correo de disputa resuelta (${DISPUTA_RESUELTA_EVENT}) de la disputa #${evento.idDispute} a ${evento.emailReporter}`,
        );
      }
    } catch (error: unknown) {
      this.logger.error(
        `Error al enviar correo de disputa resuelta (${DISPUTA_RESUELTA_EVENT}) de la disputa #${evento.idDispute} a ${evento.emailReporter}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

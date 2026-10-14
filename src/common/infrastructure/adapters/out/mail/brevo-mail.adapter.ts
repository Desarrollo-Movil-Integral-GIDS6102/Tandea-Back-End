import { Injectable, Logger } from '@nestjs/common';
import { MailPort, SendEmailOptions, EmailRecipient } from '../../../../ports/out/mail.port';

@Injectable()
export class BrevoMailAdapter implements MailPort {
  private readonly logger = new Logger(BrevoMailAdapter.name);
  private readonly apiUrl = 'https://api.brevo.com/v3/smtp/email';

  async sendMail(options: SendEmailOptions): Promise<boolean> {
    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.BREVO_SENDER_EMAIL || 'notificaciones@tandea.app';
    const senderName = process.env.BREVO_SENDER_NAME || 'Tandea';

    if (!apiKey) {
      this.logger.warn('BREVO_API_KEY no configurada. Omitiendo envío de correo real.');
      return false;
    }

    // Normalizar lista de destinatarios
    const recipients: { email: string; name?: string }[] = Array.isArray(options.to)
      ? options.to.map((r) => (typeof r === 'string' ? { email: r } : r))
      : [{ email: options.to }];

    const payload = {
      sender: { name: senderName, email: senderEmail },
      to: recipients,
      subject: options.subject,
      htmlContent: options.htmlContent,
      textContent: options.textContent,
    };

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(`Fallo en Brevo API (Status ${response.status}): ${errorBody}`);
        return false;
      }

      this.logger.log(`Correo enviado exitosamente a: ${recipients.map((r) => r.email).join(', ')}`);
      return true;
    } catch (error: any) {
      // Regla de oro del proyecto: el fallo de correo NUNCA debe romper la API
      this.logger.error(`Error de red al conectar con Brevo API: ${error?.message || error}`);
      return false;
    }
  }
}

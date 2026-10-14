export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface SendEmailOptions {
  to: string | EmailRecipient[];
  subject: string;
  htmlContent: string;
  textContent?: string;
}

export interface MailPort {
  /**
   * Envía un correo genérico con asunto y contenido HTML/texto.
   * Retorna true si fue aceptado por el proveedor o false si falló de forma controlada.
   */
  sendMail(options: SendEmailOptions): Promise<boolean>;
}

export const MAIL_PORT = Symbol('MAIL_PORT');

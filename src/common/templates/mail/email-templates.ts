/**
 * Envoltorio HTML corporativo de Tandea para garantizar diseño premium uniforme.
 */
function layout(content: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #d6e1e7; overflow: hidden;">
      <div style="background: #0d2b3e; padding: 24px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 1px;">TANDEA</h1>
        <p style="color: #93aab6; margin: 4px 0 0; font-size: 13px;">Ahorro rotativo seguro y transparente</p>
      </div>
      <div style="padding: 32px 24px; color: #12303f; line-height: 1.6;">
        ${content}
      </div>
      <div style="background: #f3f7f9; padding: 16px 24px; text-align: center; font-size: 12px; color: #5a7280; border-top: 1px solid #d6e1e7;">
        © ${new Date().getFullYear()} Tandea Inc. Mensaje generado automáticamente.
      </div>
    </div>
  `;
}

export const EmailTemplates = {
  /**
   * Plantilla reutilizable de bienvenida tras registro exitoso
   */
  welcome(name: string): { subject: string; html: string } {
    return {
      subject: `¡Bienvenido a Tandea, ${name}! 🎉`,
      html: layout(`
        <h2 style="color: #1b4f72; margin-top: 0;">¡Hola, ${name}! 👋</h2>
        <p>Tu cuenta en <b>Tandea</b> ha sido creada exitosamente. Ya puedes crear tandas de ahorro con tus amigos o unirte a una mediante su código de invitación.</p>
        <div style="margin: 24px 0; text-align: center;">
          <a href="#" style="background: #1b4f72; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Comenzar ahora</a>
        </div>
        <p style="font-size: 14px; color: #5a7280;">Si no te has registrado en Tandea, puedes ignorar este mensaje.</p>
      `),
    };
  },

  /**
   * Plantilla reutilizable para invitar participantes a una tanda
   */
  inviteToTanda(tandaName: string, inviteCode: string, adminName: string): { subject: string; html: string } {
    return {
      subject: `Has sido invitado a la tanda "${tandaName}" en Tandea`,
      html: layout(`
        <h2 style="color: #1b4f72; margin-top: 0;">¡Únete a la tanda! 🤝</h2>
        <p><b>${adminName}</b> te ha invitado a formar parte de la tanda <b>${tandaName}</b>.</p>
        <div style="background: #eaf3fa; border: 2px dashed #1b4f72; border-radius: 8px; padding: 16px; text-align: center; margin: 20px 0;">
          <span style="font-size: 13px; color: #5a7280; display: block; margin-bottom: 4px;">CÓDIGO ÚNICO DE INVITACIÓN</span>
          <strong style="font-size: 28px; letter-spacing: 4px; color: #1b4f72;">${inviteCode}</strong>
        </div>
        <p>Ingresa a la aplicación, selecciona <i>Unirse a una tanda</i> e introduce este código para elegir tu número de cobro.</p>
      `),
    };
  },

  /**
   * Código de 6 dígitos para cambiar la contraseña desde el perfil
   */
  passwordCode(name: string, code: string, minutos: number): { subject: string; html: string } {
    return {
      subject: `Tu código para cambiar la contraseña: ${code}`,
      html: layout(`
        <h2 style="color: #1b4f72; margin-top: 0;">Hola, ${name} 🔐</h2>
        <p>Recibimos una solicitud para cambiar la contraseña de tu cuenta de <b>Tandea</b>. Usa este código en la aplicación:</p>
        <div style="background: #eaf3fa; border: 2px dashed #1b4f72; border-radius: 8px; padding: 16px; text-align: center; margin: 20px 0;">
          <strong style="font-size: 32px; letter-spacing: 8px; color: #1b4f72;">${code}</strong>
        </div>
        <p>El código vence en <b>${minutos} minutos</b> y solo se puede usar una vez.</p>
        <p style="font-size: 14px; color: #5a7280;">Si no fuiste tú, ignora este mensaje: tu contraseña no cambiará.</p>
      `),
    };
  },
};

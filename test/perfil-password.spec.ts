import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../src/auth/application/services/auth.service';
import { AuthUserEntity } from '../src/auth/domain/entities/auth-user.entity';

describe('[BE-AUTH] Cambio de contraseña con código de 6 dígitos', () => {
  const PASSWORD_ACTUAL = 'Girasol-Azul-2026';
  let repo: any;
  let mail: { sendMail: ReturnType<typeof vi.fn> };
  let service: AuthService;
  let user: AuthUserEntity;

  beforeEach(async () => {
    user = new AuthUserEntity(
      7, 'ana@ejemplo.com', await bcrypt.hash(PASSWORD_ACTUAL, 4), 'Ana', 'López', 1, 'usuario', true,
    );
    repo = {
      findById: vi.fn().mockResolvedValue(user),
      findByEmail: vi.fn().mockResolvedValue(user),
      findActivePasswordResetCode: vi.fn().mockResolvedValue(null),
      createPasswordResetCode: vi.fn(),
      incrementPasswordResetAttempts: vi.fn(),
      markPasswordResetCodeUsed: vi.fn(),
      updatePassword: vi.fn(),
    };
    mail = { sendMail: vi.fn().mockResolvedValue(true) };
    service = new AuthService(repo, mail as any, {} as any);
  });

  const codigoGuardado = async (codigo: string, extra: object = {}) => ({
    idCode: 1,
    codeHash: await bcrypt.hash(codigo, 4),
    attempts: 0,
    createdAt: new Date(Date.now() - 5 * 60_000),
    ...extra,
  });

  it('envía por correo un código de 6 dígitos y solo guarda su hash', async () => {
    await service.solicitarCodigoPassword(7);

    const html: string = mail.sendMail.mock.calls[0][0].htmlContent;
    const codigo = html.match(/>(\d{6})</)![1];
    const [, hashGuardado] = repo.createPasswordResetCode.mock.calls[0];
    expect(hashGuardado).not.toBe(codigo);
    expect(await bcrypt.compare(codigo, hashGuardado)).toBe(true);
  });

  it('no deja pedir otro código antes de un minuto', async () => {
    repo.findActivePasswordResetCode.mockResolvedValue(
      await codigoGuardado('123456', { createdAt: new Date() }),
    );

    await expect(service.solicitarCodigoPassword(7)).rejects.toThrow('Espera un minuto');
    expect(mail.sendMail).not.toHaveBeenCalled();
  });

  it('cambia la contraseña con el código correcto y lo marca como usado', async () => {
    repo.findActivePasswordResetCode.mockResolvedValue(await codigoGuardado('482913'));

    await service.cambiarPassword(7, '482913', 'Montaña-Verde-Lago');

    const [, nuevoHash] = repo.updatePassword.mock.calls[0];
    expect(await bcrypt.compare('Montaña-Verde-Lago', nuevoHash)).toBe(true);
    expect(repo.markPasswordResetCodeUsed).toHaveBeenCalledWith(1);
  });

  it('con código incorrecto suma un intento y no cambia nada', async () => {
    repo.findActivePasswordResetCode.mockResolvedValue(await codigoGuardado('482913'));

    await expect(service.cambiarPassword(7, '000000', 'Montaña-Verde-Lago')).rejects.toThrow(
      'El código es incorrecto',
    );
    expect(repo.incrementPasswordResetAttempts).toHaveBeenCalledWith(1);
    expect(repo.updatePassword).not.toHaveBeenCalled();
  });

  it('bloquea el código después de 5 intentos', async () => {
    repo.findActivePasswordResetCode.mockResolvedValue(
      await codigoGuardado('482913', { attempts: 5 }),
    );

    await expect(service.cambiarPassword(7, '482913', 'Montaña-Verde-Lago')).rejects.toThrow(
      'Demasiados intentos',
    );
  });

  it('rechaza código vencido o inexistente', async () => {
    await expect(service.cambiarPassword(7, '482913', 'Montaña-Verde-Lago')).rejects.toThrow(
      'expiró',
    );
  });

  it('recuperar: envía el código al correo registrado', async () => {
    await service.solicitarRecuperacion('ana@ejemplo.com');

    expect(mail.sendMail).toHaveBeenCalledOnce();
  });

  it('recuperar: con un correo desconocido no envía nada ni falla', async () => {
    repo.findByEmail.mockResolvedValue(null);

    await expect(service.solicitarRecuperacion('nadie@ejemplo.com')).resolves.toBeUndefined();
    expect(mail.sendMail).not.toHaveBeenCalled();
  });

  it('recuperar: si el correo falla no lo revela', async () => {
    mail.sendMail.mockResolvedValue(false);

    await expect(service.solicitarRecuperacion('ana@ejemplo.com')).resolves.toBeUndefined();
  });

  it('restablecer: cambia la contraseña con el código correcto', async () => {
    repo.findActivePasswordResetCode.mockResolvedValue(await codigoGuardado('482913'));

    await service.restablecerPassword('ana@ejemplo.com', '482913', 'Montaña-Verde-Lago');

    expect(repo.updatePassword).toHaveBeenCalledOnce();
    expect(repo.markPasswordResetCodeUsed).toHaveBeenCalledWith(1);
  });

  it('restablecer: un correo desconocido responde igual que un código inválido', async () => {
    repo.findByEmail.mockResolvedValue(null);

    await expect(
      service.restablecerPassword('nadie@ejemplo.com', '482913', 'Montaña-Verde-Lago'),
    ).rejects.toThrow('El código expiró o no existe');
  });
});

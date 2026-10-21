import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { ZodError } from 'zod';
import { AuthController } from '../src/auth/infrastructure/adapters/in/http/controllers/auth.controller';
import { AuthService } from '../src/auth/application/services/auth.service';
import { AuthUserRepositoryPort } from '../src/auth/domain/ports/out/auth-user-repository.port';
import { AuthUserEntity } from '../src/auth/domain/entities/auth-user.entity';
import {
  PASSWORD_MIN_LENGTH,
  zRegisterDto,
} from '../src/auth/application/dtos/register.dto';
import {
  PASSWORD_MESSAGES,
  validatePassword,
} from '../src/auth/domain/policies/password-policy';
import { ZodValidationExceptionFilter } from '../src/common/filters/zod-validation.filter';

/**
 * [SP-2-Bug] Validaciones del endpoint POST /api/v1/auth/register.
 * Usa el AuthService real con repositorio y JwtService simulados para
 * comprobar que una solicitud inválida no crea usuarios ni emite tokens.
 */
describe('[SP-2-Bug] Registro - Validaciones de entrada', () => {
  let controller: AuthController;
  let repo: AuthUserRepositoryPort;
  let jwt: { sign: ReturnType<typeof vi.fn> };

  const validBody = {
    email: 'nuevo@ejemplo.com',
    password: 'Lluvia tibia sobre Oaxaca',
    name: 'Juan',
    lastName: 'Pérez',
    age: 28,
    gender: 'M',
  };

  const getIssues = (body: unknown) => {
    const result = zRegisterDto.safeParse(body);
    expect(result.success).toBe(false);
    return result.success ? [] : result.error.errors;
  };

  const expectRejected = async (body: unknown, field: string) => {
    const error = await controller.register(body).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ZodError);
    const fields = (error as ZodError).errors.map((e) => e.path.join('.'));
    expect(fields).toContain(field);
    expect(repo.findByEmail).not.toHaveBeenCalled();
    expect(repo.createUser).not.toHaveBeenCalled();
    expect(jwt.sign).not.toHaveBeenCalled();
  };

  beforeEach(() => {
    repo = {
      findByEmail: vi.fn().mockResolvedValue(null),
      findById: vi.fn(),
      findRoleByName: vi.fn().mockResolvedValue({ idRole: 1, nameRole: 'usuario' }),
      createUser: vi
        .fn()
        .mockResolvedValue(
          new AuthUserEntity(1, 'nuevo@ejemplo.com', 'hash', 'Juan', 'Pérez', 1, 'usuario', true, 28, 'M'),
        ),
    };
    jwt = { sign: vi.fn().mockReturnValue('mock.jwt.token') };
    const mail: any = { sendMail: vi.fn().mockResolvedValue(true) };
    const service = new AuthService(repo, mail, jwt as any);
    controller = new AuthController(service, service);
  });

  it('registra exitosamente con datos válidos y no expone contraseña ni hash', async () => {
    const result = await controller.register(validBody);
    expect(result.access_token).toBe('mock.jwt.token');
    expect(result.user.email).toBe('nuevo@ejemplo.com');
    expect(repo.createUser).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toMatch(/password|hash/i);
  });

  it('acepta registro sin campos opcionales (age, gender)', async () => {
    const { age: _a, gender: _g, ...body } = validBody;
    await expect(controller.register(body)).resolves.toBeDefined();
  });

  it('recorta espacios laterales en email, name y lastName', () => {
    const dto = zRegisterDto.parse({
      ...validBody,
      email: '  nuevo@ejemplo.com ',
      name: ' Juan ',
      lastName: ' Pérez ',
    });
    expect(dto.email).toBe('nuevo@ejemplo.com');
    expect(dto.name).toBe('Juan');
    expect(dto.lastName).toBe('Pérez');
  });

  it('no recorta la contraseña', () => {
    expect(
      zRegisterDto.parse({ ...validBody, password: ' Lluvia tibia sobre Oaxaca ' })
        .password,
    ).toBe(' Lluvia tibia sobre Oaxaca ');
  });

  it.each(['no-es-correo', 'a@', '@b.com', 'a b@c.com'])(
    'rechaza correo con formato inválido: %s',
    async (email) => {
      await expectRejected({ ...validBody, email }, 'email');
      expect(getIssues({ ...validBody, email })[0].message).toBe(
        'El formato del correo electrónico no es válido',
      );
    },
  );

  it.each(['', '   '])('rechaza correo vacío (%j)', async (email) => {
    await expectRejected({ ...validBody, email }, 'email');
    expect(getIssues({ ...validBody, email })[0].message).toBe(
      'El correo electrónico es requerido',
    );
  });

  it('rechaza contraseña menor a la longitud mínima', async () => {
    const password = 'Tr0mpo ';
    expect(password.length).toBe(PASSWORD_MIN_LENGTH - 1);
    await expectRejected({ ...validBody, password }, 'password');
    expect(getIssues({ ...validBody, password }).map((i) => i.message)).toContain(
      PASSWORD_MESSAGES.tooShort,
    );
  });

  it('acepta contraseña con exactamente la longitud mínima', () => {
    expect(
      zRegisterDto.safeParse({ ...validBody, password: 'Tr0mpo v' }).success,
    ).toBe(true);
  });

  it('rechaza contraseña vacía', async () => {
    await expectRejected({ ...validBody, password: '' }, 'password');
    expect(getIssues({ ...validBody, password: '' })[0].message).toBe(
      'La contraseña es requerida',
    );
  });

  describe('Política de contraseñas seguras', () => {
    it('permite registrar contraseñas robustas (frases de contraseña y combinaciones variadas)', async () => {
      const robustPasswords = [
        'Lluvia tibia sobre Oaxaca',
        'C4fe_con_p4n_d3_muert0',
        'Tres tristes tigres tragaban',
      ];
      for (const password of robustPasswords) {
        const result = await controller.register({ ...validBody, password });
        expect(result.access_token).toBe('mock.jwt.token');
      }
    });

    it('rechaza contraseñas formadas exclusivamente por números (ej. 123456789)', async () => {
      await expectRejected({ ...validBody, password: '123456789' }, 'password');
      const messages = getIssues({ ...validBody, password: '123456789' }).map(
        (i) => i.message,
      );
      expect(messages).toContain(PASSWORD_MESSAGES.onlyDigits);
    });

    it('rechaza patrones repetitivos triviales (ej. aaaaaaaaaaaa)', async () => {
      await expectRejected({ ...validBody, password: 'aaaaaaaaaaaa' }, 'password');
      const messages = getIssues({ ...validBody, password: 'aaaaaaaaaaaa' }).map(
        (i) => i.message,
      );
      expect(messages).toContain(PASSWORD_MESSAGES.repetitive);
    });

    it('rechaza secuencias alfabéticas y predecibles (ej. abcdefghi123)', async () => {
      await expectRejected({ ...validBody, password: 'abcdefghi123' }, 'password');
      const messages = getIssues({ ...validBody, password: 'abcdefghi123' }).map(
        (i) => i.message,
      );
      expect(messages).toContain(PASSWORD_MESSAGES.sequential);
    });

    it('rechaza contraseñas comunes o comprometidas (ej. password123)', async () => {
      await expectRejected({ ...validBody, password: 'password123' }, 'password');
      const messages = getIssues({ ...validBody, password: 'password123' }).map(
        (i) => i.message,
      );
      expect(messages).toContain(PASSWORD_MESSAGES.common);
    });

    it('rechaza contraseñas que contienen información personal del usuario', async () => {
      const passwordsWithInfo = [
        'mi_nombre_es_Juan_123',
        'apellido_Pérez_2026!',
        'nuevo_usuario_secreto',
      ];
      for (const password of passwordsWithInfo) {
        await expectRejected({ ...validBody, password }, 'password');
        const messages = getIssues({ ...validBody, password }).map(
          (i) => i.message,
        );
        expect(messages).toContain(PASSWORD_MESSAGES.personalInfo);
      }
    });

    it('validador de dominio puro validatePassword() reporta correctamente cada regla', () => {
      expect(validatePassword('123456789')).toContain(PASSWORD_MESSAGES.onlyDigits);
      expect(validatePassword('aaaaaaaaaaaa')).toContain(PASSWORD_MESSAGES.repetitive);
      expect(validatePassword('abcdefghi123')).toContain(PASSWORD_MESSAGES.sequential);
      expect(validatePassword('password123')).toContain(PASSWORD_MESSAGES.common);
      expect(
        validatePassword('clave_con_juan_aqui', { name: 'Juan' }),
      ).toContain(PASSWORD_MESSAGES.personalInfo);
      expect(validatePassword('Lluvia tibia sobre Oaxaca')).toHaveLength(0);
    });
  });

  it.each(['email', 'password', 'name', 'lastName'])(
    'rechaza cuando se omite el campo obligatorio %s',
    async (field) => {
      const body: Record<string, unknown> = { ...validBody };
      delete body[field];
      await expectRejected(body, field);
      expect(getIssues(body)[0].code).toBe('invalid_type');
    },
  );

  it.each([
    ['name', ''],
    ['name', '   '],
    ['lastName', ''],
    ['lastName', '   '],
  ])('rechaza %s vacío o solo espacios (%j)', async (field, value) => {
    await expectRejected({ ...validBody, [field]: value }, field);
  });

  it.each([
    ['email', 123],
    ['password', 12345678],
    ['name', 42],
    ['lastName', true],
    ['age', '28'],
    ['age', 28.5],
    ['age', 17],
    ['gender', 1],
  ])('rechaza tipo/valor incorrecto en %s (%j)', async (field, value) => {
    await expectRejected({ ...validBody, [field]: value }, field);
  });

  it('rechaza cuerpos que no son objetos', async () => {
    for (const body of [null, undefined, 'texto', []]) {
      const error = await controller.register(body).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ZodError);
    }
    expect(repo.createUser).not.toHaveBeenCalled();
    expect(jwt.sign).not.toHaveBeenCalled();
  });

  it('el filtro global transforma el error en HTTP 422 con el contrato esperado', () => {
    const result = zRegisterDto.safeParse({
      ...validBody,
      email: 'malo',
      password: '123',
    });
    expect(result.success).toBe(false);
    if (result.success) return;

    const send = vi.fn();
    const status = vi.fn().mockReturnValue({ send });
    const host = {
      switchToHttp: () => ({ getResponse: () => ({ status }) }),
    } as unknown as ArgumentsHost;

    new ZodValidationExceptionFilter().catch(result.error, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
    const payload = send.mock.calls[0][0];
    expect(payload).toEqual({
      statusCode: 422,
      error: 'Unprocessable Entity',
      message: 'Error de validación en los datos enviados',
      details: expect.arrayContaining([
        expect.objectContaining({
          field: 'email',
          code: expect.any(String),
          message: expect.any(String),
        }),
        expect.objectContaining({
          field: 'password',
          code: expect.any(String),
          message: expect.any(String),
        }),
      ]),
    });
    expect(JSON.stringify(payload)).not.toContain('123');
  });
});

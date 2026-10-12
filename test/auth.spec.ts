import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../src/auth/application/services/auth.service';
import { AuthUserEntity } from '../src/auth/domain/entities/auth-user.entity';
import { AuthUserRepositoryPort } from '../src/auth/domain/ports/out/auth-user-repository.port';
import { AuthController } from '../src/auth/infrastructure/adapters/in/http/controllers/auth.controller';
import { RolesGuard } from '../src/auth/infrastructure/adapters/in/http/guards/roles.guard';
import { JwtStrategy } from '../src/auth/infrastructure/adapters/in/http/strategies/jwt.strategy';

describe('[BE-AUTH] Servicio de Autenticación y Login', () => {
  let authService: AuthService;
  let mockUserRepo: AuthUserRepositoryPort;
  let mockJwtService: any;

  beforeEach(() => {
    mockUserRepo = {
      findByEmail: vi.fn(),
      findById: vi.fn(),
      findRoleByName: vi.fn(),
      createUser: vi.fn(),
    };

    mockJwtService = {
      sign: vi.fn().mockReturnValue('mock.jwt.token'),
    };

    authService = new AuthService(mockUserRepo, mockJwtService);
  });

  it('debe validar credenciales correctamente con bcrypt.compare', async () => {
    const password = 'Password123!';
    const passwordHash = await bcrypt.hash(password, 10);
    const mockUser = new AuthUserEntity(
      1,
      'test@tandea.com',
      passwordHash,
      'Juan',
      'Perez',
      1,
      'usuario',
      true,
    );

    vi.spyOn(mockUserRepo, 'findByEmail').mockResolvedValue(mockUser);

    const validated = await authService.validateUser(
      'test@tandea.com',
      password,
    );
    expect(validated).toBeDefined();
    expect(validated.email).toBe('test@tandea.com');
  });

  it('debe lanzar UnauthorizedException (401) si el usuario no existe', async () => {
    vi.spyOn(mockUserRepo, 'findByEmail').mockResolvedValue(null);

    await expect(
      authService.validateUser('desconocido@tandea.com', '12345678'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('debe lanzar UnauthorizedException (401) si la contraseña es incorrecta', async () => {
    const passwordHash = await bcrypt.hash('Correcta123!', 10);
    const mockUser = new AuthUserEntity(
      1,
      'test@tandea.com',
      passwordHash,
      'Juan',
      'Perez',
      1,
      'usuario',
      true,
    );

    vi.spyOn(mockUserRepo, 'findByEmail').mockResolvedValue(mockUser);

    await expect(
      authService.validateUser('test@tandea.com', 'Incorrecta123!'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('debe rechazar con 403 ForbiddenException si active = false', async () => {
    const password = 'Password123!';
    const passwordHash = await bcrypt.hash(password, 10);
    const inactiveUser = new AuthUserEntity(
      1,
      'inactivo@tandea.com',
      passwordHash,
      'Inactivo',
      'User',
      1,
      'usuario',
      false, // inactivo / suspendido
    );

    vi.spyOn(mockUserRepo, 'findByEmail').mockResolvedValue(inactiveUser);

    await expect(
      authService.validateUser('inactivo@tandea.com', password),
    ).rejects.toThrow(ForbiddenException);
  });

  it('debe firmar el token JWT con { sub, role } en el login', async () => {
    const mockUser = new AuthUserEntity(
      42,
      'admin@tandea.com',
      'hash',
      'Admin',
      'Global',
      2,
      'admin_global',
      true,
    );

    const result = await authService.login(mockUser);

    expect(mockJwtService.sign).toHaveBeenCalledWith({
      sub: 42,
      email: 'admin@tandea.com',
      role: 'admin_global',
    });

    expect(result.access_token).toBe('mock.jwt.token');
    expect(result.user.idUser).toBe(42);
    expect(result.user.role).toBe('admin_global');
  });

  it('debe registrar un usuario exitosamente, hasheando password y generando token JWT', async () => {
    const findByEmailSpy = vi.spyOn(mockUserRepo, 'findByEmail').mockResolvedValue(null);
    vi.spyOn(mockUserRepo, 'findRoleByName').mockResolvedValue({
      idRole: 1,
      nameRole: 'usuario',
    });

    const createdUser = new AuthUserEntity(
      10,
      'nuevo@tandea.com',
      'hashed_password',
      'Carlos',
      'Santana',
      1,
      'usuario',
      true,
      30,
      'M',
    );
    const createUserSpy = vi.spyOn(mockUserRepo, 'createUser').mockResolvedValue(createdUser);

    const result = await authService.register({
      email: 'nuevo@tandea.com',
      password: 'Password123!',
      name: 'Carlos',
      lastName: 'Santana',
      age: 30,
      gender: 'M',
    });

    expect(findByEmailSpy).toHaveBeenCalledWith('nuevo@tandea.com');
    expect(createUserSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'nuevo@tandea.com',
        name: 'Carlos',
        lastName: 'Santana',
        age: 30,
        gender: 'M',
        idRole: 1,
      }),
    );
    expect(mockJwtService.sign).toHaveBeenCalledWith({
      sub: 10,
      email: 'nuevo@tandea.com',
      role: 'usuario',
    });
    expect(result.access_token).toBe('mock.jwt.token');
    expect(result.user.idUser).toBe(10);
    expect(result.user.email).toBe('nuevo@tandea.com');
    expect(result.user.name).toBe('Carlos');
    expect(result.user.lastName).toBe('Santana');
    expect(result.user.role).toBe('usuario');
    expect(result.user.age).toBe(30);
    expect(result.user.gender).toBe('M');
  });

  it('debe lanzar ConflictException (409) al registrar si el correo ya existe', async () => {
    const existingUser = new AuthUserEntity(
      5,
      'existente@tandea.com',
      'hash',
      'Juan',
      'Perez',
      1,
      'usuario',
      true,
    );
    vi.spyOn(mockUserRepo, 'findByEmail').mockResolvedValue(existingUser);

    await expect(
      authService.register({
        email: 'existente@tandea.com',
        password: 'Password123!',
        name: 'Otro',
        lastName: 'Usuario',
      }),
    ).rejects.toThrow(ConflictException);
  });
});

describe('[BE-AUTH] AuthController - Registro', () => {
  let authController: AuthController;
  let mockLoginPort: any;
  let mockRegisterPort: any;

  beforeEach(() => {
    mockLoginPort = {
      validateUser: vi.fn(),
      login: vi.fn(),
    };
    mockRegisterPort = {
      register: vi.fn(),
    };
    authController = new AuthController(mockLoginPort, mockRegisterPort);
  });

  it('debe registrar usuario con DTO válido a través de POST /register', async () => {
    mockRegisterPort.register.mockResolvedValue({
      access_token: 'jwt.mock.token',
      user: {
        idUser: 1,
        email: 'nuevo@ejemplo.com',
        name: 'Juan',
        lastName: 'Pérez',
        role: 'usuario',
        age: 28,
        gender: 'M',
      },
    });

    const body = {
      email: 'nuevo@ejemplo.com',
      password: 'PasswordSeguro123!',
      name: 'Juan',
      lastName: 'Pérez',
      age: 28,
      gender: 'M',
    };

    const result = await authController.register(body);
    expect(result.access_token).toBe('jwt.mock.token');
    expect(result.user.idUser).toBe(1);
    expect(result.user.email).toBe('nuevo@ejemplo.com');
  });

  it('debe rechazar registro con correo inválido con ZodError', async () => {
    const invalidBody = {
      email: 'no-es-correo',
      password: '123',
      name: '',
      lastName: '',
    };

    await expect(authController.register(invalidBody)).rejects.toThrow();
  });
});

describe('[BE-AUTH] Guards de Acceso por Rol (RolesGuard & JwtStrategy)', () => {
  let reflector: Reflector;
  let rolesGuard: RolesGuard;

  beforeEach(() => {
    reflector = new Reflector();
    rolesGuard = new RolesGuard(reflector);
  });

  const createMockContext = (user: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };

  it('debe permitir acceso si la ruta no tiene roles requeridos', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = createMockContext({ role: 'usuario' });

    expect(rolesGuard.canActivate(context)).toBe(true);
  });

  it('debe permitir acceso si el rol del usuario coincide con el rol requerido', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin_global']);
    const context = createMockContext({ idUser: 1, role: 'admin_global' });

    expect(rolesGuard.canActivate(context)).toBe(true);
  });

  it('debe denegar con 403 Forbidden si el rol no coincide', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin_global']);
    const context = createMockContext({ idUser: 2, role: 'usuario' });

    expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('debe denegar con 403 Forbidden si el usuario no tiene rol o no está autenticado', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['usuario']);
    const context = createMockContext(null);

    expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('JwtStrategy debe mapear el payload sub a idUser y extraer role', async () => {
    const jwtStrategy = new JwtStrategy();
    const result = await jwtStrategy.validate({
      sub: 10,
      email: 'usuario@tandea.com',
      role: 'usuario',
    });

    expect(result).toEqual({
      idUser: 10,
      email: 'usuario@tandea.com',
      role: 'usuario',
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  UnauthorizedException,
  ForbiddenException,
  ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../src/auth/application/services/auth.service';
import { AuthUserEntity } from '../src/auth/domain/entities/auth-user.entity';
import { AuthUserRepositoryPort } from '../src/auth/domain/ports/out/auth-user-repository.port';
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

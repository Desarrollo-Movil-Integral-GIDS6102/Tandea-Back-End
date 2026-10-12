import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as bcrypt from 'bcrypt';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { AuthService } from '../src/auth/application/services/auth.service';
import { AuthUserEntity } from '../src/auth/domain/entities/auth-user.entity';
import { AuthUserRepositoryPort } from '../src/auth/domain/ports/out/auth-user-repository.port';
import { RolesGuard } from '../src/auth/infrastructure/adapters/in/http/guards/roles.guard';
import { JwtStrategy } from '../src/auth/infrastructure/adapters/in/http/strategies/jwt.strategy';
import { RegisterDto } from '../src/auth/application/dtos/register.dto';
import { AuthController } from '../src/auth/infrastructure/adapters/in/http/controllers/auth.controller';

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
});

describe('[BE-AUTH] Registro de Usuario con Contraseña Cifrada (POST /api/v1/auth/register)', () => {
  let authService: AuthService;
  let mockUserRepo: AuthUserRepositoryPort;
  let mockJwtService: any;
  let mockCreateUser: any;

  beforeEach(() => {
    mockCreateUser = vi.fn();
    mockUserRepo = {
      findByEmail: vi.fn(),
      findById: vi.fn(),
      findRoleByName: vi.fn(),
      createUser: mockCreateUser,
    };

    mockJwtService = {
      sign: vi.fn().mockReturnValue('mock.jwt.token'),
    };

    authService = new AuthService(mockUserRepo, mockJwtService);
  });

  it('debe registrar un nuevo usuario con hash bcrypt (10 rounds) y rol usuario', async () => {
    const dto: RegisterDto = {
      email: 'nuevo@tandea.com',
      password: 'MiPasswordSeguro123!',
      name: 'Maria',
      lastName: 'Lopez',
    };

    vi.spyOn(mockUserRepo, 'findByEmail').mockResolvedValue(null);
    vi.spyOn(mockUserRepo, 'findRoleByName').mockResolvedValue({
      idRole: 1,
      nameRole: 'usuario',
    });

    let createdUserData: any;
    mockCreateUser.mockImplementation(async (data: any) => {
      createdUserData = data;
      return new AuthUserEntity(
        100,
        data.email,
        data.passwordHash,
        data.name,
        data.lastName,
        data.idRole,
        'usuario',
        true,
      );
    });

    const result = await authService.register(dto);

    // 1. Validar que la contraseña fue hasheada con bcrypt usando 10 rounds
    expect(createdUserData.passwordHash).not.toBe(dto.password);
    expect(await bcrypt.compare(dto.password, createdUserData.passwordHash)).toBe(true);
    expect(bcrypt.getRounds(createdUserData.passwordHash)).toBe(10);

    // 2. Validar que se asignó el rol 'usuario' (idRole: 1)
    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'nuevo@tandea.com',
        idRole: 1,
        active: true,
      }),
    );

    // 3. Validar datos retornados
    expect(result).toBeDefined();
    expect(result.idUser).toBe(100);
    expect(result.email).toBe('nuevo@tandea.com');
    expect(result.role).toBe('usuario');
  });

  it('NUNCA debe devolver password_hash ni contraseñas en el resultado', async () => {
    const dto: RegisterDto = {
      email: 'seguro@tandea.com',
      password: 'PasswordSuperSeguro123!',
    };

    vi.spyOn(mockUserRepo, 'findByEmail').mockResolvedValue(null);
    vi.spyOn(mockUserRepo, 'findRoleByName').mockResolvedValue({
      idRole: 1,
      nameRole: 'usuario',
    });
    mockCreateUser.mockImplementation(async (data: any) => {
      return new AuthUserEntity(
        101,
        data.email,
        data.passwordHash,
        data.name,
        data.lastName,
        data.idRole,
        'usuario',
        true,
      );
    });

    const result = await authService.register(dto);

    // Verificar explícitamente que no exista ninguna propiedad sensible
    expect(result).not.toHaveProperty('password_hash');
    expect(result).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('password');
    expect((result as any).password_hash).toBeUndefined();
    expect((result as any).passwordHash).toBeUndefined();
  });

  it('debe lanzar ConflictException (409) si el correo ya existe', async () => {
    const dto: RegisterDto = {
      email: 'existente@tandea.com',
      password: 'Password123!',
    };

    const existingUser = new AuthUserEntity(
      5,
      'existente@tandea.com',
      'hash_existente',
      'Existente',
      'Usuario',
      1,
      'usuario',
      true,
    );

    vi.spyOn(mockUserRepo, 'findByEmail').mockResolvedValue(existingUser);

    await expect(authService.register(dto)).rejects.toThrow(ConflictException);
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it('debe registrar un nuevo usuario con edad y género cuando se proporcionen', async () => {
    const dto: RegisterDto = {
      email: 'completo@tandea.com',
      password: 'MiPasswordSeguro123!',
      name: 'Laura',
      lastName: 'Gomez',
      age: 28,
      gender: 'femenino',
    };

    vi.spyOn(mockUserRepo, 'findByEmail').mockResolvedValue(null);
    vi.spyOn(mockUserRepo, 'findRoleByName').mockResolvedValue({
      idRole: 1,
      nameRole: 'usuario',
    });

    mockCreateUser.mockImplementation(async (data: any) => {
      return new AuthUserEntity(
        102,
        data.email,
        data.passwordHash,
        data.name,
        data.lastName,
        data.idRole,
        'usuario',
        true,
        data.age,
        data.gender,
      );
    });

    const result = await authService.register(dto);

    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'completo@tandea.com',
        age: 28,
        gender: 'femenino',
      }),
    );

    expect(result.age).toBe(28);
    expect(result.gender).toBe('femenino');
    expect(result).not.toHaveProperty('password_hash');
  });

  it('debe validar class-validator en RegisterDto (@IsEmail, @MinLength(8)) y campos opcionales', async () => {
    // Caso 1: Email inválido
    const invalidEmailDto = plainToInstance(RegisterDto, {
      email: 'correo-no-valido',
      password: 'PasswordValido123',
    });
    const errorsEmail = await validate(invalidEmailDto);
    expect(errorsEmail.length).toBeGreaterThan(0);
    expect(errorsEmail.some((e) => e.property === 'email')).toBe(true);

    // Caso 2: Contraseña menor a 8 caracteres (< 8)
    const shortPasswordDto = plainToInstance(RegisterDto, {
      email: 'valido@tandea.com',
      password: '1234567', // 7 caracteres
    });
    const errorsPass = await validate(shortPasswordDto);
    expect(errorsPass.length).toBeGreaterThan(0);
    expect(errorsPass.some((e) => e.property === 'password')).toBe(true);

    // Caso 3: Edad menor de 18 años (< 18)
    const minorAgeDto = plainToInstance(RegisterDto, {
      email: 'valido@tandea.com',
      password: 'PasswordValido123',
      age: 16,
    });
    const errorsAge = await validate(minorAgeDto);
    expect(errorsAge.length).toBeGreaterThan(0);
    expect(errorsAge.some((e) => e.property === 'age')).toBe(true);

    // Caso 4: DTO completamente válido con edad y género
    const validDto = plainToInstance(RegisterDto, {
      email: 'valido@tandea.com',
      password: 'Password1234', // 12 caracteres
      name: 'Laura',
      lastName: 'Gomez',
      age: 25,
      gender: 'femenino',
    });
    const errorsValid = await validate(validDto);
    expect(errorsValid.length).toBe(0);
  });

  it('el controlador AuthController debe delegar a authService.register y responder', async () => {
    const controller = new AuthController(authService);
    const dto: RegisterDto = {
      email: 'controller@tandea.com',
      password: 'Password123!',
      name: 'Carlos',
      lastName: 'Santana',
    };

    const expectedResponse = {
      idUser: 77,
      email: 'controller@tandea.com',
      name: 'Carlos',
      lastName: 'Santana',
      role: 'usuario',
      active: true,
    };

    vi.spyOn(authService, 'register').mockResolvedValue(expectedResponse);

    const response = await controller.register(dto);
    expect(response).toEqual(expectedResponse);
    expect(response).not.toHaveProperty('password_hash');
    expect(response).not.toHaveProperty('passwordHash');
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

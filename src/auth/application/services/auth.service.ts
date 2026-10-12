import {
  Injectable,
  Inject,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import {
  type LoginUseCasePort,
  type LoginResult,
} from '../../domain/ports/in/login-use-case.port';
import {
  type RegisterUseCasePort,
  type RegisterCommand,
  type RegisterResult,
} from '../../domain/ports/in/register-use-case.port';
import {
  AUTH_USER_REPOSITORY_PORT,
  type AuthUserRepositoryPort,
} from '../../domain/ports/out/auth-user-repository.port';
import { AuthUserEntity } from '../../domain/entities/auth-user.entity';

@Injectable()
export class AuthService implements LoginUseCasePort, RegisterUseCasePort {
  constructor(
    @Inject(AUTH_USER_REPOSITORY_PORT)
    private readonly userRepository: AuthUserRepositoryPort,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Valida credenciales de usuario con bcrypt.
   * Rechaza con 401 si no existe o la contraseña no coincide.
   * Rechaza con 403 si el usuario está inactivo (active = false).
   */
  async validateUser(email: string, pass: string): Promise<AuthUserEntity> {
    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isMatch = await bcrypt.compare(pass, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!user.active) {
      throw new ForbiddenException(
        'El usuario se encuentra inactivo o suspendido',
      );
    }

    return user;
  }

  /**
   * Genera el token JWT firmado con { sub: user.idUser, email: user.email, role: user.role }
   * Expiración: 1 día (configurado en JwtModule).
   */
  async login(user: AuthUserEntity): Promise<LoginResult> {
    const payload = {
      sub: user.idUser,
      email: user.email,
      role: user.role,
    };

    const token = this.jwtService.sign(payload);

    return {
      access_token: token,
      user: {
        idUser: user.idUser,
        email: user.email,
        name: user.name,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  /**
   * Registra un nuevo usuario con rol por defecto 'usuario'.
   * 1. Verifica si el email ya existe (409 ConflictException).
   * 2. Hashea la contraseña con bcrypt (10 rondas de salt).
   * 3. Asigna el rol 'usuario'.
   * 4. Persiste en la base de datos mediante Drizzle ORM.
   * 5. Emite y retorna el token JWT y los datos del nuevo usuario.
   */
  async register(command: RegisterCommand): Promise<RegisterResult> {
    const existing = await this.userRepository.findByEmail(command.email);
    if (existing) {
      throw new ConflictException('El correo electrónico ya está registrado');
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(command.password, saltRounds);

    let role = await this.userRepository.findRoleByName('usuario');
    if (!role) {
      role = { idRole: 1, nameRole: 'usuario' };
    }

    const newUser = await this.userRepository.createUser({
      email: command.email,
      passwordHash,
      name: command.name,
      lastName: command.lastName,
      age: command.age ?? null,
      gender: command.gender ?? null,
      idRole: role.idRole,
    });

    const payload = {
      sub: newUser.idUser,
      email: newUser.email,
      role: newUser.role,
    };

    const token = this.jwtService.sign(payload);

    return {
      access_token: token,
      user: {
        idUser: newUser.idUser,
        email: newUser.email,
        name: newUser.name,
        lastName: newUser.lastName,
        role: newUser.role,
        age: newUser.age ?? null,
        gender: newUser.gender ?? null,
      },
    };
  }
}

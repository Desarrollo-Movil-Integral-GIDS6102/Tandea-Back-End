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
} from '../../domain/ports/in/register-use-case.port';
import {
  AUTH_USER_REPOSITORY_PORT,
  type AuthUserRepositoryPort,
} from '../../domain/ports/out/auth-user-repository.port';
import { AuthUserEntity } from '../../domain/entities/auth-user.entity';
import {
  RegisterDto,
  RegisterResponseDto,
} from '../dtos/register.dto';

@Injectable()
export class AuthService implements LoginUseCasePort, RegisterUseCasePort {
  constructor(
    @Inject(AUTH_USER_REPOSITORY_PORT)
    private readonly userRepository: AuthUserRepositoryPort,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Registro de nuevo usuario con contraseña cifrada.
   *
   * Reglas de negocio:
   *  1. Verifica que el correo no esté ya registrado (409 Conflict si existe).
   *  2. Genera el hash de la contraseña usando bcrypt con 10 rounds.
   *  3. Asigna siempre el rol 'usuario'.
   *  4. Persiste el usuario en la base de datos.
   *  5. Retorna los datos del usuario omitiendo estrictamente 'password_hash'.
   */
  async register(dto: RegisterDto): Promise<RegisterResponseDto> {
    const existing = await this.userRepository.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('El correo electrónico ya está registrado');
    }

    // Hash con bcrypt (10 rounds de salt)
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Asignar siempre el rol 'usuario'
    const roleRecord = await this.userRepository.findRoleByName('usuario');
    const idRole = roleRecord?.idRole ?? 1;

    const name = dto.name?.trim() || dto.email.split('@')[0];
    const lastName = dto.lastName?.trim() || 'Usuario';

    const newUser = await this.userRepository.createUser({
      email: dto.email,
      passwordHash,
      name,
      lastName,
      idRole,
      age: dto.age,
      gender: dto.gender,
      active: true,
    });

    // NUNCA devolver password_hash ni contraseñas
    return {
      idUser: newUser.idUser,
      email: newUser.email,
      name: newUser.name,
      lastName: newUser.lastName,
      role: 'usuario',
      active: newUser.active,
      age: newUser.age ?? null,
      gender: newUser.gender ?? null,
    };
  }

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
}

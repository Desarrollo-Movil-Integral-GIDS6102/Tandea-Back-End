import {
  Injectable,
  Inject,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import {
  type LoginUseCasePort,
  type LoginResult,
} from '../../domain/ports/in/login-use-case.port';
import {
  AUTH_USER_REPOSITORY_PORT,
  type AuthUserRepositoryPort,
} from '../../domain/ports/out/auth-user-repository.port';
import { AuthUserEntity } from '../../domain/entities/auth-user.entity';

@Injectable()
export class AuthService implements LoginUseCasePort {
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
}

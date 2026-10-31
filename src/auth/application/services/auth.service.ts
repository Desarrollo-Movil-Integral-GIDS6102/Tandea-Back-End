import {
  Injectable,
  Inject,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  NotFoundException,
  BadRequestException,
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomInt } from 'crypto';
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
import {
  type PerfilUseCasePort,
  type PerfilUsuario,
  type ActualizarPerfilCommand,
} from '../../domain/ports/in/perfil-use-case.port';
import { AuthUserEntity } from '../../domain/entities/auth-user.entity';
import { validatePassword } from '../../domain/policies/password-policy';

const CODIGO_VIGENCIA_MIN = 10;
const CODIGO_ESPERA_REENVIO_MS = 60_000;
const CODIGO_MAX_INTENTOS = 5;
import { MAIL_PORT, type MailPort } from '../../../common/ports/out/mail.port';
import { EmailTemplates } from '../../../common/templates/mail/email-templates';



@Injectable()
export class AuthService implements LoginUseCasePort, RegisterUseCasePort, PerfilUseCasePort {
  constructor(
    @Inject(AUTH_USER_REPOSITORY_PORT)
    private readonly userRepository: AuthUserRepositoryPort,
    @Inject(MAIL_PORT)
    private readonly mailService: MailPort,
    private readonly jwtService: JwtService,
  ) { }

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
   * Expiración: 30 días (configurado en JwtModule).
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

    const template = EmailTemplates.welcome(newUser.name);

    this.mailService.sendMail({
      to: newUser.email,
      subject: template.subject,
      htmlContent: template.html
    }).catch(() => { });

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

  // ─────────────────────────────────────────────────────────────────────────
  // PERFIL DEL USUARIO
  // ─────────────────────────────────────────────────────────────────────────

  async obtenerPerfil(idUser: number): Promise<PerfilUsuario> {
    const user = await this.userRepository.findById(idUser);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return this.aPerfil(user);
  }

  async actualizarPerfil(idUser: number, command: ActualizarPerfilCommand): Promise<PerfilUsuario> {
    const user = await this.userRepository.updateProfile(idUser, command);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return this.aPerfil(user);
  }

  async solicitarCodigoPassword(idUser: number): Promise<void> {
    const user = await this.userRepository.findById(idUser);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const vigente = await this.userRepository.findActivePasswordResetCode(idUser);
    if (vigente && Date.now() - vigente.createdAt.getTime() < CODIGO_ESPERA_REENVIO_MS) {
      throw new HttpException(
        'Espera un minuto antes de pedir otro código',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const codigo = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const expiresAt = new Date(Date.now() + CODIGO_VIGENCIA_MIN * 60_000);
    await this.userRepository.createPasswordResetCode(
      idUser,
      await bcrypt.hash(codigo, 10),
      expiresAt,
    );

    const template = EmailTemplates.passwordCode(user.name, codigo, CODIGO_VIGENCIA_MIN);
    const enviado = await this.mailService.sendMail({
      to: user.email,
      subject: template.subject,
      htmlContent: template.html,
    });
    if (!enviado) {
      throw new ServiceUnavailableException('No pudimos enviar el correo. Intenta de nuevo.');
    }
  }

  async cambiarPassword(idUser: number, codigo: string, nuevaPassword: string): Promise<void> {
    const user = await this.userRepository.findById(idUser);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const registro = await this.userRepository.findActivePasswordResetCode(idUser);
    if (!registro) {
      throw new BadRequestException('El código expiró o no existe. Solicita uno nuevo.');
    }
    if (registro.attempts >= CODIGO_MAX_INTENTOS) {
      throw new BadRequestException('Demasiados intentos. Solicita un código nuevo.');
    }
    if (!(await bcrypt.compare(codigo, registro.codeHash))) {
      await this.userRepository.incrementPasswordResetAttempts(registro.idCode);
      throw new BadRequestException('El código es incorrecto');
    }

    const errores = validatePassword(nuevaPassword, user);
    if (errores.length > 0) {
      throw new BadRequestException(errores.join('. '));
    }
    if (await bcrypt.compare(nuevaPassword, user.passwordHash)) {
      throw new BadRequestException('La nueva contraseña debe ser distinta a la actual');
    }

    await this.userRepository.updatePassword(idUser, await bcrypt.hash(nuevaPassword, 10));
    await this.userRepository.markPasswordResetCodeUsed(registro.idCode);
  }

  async solicitarRecuperacion(email: string): Promise<void> {
    const user = await this.userRepository.findByEmail(email);
    if (!user || !user.active) {
      return;
    }
    // Cualquier fallo se calla: responder distinto revelaría que el correo existe
    await this.solicitarCodigoPassword(user.idUser).catch(() => undefined);
  }

  async restablecerPassword(email: string, codigo: string, nuevaPassword: string): Promise<void> {
    const user = await this.userRepository.findByEmail(email);
    if (!user || !user.active) {
      throw new BadRequestException('El código expiró o no existe. Solicita uno nuevo.');
    }
    await this.cambiarPassword(user.idUser, codigo, nuevaPassword);
  }

  private aPerfil(user: AuthUserEntity): PerfilUsuario {
    return {
      idUser: user.idUser,
      email: user.email,
      name: user.name,
      lastName: user.lastName,
      age: user.age ?? null,
      gender: user.gender ?? null,
      role: user.role,
    };
  }
}

import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Inject,
} from '@nestjs/common';
import {
  zLoginDto,
  zLoginResponseDto,
  type LoginResponseDto,
} from '../../../../../application/dtos/login.dto';
import {
  zRegisterDto,
  zRegisterResponseDto,
  type RegisterResponseDto,
} from '../../../../../application/dtos/register.dto';
import {
  LOGIN_USE_CASE_PORT,
  type LoginUseCasePort,
} from '../../../../../domain/ports/in/login-use-case.port';
import {
  REGISTER_USE_CASE_PORT,
  type RegisterUseCasePort,
} from '../../../../../domain/ports/in/register-use-case.port';
import {
  PERFIL_USE_CASE_PORT,
  type PerfilUseCasePort,
} from '../../../../../domain/ports/in/perfil-use-case.port';
import {
  zActualizarPerfilDto,
  zCambiarPasswordDto,
} from '../../../../../application/dtos/perfil.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { AuthenticatedUser } from '../strategies/jwt.strategy';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(LOGIN_USE_CASE_PORT)
    private readonly loginService: LoginUseCasePort,
    @Inject(REGISTER_USE_CASE_PORT)
    private readonly registerService: RegisterUseCasePort,
    @Inject(PERFIL_USE_CASE_PORT)
    private readonly perfilService: PerfilUseCasePort,
  ) {}

  /**
   * GET /api/v1/auth/perfil
   * Datos del usuario autenticado leídos de la base (no del token).
   */
  @Get('perfil')
  @UseGuards(JwtAuthGuard)
  async obtenerPerfil(@CurrentUser() user: AuthenticatedUser) {
    return { data: await this.perfilService.obtenerPerfil(user.idUser) };
  }

  /**
   * PATCH /api/v1/auth/perfil
   * Edita nombre, apellido, edad y género. El correo no se puede cambiar.
   */
  @Patch('perfil')
  @UseGuards(JwtAuthGuard)
  async actualizarPerfil(@Body() body: unknown, @CurrentUser() user: AuthenticatedUser) {
    const dto = zActualizarPerfilDto.parse(body ?? {});
    return {
      mensaje: 'Perfil actualizado',
      data: await this.perfilService.actualizarPerfil(user.idUser, dto),
    };
  }

  /**
   * POST /api/v1/auth/perfil/password/codigo
   * Envía un código de 6 dígitos al correo del usuario para cambiar la contraseña.
   */
  @Post('perfil/password/codigo')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async solicitarCodigoPassword(@CurrentUser() user: AuthenticatedUser) {
    await this.perfilService.solicitarCodigoPassword(user.idUser);
    return { mensaje: 'Te enviamos un código de 6 dígitos a tu correo' };
  }

  /**
   * POST /api/v1/auth/perfil/password
   * Cambia la contraseña validando el código recibido por correo.
   */
  @Post('perfil/password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async cambiarPassword(@Body() body: unknown, @CurrentUser() user: AuthenticatedUser) {
    const dto = zCambiarPasswordDto.parse(body ?? {});
    await this.perfilService.cambiarPassword(user.idUser, dto.codigo, dto.nuevaPassword);
    return { mensaje: 'Contraseña actualizada' };
  }

  /**
   * POST /api/v1/auth/register
   * Registra un nuevo usuario, valida campos con Zod, hashea con bcrypt y retorna JWT y datos del usuario.
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() body: unknown): Promise<RegisterResponseDto> {
    const dto = zRegisterDto.parse(body);
    const result = await this.registerService.register(dto);
    return zRegisterResponseDto.parse(result);
  }

  /**
   * POST /api/v1/auth/login
   * Valida credenciales, comprueba estado activo y genera token JWT.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: unknown): Promise<LoginResponseDto> {
    const dto = zLoginDto.parse(body);
    const user = await this.loginService.validateUser(dto.email, dto.password);
    const result = await this.loginService.login(user);
    return zLoginResponseDto.parse(result);
  }

  /**
   * GET /api/v1/auth/profile
   * Protegido por JwtAuthGuard. Retorna el usuario del token.
   */
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return {
      message: 'Perfil de usuario autenticado',
      user,
    };
  }

  /**
   * GET /api/v1/auth/admin-check
   * Protegido por JwtAuthGuard y RolesGuard (solo 'admin_global').
   */
  @Get('admin-check')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin_global')
  checkAdminAccess(@CurrentUser() user: AuthenticatedUser) {
    return {
      message: 'Acceso exclusivo de Administrador Global concedido',
      user,
    };
  }

  /**
   * GET /api/v1/auth/usuario-check
   * Protegido por JwtAuthGuard y RolesGuard (solo 'usuario').
   */
  @Get('usuario-check')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('usuario')
  checkUsuarioAccess(@CurrentUser() user: AuthenticatedUser) {
    return {
      message: 'Acceso concedido para rol usuario',
      user,
    };
  }
}

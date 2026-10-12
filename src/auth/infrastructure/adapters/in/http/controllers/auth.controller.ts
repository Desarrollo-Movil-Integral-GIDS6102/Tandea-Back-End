import {
  Controller,
  Post,
  Get,
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
  ) {}

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

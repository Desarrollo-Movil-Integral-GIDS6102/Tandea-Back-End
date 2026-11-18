import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../../../auth/infrastructure/adapters/in/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../../auth/infrastructure/adapters/in/http/guards/roles.guard';
import { Roles } from '../../../../../auth/infrastructure/adapters/in/http/decorators/roles.decorator';
import { CurrentUser } from '../../../../../auth/infrastructure/adapters/in/http/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../../../auth/infrastructure/adapters/in/http/strategies/jwt.strategy';
import {
  ADMIN_METRICAS_USE_CASE_PORT,
  type AdminMetricasUseCasePort,
} from '../../../../domain/ports/in/admin-metricas-use-case.port';
import {
  ADMIN_USUARIOS_USE_CASE_PORT,
  type AdminUsuariosUseCasePort,
} from '../../../../domain/ports/in/admin-usuarios-use-case.port';
import {
  zBuscarUsuariosQuery,
  zSuspenderUsuarioDto,
} from '../../../../application/dtos/admin-usuarios.dto';

/**
 * Endpoints del Administrador Global. Todo el controlador exige rol `admin_global`.
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin_global')
export class AdminController {
  constructor(
    @Inject(ADMIN_METRICAS_USE_CASE_PORT)
    private readonly metricas: AdminMetricasUseCasePort,
    @Inject(ADMIN_USUARIOS_USE_CASE_PORT)
    private readonly usuarios: AdminUsuariosUseCasePort,
  ) {}

  /**
   * GET /admin/metricas
   * Totales de la plataforma para el panel global (AP-11), sin datos individuales.
   */
  @Get('metricas')
  async obtenerMetricas() {
    return {
      statusCode: HttpStatus.OK,
      data: await this.metricas.obtenerMetricas(),
    };
  }

  /**
   * GET /admin/usuarios?q=&active=
   * Búsqueda de usuarios por nombre, apellido o correo y filtro opcional por estado.
   */
  @Get('usuarios')
  async buscarUsuarios(@Query() query: unknown) {
    const filtro = zBuscarUsuariosQuery.parse(query ?? {});
    return {
      statusCode: HttpStatus.OK,
      data: await this.usuarios.buscarUsuarios(filtro),
    };
  }

  /**
   * PATCH /admin/usuarios/:id/suspender
   * Suspende a un usuario (`active = false`) y registra la acción en `audit_log`.
   */
  @Patch('usuarios/:id/suspender')
  async suspenderUsuario(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    const dto = zSuspenderUsuarioDto.parse(body ?? {});
    const data = await this.usuarios.suspenderUsuario({
      idUser: id,
      idAdminGlobal: admin.idUser,
      motivo: dto.motivo,
    });

    return {
      statusCode: HttpStatus.OK,
      mensaje: 'Usuario suspendido exitosamente',
      data,
    };
  }
}

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
  ADMIN_DISPUTAS_USE_CASE_PORT,
  type AdminDisputasUseCasePort,
} from '../../../../domain/ports/in/admin-disputas-use-case.port';
import {
  zBuscarUsuariosQuery,
  zSuspenderUsuarioDto,
} from '../../../../application/dtos/admin-usuarios.dto';
import {
  zListarDisputasQuery,
  zResolverDisputaDto,
} from '../../../../application/dtos/admin-disputas.dto';

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
    @Inject(ADMIN_DISPUTAS_USE_CASE_PORT)
    private readonly disputas: AdminDisputasUseCasePort,
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

  /**
   * GET /admin/disputas?status=&idTanda=
   * Lista las disputas reportadas en la plataforma para el Administrador Global.
   */
  @Get('disputas')
  async listarDisputas(@Query() query: unknown) {
    const filtro = zListarDisputasQuery.parse(query ?? {});
    return {
      statusCode: HttpStatus.OK,
      data: await this.disputas.listarDisputas(filtro),
    };
  }

  /**
   * GET /admin/disputas/:id
   * Detalle de una disputa junto con su bitácora (`audit_log`).
   */
  @Get('disputas/:id')
  async obtenerDisputa(@Param('id', ParseIntPipe) id: number) {
    return {
      statusCode: HttpStatus.OK,
      data: await this.disputas.obtenerDisputa(id),
    };
  }

  /**
   * PATCH /admin/disputas/:id/resolver
   * Resuelve una disputa con `{ accion: mantener|revertir|suspender, notas }` y
   * guarda el evento en `audit_log` en la misma transacción. Prohibido modificar montos.
   */
  @Patch('disputas/:id/resolver')
  async resolverDisputa(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    const dto = zResolverDisputaDto.parse(body ?? {});
    const data = await this.disputas.resolverDisputa({
      idDispute: id,
      idAdminGlobal: admin.idUser,
      accion: dto.accion,
      notas: dto.notas,
    });

    return {
      statusCode: HttpStatus.OK,
      mensaje: 'Disputa resuelta exitosamente',
      data,
    };
  }
}

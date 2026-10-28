import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  Inject,
  UseFilters,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../../../auth/infrastructure/adapters/in/http/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../../auth/infrastructure/adapters/in/http/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../../../auth/infrastructure/adapters/in/http/strategies/jwt.strategy';
import {
  TANDA_USE_CASES_PORT,
  type TandaUseCasesPort,
} from '../../../../domain/ports/in/tanda-use-cases.port';
import { TandaDomainExceptionFilter } from './filters/tanda-domain-exception.filter';
import { zCreateTanda } from '../../../../application/dtos/create-tanda.dto';
import { zJoinTanda } from '../../../../application/dtos/join-tanda.dto';
import {
  zUpdateTanda,
  zUpdateTandaStatus,
} from '../../../../application/dtos/update-tanda.dto';
import { zQueryTandas } from '../../../../application/dtos/query-tandas.dto';

@Controller('tandas')
@UseGuards(JwtAuthGuard)
@UseFilters(TandaDomainExceptionFilter)
export class TandaController {
  constructor(
    @Inject(TANDA_USE_CASES_PORT)
    private readonly tandaService: TandaUseCasesPort,
  ) {}

  /**
   * POST /tandas
   * Crear una nueva tanda asignando al usuario autenticado como idAdmin.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async crearTanda(
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const dto = zCreateTanda.parse(body);
    const tanda = await this.tandaService.crearTanda({
      ...dto,
      idAdmin: user.idUser,
    });

    return {
      statusCode: HttpStatus.CREATED,
      mensaje: 'Tanda creada exitosamente',
      data: tanda.toPrimitives(),
    };
  }

  /**
   * POST /tandas/unirse
   * Unirse a una tanda activa mediante código de invitación.
   */
  @Post('unirse')
  @HttpCode(HttpStatus.OK)
  async unirseTanda(
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const dto = zJoinTanda.parse(body);
    const result = await this.tandaService.unirseTanda({
      inviteCode: dto.inviteCode,
      idUser: user.idUser,
      selectedNumbers:
        dto.selectedNumbers ?? (dto.selectedNumber ? [dto.selectedNumber] : undefined),
      cantidad: dto.cantidad,
    });

    return {
      statusCode: HttpStatus.OK,
      mensaje: 'Te has unido exitosamente a la tanda',
      data: {
        tanda: result.tanda.toPrimitives(),
        numeroAsignado: result.numeroAsignado,
        numerosAsignados: result.numerosAsignados,
        isDeadNumber: result.isDeadNumber,
      },
    };
  }

  /**
   * GET /tandas
   * Listar tandas accesibles para el usuario con paginación, búsqueda,
   * filtros por fecha/estado y ordenamiento.
   */
  @Get()
  async listarTandas(
    @Query() query: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const queryDto = zQueryTandas.parse(query);
    const resultado = await this.tandaService.listarTandas(
      queryDto,
      user.idUser,
      user.role,
    );

    return {
      statusCode: HttpStatus.OK,
      ...resultado,
    };
  }

  /**
   * GET /tandas/mias?rol=participante|organizador
   * Listar tandas del usuario autenticado según su rol (participante u organizador).
   */
  @Get('mias')
  async listarMisTandas(
    @Query('rol') rol: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const scope = (rol === 'organizador' || rol === 'dueno') ? 'dueno' : 'participante';
    const resultado = await this.tandaService.listarTandas(
      { scope, page: 1, limit: 50 },
      user.idUser,
      user.role,
    );

    return {
      statusCode: HttpStatus.OK,
      data: resultado.data,
      total: resultado.total,
      page: resultado.page,
      limit: resultado.limit,
      totalPages: resultado.totalPages,
    };
  }


  /**
   * GET /tandas/codigo/:inviteCode
   * Consultar datos de una tanda por código de invitación (útil para previsualizar antes de unirse).
   */
  @Get('codigo/:inviteCode')
  async obtenerPorCodigo(@Param('inviteCode') inviteCode: string) {
    const tanda = await this.tandaService.obtenerPorCodigoInvitacion(inviteCode);
    return {
      statusCode: HttpStatus.OK,
      data: tanda,
    };
  }

  /**
   * GET /tandas/:id
   * Obtener el detalle completo de una tanda (incluye números/turnos y rol del usuario).
   */
  @Get(':id')
  async obtenerPorId(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const tandaDetalle = await this.tandaService.obtenerTandaPorId(
      id,
      user.idUser,
      user.role,
    );

    return {
      statusCode: HttpStatus.OK,
      data: tandaDetalle,
    };
  }

  /**
   * PATCH /tandas/:id
   * Actualizar nombre o descripción de la tanda (solo organizador o admin global).
   */
  @Patch(':id')
  async actualizarTanda(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const dto = zUpdateTanda.parse(body);
    const tanda = await this.tandaService.actualizarTanda(
      id,
      dto,
      user.idUser,
      user.role,
    );

    return {
      statusCode: HttpStatus.OK,
      mensaje: 'Tanda actualizada exitosamente',
      data: tanda.toPrimitives(),
    };
  }

  /**
   * PATCH /tandas/:id/status
   * Cambiar el estado de la tanda (solo organizador o admin global).
   */
  @Patch(':id/status')
  async cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const dto = zUpdateTandaStatus.parse(body);
    const tanda = await this.tandaService.cambiarEstadoTanda(
      id,
      dto.status,
      user.idUser,
      user.role,
    );

    return {
      statusCode: HttpStatus.OK,
      mensaje: 'Estado de tanda actualizado exitosamente',
      data: tanda.toPrimitives(),
    };
  }

  /**
   * DELETE /tandas/:id
   * Eliminación lógica de la tanda (soft delete).
   */
  @Delete(':id')
  async eliminarTanda(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.tandaService.eliminarTanda(id, user.idUser, user.role);

    return {
      statusCode: HttpStatus.OK,
      mensaje: 'Tanda eliminada exitosamente',
    };
  }
}

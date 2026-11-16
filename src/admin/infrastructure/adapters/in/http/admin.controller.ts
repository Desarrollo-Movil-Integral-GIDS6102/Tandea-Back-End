import { Controller, Get, HttpStatus, Inject, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../../auth/infrastructure/adapters/in/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../../auth/infrastructure/adapters/in/http/guards/roles.guard';
import { Roles } from '../../../../../auth/infrastructure/adapters/in/http/decorators/roles.decorator';
import {
  ADMIN_METRICAS_USE_CASE_PORT,
  type AdminMetricasUseCasePort,
} from '../../../../domain/ports/in/admin-metricas-use-case.port';

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
}

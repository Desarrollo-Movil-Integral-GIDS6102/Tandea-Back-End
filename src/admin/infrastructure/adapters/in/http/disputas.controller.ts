import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../../../auth/infrastructure/adapters/in/http/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../../auth/infrastructure/adapters/in/http/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../../../auth/infrastructure/adapters/in/http/strategies/jwt.strategy';
import { zCrearDisputaDto } from '../../../../application/dtos/admin-disputas.dto';
import {
  ADMIN_DISPUTAS_USE_CASE_PORT,
  type AdminDisputasUseCasePort,
} from '../../../../domain/ports/in/admin-disputas-use-case.port';

/**
 * [SP-4 BE-ADMIN] Creación de disputas por miembros de una tanda.
 */
@Controller('disputas')
@UseGuards(JwtAuthGuard)
export class DisputasController {
  constructor(
    @Inject(ADMIN_DISPUTAS_USE_CASE_PORT)
    private readonly disputas: AdminDisputasUseCasePort,
  ) {}

  /**
   * POST /disputas
   * Un miembro de la tanda (participante u organizador) abre una disputa sobre la tanda,
   * un pago o una entrega.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async crearDisputa(@Body() body: unknown, @CurrentUser() user: AuthenticatedUser) {
    const dto = zCrearDisputaDto.parse(body ?? {});
    const data = await this.disputas.crearDisputa({
      idTanda: dto.idTanda,
      idReporter: user.idUser,
      rolReporter: user.role,
      motivo: dto.motivo,
      idPayment: dto.idPayment,
      idPayout: dto.idPayout,
    });

    return {
      statusCode: HttpStatus.CREATED,
      mensaje: 'Disputa registrada exitosamente',
      data,
    };
  }
}

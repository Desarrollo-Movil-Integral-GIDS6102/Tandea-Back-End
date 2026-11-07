import {
  Controller,
  Get,
  HttpStatus,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../../../../auth/infrastructure/adapters/in/http/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../../../auth/infrastructure/adapters/in/http/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../../../../auth/infrastructure/adapters/in/http/strategies/jwt.strategy';
import {
  BANDEJA_USE_CASE_PORT,
  type BandejaUseCasePort,
} from '../../../../../domain/ports/in/bandeja-use-case.port';

@Controller('notificaciones')
@UseGuards(JwtAuthGuard)
export class NotificacionesController {
  constructor(
    @Inject(BANDEJA_USE_CASE_PORT)
    private readonly bandeja: BandejaUseCasePort,
  ) {}

  /** GET /notificaciones — bandeja del usuario con su contador de no leídas. */
  @Get()
  async listar(@CurrentUser() user: AuthenticatedUser) {
    return { statusCode: HttpStatus.OK, data: await this.bandeja.listar(user.idUser) };
  }

  /** PATCH /notificaciones/:id/leida */
  @Patch(':id/leida')
  async marcarLeida(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.bandeja.marcarLeida(id, user.idUser);
    return { statusCode: HttpStatus.OK, data: { idNotification: id, isRead: true } };
  }
}

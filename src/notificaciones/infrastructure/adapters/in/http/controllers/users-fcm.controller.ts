import {
  Controller,
  Patch,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../../../../auth/infrastructure/adapters/in/http/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../../../auth/infrastructure/adapters/in/http/decorators/current-user.decorator';
import { type AuthenticatedUser } from '../../../../../../auth/infrastructure/adapters/in/http/strategies/jwt.strategy';
import {
  FCM_TOKEN_USE_CASE_PORT,
  type FcmTokenUseCasePort,
} from '../../../../../domain/ports/in/fcm-token-use-case.port';
import { zUpdateFcmTokenDto } from '../../../../../application/dtos/fcm-token.dto';

@Controller('users')
export class UsersFcmController {
  constructor(
    @Inject(FCM_TOKEN_USE_CASE_PORT)
    private readonly fcmTokenUseCase: FcmTokenUseCasePort,
  ) {}

  /**
   * PATCH /api/v1/users/me/fcm-token
   * Guarda o actualiza el token FCM del dispositivo del usuario autenticado.
   */
  @Patch('me/fcm-token')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateFcmToken(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const dto = zUpdateFcmTokenDto.parse(body);
    await this.fcmTokenUseCase.actualizarToken(user.idUser, dto.fcmToken);

    return {
      message: 'Token FCM actualizado correctamente',
      fcmToken: dto.fcmToken,
    };
  }
}


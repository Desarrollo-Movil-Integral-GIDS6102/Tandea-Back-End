import { Injectable, Inject } from '@nestjs/common';
import { FcmTokenUseCasePort } from '../../domain/ports/in/fcm-token-use-case.port';
import {
  FCM_TOKEN_REPOSITORY_PORT,
  type FcmTokenRepositoryPort,
} from '../../domain/ports/out/fcm-token-repository.port';

@Injectable()
export class FcmTokenService implements FcmTokenUseCasePort {
  constructor(
    @Inject(FCM_TOKEN_REPOSITORY_PORT)
    private readonly fcmTokenRepository: FcmTokenRepositoryPort,
  ) {}

  async actualizarToken(userId: number, fcmToken: string): Promise<void> {
    await this.fcmTokenRepository.guardarToken(userId, fcmToken);
  }
}


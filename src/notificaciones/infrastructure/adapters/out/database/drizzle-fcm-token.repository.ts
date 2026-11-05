import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { FcmTokenRepositoryPort } from '../../../../domain/ports/out/fcm-token-repository.port';
import { userTable } from '../../../../../database/tandea.schema';
import { DATABASE_TOKEN } from '../../../../../common/tokens';

@Injectable()
export class DrizzleFcmTokenRepository implements FcmTokenRepositoryPort {
  constructor(
    @Inject(DATABASE_TOKEN)
    private readonly db: NodePgDatabase,
  ) {}

  async obtenerTokenPorUsuario(userId: number): Promise<string | null> {
    const rows = await this.db
      .select({ fcmToken: userTable.fcmToken })
      .from(userTable)
      .where(eq(userTable.idUser, userId))
      .limit(1);

    return rows[0]?.fcmToken ?? null;
  }

  async guardarToken(userId: number, fcmToken: string): Promise<void> {
    await this.db
      .update(userTable)
      .set({ fcmToken })
      .where(eq(userTable.idUser, userId));
  }

  async borrarToken(userId: number): Promise<void> {
    await this.db
      .update(userTable)
      .set({ fcmToken: null })
      .where(eq(userTable.idUser, userId));
  }
}


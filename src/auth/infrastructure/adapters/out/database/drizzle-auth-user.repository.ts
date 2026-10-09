import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { AuthUserRepositoryPort } from '../../../../domain/ports/out/auth-user-repository.port';
import { AuthUserEntity } from '../../../../domain/entities/auth-user.entity';
import { userTable, roleTable } from '../../../../../database/tandea.schema';
import { DATABASE_TOKEN } from '../../../../../common/tokens';

@Injectable()
export class DrizzleAuthUserRepository implements AuthUserRepositoryPort {
  constructor(
    @Inject(DATABASE_TOKEN)
    private readonly db: NodePgDatabase,
  ) {}

  async findByEmail(email: string): Promise<AuthUserEntity | null> {
    const rows = await this.db
      .select({
        idUser: userTable.idUser,
        email: userTable.email,
        passwordHash: userTable.passwordHash,
        name: userTable.name,
        lastName: userTable.lastName,
        idRole: userTable.idRole,
        role: roleTable.nameRole,
        active: userTable.active,
      })
      .from(userTable)
      .innerJoin(roleTable, eq(userTable.idRole, roleTable.idRole))
      .where(eq(userTable.email, email))
      .limit(1);

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return new AuthUserEntity(
      row.idUser,
      row.email,
      row.passwordHash,
      row.name,
      row.lastName,
      row.idRole,
      row.role,
      row.active,
    );
  }

  async findById(idUser: number): Promise<AuthUserEntity | null> {
    const rows = await this.db
      .select({
        idUser: userTable.idUser,
        email: userTable.email,
        passwordHash: userTable.passwordHash,
        name: userTable.name,
        lastName: userTable.lastName,
        idRole: userTable.idRole,
        role: roleTable.nameRole,
        active: userTable.active,
      })
      .from(userTable)
      .innerJoin(roleTable, eq(userTable.idRole, roleTable.idRole))
      .where(eq(userTable.idUser, idUser))
      .limit(1);

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return new AuthUserEntity(
      row.idUser,
      row.email,
      row.passwordHash,
      row.name,
      row.lastName,
      row.idRole,
      row.role,
      row.active,
    );
  }
}

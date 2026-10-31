import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import {
  AuthUserRepositoryPort,
  CreateUserData,
  AuthRoleData,
  UpdateProfileData,
  PasswordResetCodeRecord,
} from '../../../../domain/ports/out/auth-user-repository.port';
import { AuthUserEntity } from '../../../../domain/entities/auth-user.entity';
import {
  userTable,
  roleTable,
  passwordResetCodeTable,
} from '../../../../../database/tandea.schema';
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
        age: userTable.age,
        gender: userTable.gender,
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
      row.age,
      row.gender,
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
        age: userTable.age,
        gender: userTable.gender,
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
      row.age,
      row.gender,
    );
  }

  async findRoleByName(roleName: string): Promise<AuthRoleData | null> {
    const rows = await this.db
      .select({
        idRole: roleTable.idRole,
        nameRole: roleTable.nameRole,
      })
      .from(roleTable)
      .where(eq(roleTable.nameRole, roleName))
      .limit(1);

    if (rows.length > 0) {
      return rows[0];
    }

    const [created] = await this.db
      .insert(roleTable)
      .values({
        nameRole: roleName,
        description: `Rol ${roleName} generado automáticamente`,
        active: true,
      })
      .returning({
        idRole: roleTable.idRole,
        nameRole: roleTable.nameRole,
      });

    return created ?? null;
  }

  async createUser(data: CreateUserData): Promise<AuthUserEntity> {
    const [inserted] = await this.db
      .insert(userTable)
      .values({
        email: data.email,
        passwordHash: data.passwordHash,
        name: data.name,
        lastName: data.lastName,
        age: data.age ?? null,
        gender: data.gender ?? null,
        idRole: data.idRole,
        active: true,
      })
      .returning({
        idUser: userTable.idUser,
        email: userTable.email,
        passwordHash: userTable.passwordHash,
        name: userTable.name,
        lastName: userTable.lastName,
        idRole: userTable.idRole,
        active: userTable.active,
        age: userTable.age,
        gender: userTable.gender,
      });

    const [role] = await this.db
      .select({ nameRole: roleTable.nameRole })
      .from(roleTable)
      .where(eq(roleTable.idRole, inserted.idRole))
      .limit(1);

    return new AuthUserEntity(
      inserted.idUser,
      inserted.email,
      inserted.passwordHash,
      inserted.name,
      inserted.lastName,
      inserted.idRole,
      role?.nameRole ?? 'usuario',
      inserted.active,
      inserted.age,
      inserted.gender,
    );
  }

  async updateProfile(idUser: number, data: UpdateProfileData): Promise<AuthUserEntity | null> {
    await this.db.update(userTable).set(data).where(eq(userTable.idUser, idUser));
    return this.findById(idUser);
  }

  async updatePassword(idUser: number, passwordHash: string): Promise<void> {
    await this.db.update(userTable).set({ passwordHash }).where(eq(userTable.idUser, idUser));
  }

  async createPasswordResetCode(idUser: number, codeHash: string, expiresAt: Date): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .update(passwordResetCodeTable)
        .set({ usedAt: new Date() })
        .where(
          and(eq(passwordResetCodeTable.idUser, idUser), isNull(passwordResetCodeTable.usedAt)),
        );
      await tx.insert(passwordResetCodeTable).values({ idUser, codeHash, expiresAt });
    });
  }

  async findActivePasswordResetCode(idUser: number): Promise<PasswordResetCodeRecord | null> {
    const [row] = await this.db
      .select({
        idCode: passwordResetCodeTable.idCode,
        codeHash: passwordResetCodeTable.codeHash,
        attempts: passwordResetCodeTable.attempts,
        createdAt: passwordResetCodeTable.createdAt,
      })
      .from(passwordResetCodeTable)
      .where(
        and(
          eq(passwordResetCodeTable.idUser, idUser),
          isNull(passwordResetCodeTable.usedAt),
          gt(passwordResetCodeTable.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(passwordResetCodeTable.createdAt))
      .limit(1);

    return row ?? null;
  }

  async incrementPasswordResetAttempts(idCode: number): Promise<void> {
    await this.db
      .update(passwordResetCodeTable)
      .set({ attempts: sql`${passwordResetCodeTable.attempts} + 1` })
      .where(eq(passwordResetCodeTable.idCode, idCode));
  }

  async markPasswordResetCodeUsed(idCode: number): Promise<void> {
    await this.db
      .update(passwordResetCodeTable)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetCodeTable.idCode, idCode));
  }
}

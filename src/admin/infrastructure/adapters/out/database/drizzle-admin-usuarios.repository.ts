import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_TOKEN } from '../../../../../common/tokens';
import {
  auditLogTable,
  roleTable,
  userTable,
} from '../../../../../database/tandea.schema';
import type {
  BuscarUsuariosFiltro,
  UsuarioAdminResumen,
} from '../../../../domain/ports/in/admin-usuarios-use-case.port';
import type {
  AdminUsuariosRepositoryPort,
  RegistroAuditoriaUsuario,
} from '../../../../domain/ports/out/admin-usuarios-repository.port';

const ROL_USUARIO = 'usuario';

@Injectable()
export class DrizzleAdminUsuariosRepository implements AdminUsuariosRepositoryPort {
  constructor(
    @Inject(DATABASE_TOKEN)
    private readonly db: NodePgDatabase,
  ) {}

  async buscarUsuarios(filtro?: BuscarUsuariosFiltro): Promise<UsuarioAdminResumen[]> {
    const condiciones = [eq(roleTable.nameRole, ROL_USUARIO), isNull(userTable.deletedAt)];

    if (filtro?.active !== undefined) {
      condiciones.push(eq(userTable.active, filtro.active));
    }

    const termino = filtro?.q?.trim();
    if (termino) {
      const patron = `%${termino}%`;
      const coincidencia = or(
        ilike(userTable.name, patron),
        ilike(userTable.lastName, patron),
        ilike(userTable.email, patron),
        sql`(${userTable.name} || ' ' || ${userTable.lastName}) ilike ${patron}`,
      );
      if (coincidencia) {
        condiciones.push(coincidencia);
      }
    }

    return this.db
      .select({
        idUser: userTable.idUser,
        name: userTable.name,
        lastName: userTable.lastName,
        email: userTable.email,
        role: roleTable.nameRole,
        active: userTable.active,
        createdAt: userTable.createdAt,
      })
      .from(userTable)
      .innerJoin(roleTable, eq(roleTable.idRole, userTable.idRole))
      .where(and(...condiciones))
      .orderBy(desc(userTable.createdAt), asc(userTable.idUser));
  }

  async obtenerPorId(idUser: number): Promise<UsuarioAdminResumen | null> {
    const [fila] = await this.db
      .select({
        idUser: userTable.idUser,
        name: userTable.name,
        lastName: userTable.lastName,
        email: userTable.email,
        role: roleTable.nameRole,
        active: userTable.active,
        createdAt: userTable.createdAt,
      })
      .from(userTable)
      .innerJoin(roleTable, eq(roleTable.idRole, userTable.idRole))
      .where(and(eq(userTable.idUser, idUser), isNull(userTable.deletedAt)))
      .limit(1);

    return fila ?? null;
  }

  async suspenderConAuditoria(
    registro: RegistroAuditoriaUsuario,
  ): Promise<UsuarioAdminResumen> {
    return this.db.transaction(async (tx) => {
      await tx
        .update(userTable)
        .set({ active: false, fcmToken: null, updatedAt: new Date() })
        .where(eq(userTable.idUser, registro.idUsuarioAfectado));

      await tx.insert(auditLogTable).values({
        idUser: registro.idAdminGlobal,
        actionType: registro.actionType,
        entityType: 'user',
        entityId: registro.idUsuarioAfectado,
        description: registro.description,
      });

      const [actualizado] = await tx
        .select({
          idUser: userTable.idUser,
          name: userTable.name,
          lastName: userTable.lastName,
          email: userTable.email,
          role: roleTable.nameRole,
          active: userTable.active,
          createdAt: userTable.createdAt,
        })
        .from(userTable)
        .innerJoin(roleTable, eq(roleTable.idRole, userTable.idRole))
        .where(eq(userTable.idUser, registro.idUsuarioAfectado))
        .limit(1);

      return actualizado;
    });
  }
}

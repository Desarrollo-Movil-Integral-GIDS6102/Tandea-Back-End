import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  eq,
  and,
  or,
  ilike,
  gte,
  lte,
  desc,
  asc,
  isNull,
  count,
  inArray,
  SQL,
} from 'drizzle-orm';
import { DATABASE_TOKEN } from '../../../../../common/tokens';
import {
  tandaTable,
  numberTable,
  userTable,
} from '../../../../../database/tandea.schema';
import { Tanda, TandaStatus } from '../../../../domain/entities/tanda.entity';
import { NumeroYaTomadoError } from '../../../../domain/errors/numero.errors';
import {
  TandaRepositoryPort,
  TandaFilterOptions,
} from '../../../../domain/ports/out/tanda-repository.port';
import {
  NumberRepositoryPort,
  CreateNumberData,
  NumberRecord,
} from '../../../../domain/ports/out/number-repository.port';

@Injectable()
export class DrizzleTandaRepository
  implements TandaRepositoryPort, NumberRepositoryPort
{
  constructor(
    @Inject(DATABASE_TOKEN)
    private readonly db: NodePgDatabase,
  ) {}

  // =========================================================================
  // TANDA REPOSITORY
  // =========================================================================

  async create(tanda: Tanda): Promise<Tanda> {
    const [row] = await this.db
      .insert(tandaTable)
      .values({
        name: tanda.name,
        description: tanda.description,
        startDate: tanda.startDate,
        endDate: tanda.endDate,
        contributionAmount: tanda.contributionAmount.toString(),
        numParticipants: tanda.numParticipants,
        numRounds: tanda.numRounds,
        graceDays: tanda.graceDays,
        hasDeadNumber: tanda.hasDeadNumber,
        idTandaType: tanda.idTandaType,
        idAdmin: tanda.idAdmin,
        status: tanda.status,
        active: tanda.active,
        inviteCode: tanda.inviteCode,
      })
      .returning();

    return this.mapToDomain(row);
  }

  async findById(idTanda: number): Promise<Tanda | null> {
    const [row] = await this.db
      .select()
      .from(tandaTable)
      .where(and(eq(tandaTable.idTanda, idTanda), isNull(tandaTable.deletedAt)))
      .limit(1);

    if (!row) {
      return null;
    }

    return this.mapToDomain(row);
  }

  async findByInviteCode(inviteCode: string): Promise<Tanda | null> {
    const [row] = await this.db
      .select()
      .from(tandaTable)
      .where(
        and(
          eq(tandaTable.inviteCode, inviteCode),
          isNull(tandaTable.deletedAt),
        ),
      )
      .limit(1);

    if (!row) {
      return null;
    }

    return this.mapToDomain(row);
  }

  async update(tanda: Tanda): Promise<Tanda> {
    const [row] = await this.db
      .update(tandaTable)
      .set({
        name: tanda.name,
        description: tanda.description,
        status: tanda.status,
        updatedAt: new Date(),
      })
      .where(eq(tandaTable.idTanda, tanda.idTanda!))
      .returning();

    return this.mapToDomain(row);
  }

  async updateStatus(idTanda: number, status: TandaStatus): Promise<Tanda> {
    const [row] = await this.db
      .update(tandaTable)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(tandaTable.idTanda, idTanda))
      .returning();

    return this.mapToDomain(row);
  }

  async softDelete(idTanda: number): Promise<void> {
    await this.db
      .update(tandaTable)
      .set({
        active: false,
        status: 'CANCELADA',
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tandaTable.idTanda, idTanda));
  }

  async findAll(
    options: TandaFilterOptions,
  ): Promise<{ data: Tanda[]; total: number }> {
    const conditions: SQL[] = [
      isNull(tandaTable.deletedAt),
      eq(tandaTable.active, true),
    ];

    // Filtro por pertenencia (Dueño vs Participante vs Todos)
    const isGlobalAdmin = options.userRole === 'admin_global';

    if (!isGlobalAdmin || options.scope !== 'todos') {
      if (options.scope === 'dueno') {
        conditions.push(eq(tandaTable.idAdmin, options.userId));
      } else if (options.scope === 'participante') {
        const participantTandas = this.db
          .select({ idTanda: numberTable.idTanda })
          .from(numberTable)
          .where(
            and(
              eq(numberTable.idUser, options.userId),
              isNull(numberTable.deletedAt),
            ),
          );
        conditions.push(inArray(tandaTable.idTanda, participantTandas));
      } else {
        // scope === 'todos': donde es dueño O es participante
        const participantTandas = this.db
          .select({ idTanda: numberTable.idTanda })
          .from(numberTable)
          .where(
            and(
              eq(numberTable.idUser, options.userId),
              isNull(numberTable.deletedAt),
            ),
          );

        conditions.push(
          or(
            eq(tandaTable.idAdmin, options.userId),
            inArray(tandaTable.idTanda, participantTandas),
          )!,
        );
      }
    }

    // Filtro por nombre / búsqueda
    if (options.name) {
      conditions.push(ilike(tandaTable.name, `%${options.name}%`));
    }

    // Filtro por status
    if (options.status) {
      conditions.push(eq(tandaTable.status, options.status));
    }

    // Filtro por rango de fechas de inicio
    if (options.startDateFrom) {
      conditions.push(gte(tandaTable.startDate, options.startDateFrom));
    }
    if (options.startDateTo) {
      conditions.push(lte(tandaTable.startDate, options.startDateTo));
    }

    const whereClause = and(...conditions);

    // Contar total
    const [countResult] = await this.db
      .select({ total: count() })
      .from(tandaTable)
      .where(whereClause);

    const total = Number(countResult?.total ?? 0);

    // Determinar ordenamiento
    let sortColumn: any = tandaTable.createdAt;
    if (options.sortBy === 'name') sortColumn = tandaTable.name;
    if (options.sortBy === 'startDate') sortColumn = tandaTable.startDate;
    if (options.sortBy === 'contributionAmount') sortColumn = tandaTable.contributionAmount;

    const orderExpr =
      options.sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

    // Paginación
    const offset = (options.page - 1) * options.limit;

    const rows = await this.db
      .select()
      .from(tandaTable)
      .where(whereClause)
      .orderBy(orderExpr)
      .limit(options.limit)
      .offset(offset);

    return {
      data: rows.map((r) => this.mapToDomain(r)),
      total,
    };
  }

  // =========================================================================
  // NUMBER REPOSITORY
  // =========================================================================

  async createNumber(data: CreateNumberData): Promise<NumberRecord> {
    let row: typeof numberTable.$inferSelect;
    try {
      [row] = await this.db
        .insert(numberTable)
        .values({
          idTanda: data.idTanda,
          roundNumber: data.roundNumber,
          numberValue: data.numberValue,
          idUser: data.idUser,
          isDeadNumber: data.isDeadNumber,
          status: data.status as any,
        })
        .returning();
    } catch (error: any) {
      // Dos personas eligieron el mismo turno a la vez: el índice único deja pasar solo a una (AP-02)
      const code = error?.code || error?.cause?.code;
      if (code === '23505') {
        throw new NumeroYaTomadoError(data.numberValue, data.roundNumber);
      }
      throw error;
    }

    return {
      idNumber: row.idNumber,
      idTanda: row.idTanda,
      roundNumber: row.roundNumber,
      numberValue: row.numberValue,
      idUser: row.idUser,
      isDeadNumber: row.isDeadNumber,
      status: row.status,
    };
  }

  async findOccupiedNumbers(
    idTanda: number,
    roundNumber: number,
  ): Promise<number[]> {
    const rows = await this.db
      .select({ numberValue: numberTable.numberValue })
      .from(numberTable)
      .where(
        and(
          eq(numberTable.idTanda, idTanda),
          eq(numberTable.roundNumber, roundNumber),
          isNull(numberTable.deletedAt),
        ),
      );

    return rows.map((r) => r.numberValue);
  }

  async findByUserInTanda(
    idTanda: number,
    idUser: number,
  ): Promise<NumberRecord[]> {
    const rows = await this.db
      .select()
      .from(numberTable)
      .where(
        and(
          eq(numberTable.idTanda, idTanda),
          eq(numberTable.idUser, idUser),
          isNull(numberTable.deletedAt),
        ),
      );

    return rows.map((r) => ({
      idNumber: r.idNumber,
      idTanda: r.idTanda,
      roundNumber: r.roundNumber,
      numberValue: r.numberValue,
      idUser: r.idUser,
      isDeadNumber: r.isDeadNumber,
      status: r.status,
    }));
  }

  async countParticipants(idTanda: number): Promise<number> {
    const [res] = await this.db
      .select({ total: count() })
      .from(numberTable)
      .where(
        and(
          eq(numberTable.idTanda, idTanda),
          eq(numberTable.roundNumber, 1),
          eq(numberTable.isDeadNumber, false),
          isNull(numberTable.deletedAt),
        ),
      );

    return Number(res?.total || 0);
  }

  async findNumbersByTanda(idTanda: number): Promise<NumberRecord[]> {
    const rows = await this.db
      .select({
        idNumber: numberTable.idNumber,
        idTanda: numberTable.idTanda,
        roundNumber: numberTable.roundNumber,
        numberValue: numberTable.numberValue,
        idUser: numberTable.idUser,
        isDeadNumber: numberTable.isDeadNumber,
        status: numberTable.status,
        userName: userTable.name,
        userEmail: userTable.email,
      })
      .from(numberTable)
      .leftJoin(userTable, eq(numberTable.idUser, userTable.idUser))
      .where(
        and(
          eq(numberTable.idTanda, idTanda),
          isNull(numberTable.deletedAt),
        ),
      )
      .orderBy(asc(numberTable.roundNumber), asc(numberTable.numberValue));

    return rows.map((r) => ({
      idNumber: r.idNumber,
      idTanda: r.idTanda,
      roundNumber: r.roundNumber,
      numberValue: r.numberValue,
      idUser: r.idUser,
      isDeadNumber: r.isDeadNumber,
      status: r.status,
      userName: r.userName,
      userEmail: r.userEmail,
    }));
  }

  // =========================================================================
  // HELPER MAPPER
  // =========================================================================

  private mapToDomain(row: any): Tanda {
    return new Tanda({
      idTanda: row.idTanda,
      name: row.name,
      description: row.description,
      startDate: row.startDate,
      endDate: row.endDate,
      contributionAmount: Number(row.contributionAmount),
      numParticipants: row.numParticipants,
      numRounds: row.numRounds,
      graceDays: row.graceDays,
      hasDeadNumber: row.hasDeadNumber,
      idTandaType: row.idTandaType,
      idAdmin: row.idAdmin,
      status: row.status as any,
      active: row.active,
      inviteCode: row.inviteCode,
      createdAt: row.createdAt ? new Date(row.createdAt) : undefined,
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : undefined,
      deletedAt: row.deletedAt ? new Date(row.deletedAt) : null,
    });
  }
}

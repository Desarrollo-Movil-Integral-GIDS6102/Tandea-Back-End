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
  sql,
} from 'drizzle-orm';
import { DATABASE_TOKEN } from '../../../../../common/tokens';
import {
  tandaTable,
  numberTable,
  paymentTable,
  payoutTable,
  userTable,
} from '../../../../../database/tandea.schema';
import { Tanda, TandaStatus } from '../../../../domain/entities/tanda.entity';
import { NumeroTanda } from '../../../../domain/entities/numero-tanda.entity';
import { NumeroMapper } from './mappers/numero.mapper';
import {
  NumeroYaTomadoError,
  NumeroMuertoNoElegibleError,
  NumeroInexistenteError,
} from '../../../../domain/errors/numero.errors';
import {
  TandaRepositoryPort,
  TandaFilterOptions,
  TipoMovimiento,
  CursorHistorial,
  MovimientoRecord,
  ListarMovimientosOptions,
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
        periodicity: tanda.periodicity,
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
    const [row] = await this.db
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

  async createNumbers(data: CreateNumberData[]): Promise<void> {
    try {
      await this.db.insert(numberTable).values(
        data.map((d) => ({
          idTanda: d.idTanda,
          roundNumber: d.roundNumber,
          numberValue: d.numberValue,
          idUser: d.idUser,
          isDeadNumber: d.isDeadNumber,
          status: d.status as any,
        })),
      );
    } catch (error: any) {
      // Otro usuario apartó alguno de los números entre la consulta y el insert
      const code = error?.code || error?.cause?.code;
      if (code === '23505') {
        // detail: Key (id_tanda, round_number, number_value)=(7, 1, 3) already exists.
        const detail: string = error?.detail ?? error?.cause?.detail ?? '';
        const tomado = /=\(\d+, (\d+), (\d+)\)/.exec(detail);
        throw tomado
          ? new NumeroYaTomadoError(Number(tomado[2]), Number(tomado[1]))
          : new NumeroYaTomadoError(data[0].numberValue, data[0].roundNumber);
      }
      throw error;
    }
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

  async countNumbersWithoutPayment(idTanda: number, idUser?: number): Promise<number> {
    const [res] = await this.db
      .select({ total: count() })
      .from(numberTable)
      .leftJoin(
        paymentTable,
        and(
          eq(paymentTable.idNumber, numberTable.idNumber),
          inArray(paymentTable.status, ['PENDIENTE', 'CONFIRMADO']),
        ),
      )
      .where(
        and(
          eq(numberTable.idTanda, idTanda),
          eq(numberTable.isDeadNumber, false),
          isNull(numberTable.deletedAt),
          isNull(paymentTable.idPayment),
          idUser !== undefined ? eq(numberTable.idUser, idUser) : undefined,
        ),
      );

    return Number(res?.total ?? 0);
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
        userLastName: userTable.lastName,
        userEmail: userTable.email,
        idPayment: paymentTable.idPayment,
        estadoPago: paymentTable.status,
        montoPagado: paymentTable.totalAmount,
        fechaPago: paymentTable.createdAt,
        idPayout: payoutTable.idPayout,
      })
      .from(numberTable)
      .leftJoin(userTable, eq(numberTable.idUser, userTable.idUser))
      .leftJoin(
        paymentTable,
        and(
          eq(paymentTable.idNumber, numberTable.idNumber),
          inArray(paymentTable.status, ['PENDIENTE', 'CONFIRMADO']),
        ),
      )
      .leftJoin(
        payoutTable,
        and(
          eq(payoutTable.idNumber, numberTable.idNumber),
          inArray(payoutTable.status, ['PENDIENTE', 'CONFIRMADO']),
        ),
      )
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
      userLastName: r.userLastName,
      userEmail: r.userEmail,
      idPayment: r.idPayment,
      estadoPago: r.estadoPago,
      montoPagado: r.montoPagado === null ? null : Number(r.montoPagado),
      fechaPago: r.fechaPago,
      idPayout: r.idPayout,
    }));
  }


  async asignarSiLibre(
    idTanda: number,
    roundNumber: number,
    numberValue: number,
    idUsuario: number,
  ): Promise<NumeroTanda> {
    try {
      return await this.db.transaction(async (tx) => {
        // 1. UPDATE atómico a nivel de base de datos dentro de una transacción:
        // Solo actualiza si id_user es NULL, no es número muerto y no está borrado.
        const updatedRows = await tx
          .update(numberTable)
          .set({
            idUser: idUsuario,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(numberTable.idTanda, idTanda),
              eq(numberTable.roundNumber, roundNumber),
              eq(numberTable.numberValue, numberValue),
              isNull(numberTable.idUser),
              eq(numberTable.isDeadNumber, false),
              isNull(numberTable.deletedAt),
            ),
          )
          .returning();

        if (updatedRows.length > 0) {
          return NumeroMapper.toDomain(updatedRows[0]);
        }

        // 2. Si no actualizó ninguna fila, distinguir la causa exacta consultando la fila
        const [existing] = await tx
          .select()
          .from(numberTable)
          .where(
            and(
              eq(numberTable.idTanda, idTanda),
              eq(numberTable.roundNumber, roundNumber),
              eq(numberTable.numberValue, numberValue),
              isNull(numberTable.deletedAt),
            ),
          )
          .limit(1);

        if (!existing) {
          throw new NumeroInexistenteError(numberValue, idTanda);
        }

        if (existing.isDeadNumber) {
          throw new NumeroMuertoNoElegibleError(numberValue);
        }

        if (existing.idUser !== null) {
          throw new NumeroYaTomadoError(numberValue, roundNumber);
        }

        throw new NumeroYaTomadoError(numberValue, roundNumber);
      });
    } catch (error: any) {
      // En Drizzle 0.44 el error de PostgreSQL puede venir en error.code o error.cause.code
      const code = error?.code || error?.cause?.code;
      if (code === '23505') {
        throw new NumeroYaTomadoError(numberValue, roundNumber);
      }
      throw error;
    }
  }

  async findByTandaRoundAndValue(
    idTanda: number,
    roundNumber: number,
    numberValue: number,
  ): Promise<NumeroTanda | null> {
    const [row] = await this.db
      .select()
      .from(numberTable)
      .where(
        and(
          eq(numberTable.idTanda, idTanda),
          eq(numberTable.roundNumber, roundNumber),
          eq(numberTable.numberValue, numberValue),
          isNull(numberTable.deletedAt),
        ),
      )
      .limit(1);

    if (!row) {
      return null;
    }

    return NumeroMapper.toDomain(row);
  }


  // =========================================================================
  // HISTORIAL DE PAGOS Y COBROS (AP-09)
  // =========================================================================

  async listarMovimientos(
    idTanda: number,
    options: ListarMovimientosOptions,
  ): Promise<MovimientoRecord[]> {
    // Cada consulta ya viene ordenada y recortada a limit + 1; basta mezclarlas
    const [pagos, cobros] = await Promise.all([
      this.consultarMovimientos('PAGO', idTanda, options),
      this.consultarMovimientos('COBRO', idTanda, options),
    ]);

    return [...pagos, ...cobros]
      .sort(compararMovimientosDesc)
      .slice(0, options.limit + 1);
  }

  private async consultarMovimientos(
    tipo: TipoMovimiento,
    idTanda: number,
    { idUser, cursor, limit }: ListarMovimientosOptions,
  ): Promise<MovimientoRecord[]> {
    const tabla = tipo === 'PAGO' ? paymentTable : payoutTable;
    const id = tipo === 'PAGO' ? paymentTable.idPayment : payoutTable.idPayout;
    const fecha = sql<string>`to_char(${tabla.createdAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;

    const condiciones: SQL[] = [eq(numberTable.idTanda, idTanda)];
    if (idUser !== undefined) {
      condiciones.push(eq(numberTable.idUser, idUser));
    }
    if (cursor) {
      condiciones.push(condicionDespuesDelCursor(tipo, tabla.createdAt, id, cursor));
    }

    const rows = await this.db
      .select({
        id,
        idNumber: numberTable.idNumber,
        numero: numberTable.numberValue,
        idUser: numberTable.idUser,
        name: userTable.name,
        lastName: userTable.lastName,
        monto: tabla.totalAmount,
        transferAmount: tabla.transferAmount,
        cashAmount: tabla.cashAmount,
        estado: tabla.status,
        fecha,
      })
      .from(tabla)
      .innerJoin(numberTable, eq(numberTable.idNumber, tabla.idNumber))
      .leftJoin(userTable, eq(userTable.idUser, numberTable.idUser))
      .where(and(...condiciones))
      .orderBy(desc(tabla.createdAt), desc(id))
      .limit(limit + 1);

    return rows.map((r) => ({
      tipo,
      id: r.id,
      idNumber: r.idNumber,
      numero: r.numero,
      idUser: r.idUser,
      nombre: [r.name, r.lastName].filter(Boolean).join(' ') || null,
      monto: Number(r.monto),
      transferAmount: Number(r.transferAmount),
      cashAmount: Number(r.cashAmount),
      estado: r.estado,
      fecha: r.fecha,
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
      periodicity: row.periodicity,
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

/**
 * Orden del historial: fecha desc, luego tipo desc ('PAGO' > 'COBRO') y luego id desc.
 * Las fechas vienen con el mismo formato ISO, así que se comparan como texto.
 */
function compararMovimientosDesc(a: MovimientoRecord, b: MovimientoRecord): number {
  if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
  if (a.tipo !== b.tipo) return a.tipo < b.tipo ? 1 : -1;
  return b.id - a.id;
}

/**
 * Filas que van después del cursor en ese orden. Como el tipo es fijo en cada
 * consulta, la comparación de la tupla (fecha, tipo, id) se resuelve aquí.
 */
function condicionDespuesDelCursor(
  tipo: TipoMovimiento,
  createdAt: typeof paymentTable.createdAt | typeof payoutTable.createdAt,
  id: typeof paymentTable.idPayment | typeof payoutTable.idPayout,
  cursor: CursorHistorial,
): SQL {
  const fechaCursor = sql`${cursor.fecha}::timestamptz`;
  if (tipo > cursor.tipo) {
    return sql`${createdAt} < ${fechaCursor}`;
  }
  if (tipo < cursor.tipo) {
    return sql`${createdAt} <= ${fechaCursor}`;
  }
  return sql`(${createdAt} < ${fechaCursor} or (${createdAt} = ${fechaCursor} and ${id} < ${cursor.id}))`;
}

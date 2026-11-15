import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq, isNotNull } from 'drizzle-orm';
import {
  numberTable,
  paymentTable,
  roleTable,
  tandaTable,
  tandaTypeTable,
  userTable,
} from '../src/database/tandea.schema';
import { validateLocalDatabaseUrl } from '../src/database/seeds/tanda-type.seed';
import { CoberturaTurnosService } from '../src/tandas/application/services/cobertura-turnos.service';
import { DrizzleCoberturaRepository } from '../src/tandas/infrastructure/adapters/out/database/drizzle-cobertura.repository';
import { TandaService } from '../src/tandas/application/services/tanda.service';
import { DrizzleTandaRepository } from '../src/tandas/infrastructure/adapters/out/database/drizzle-tanda.repository';
import { EntregaService } from '../src/entregas/application/services/entrega.service';
import { DrizzleEntregaRepository } from '../src/entregas/infrastructure/adapters/out/database/drizzle-entrega.repository';

const testDbUrl = process.env.TEST_DATABASE_URL;

/**
 * [SP-4 BE-AJUSTE] Flujo del número muerto (AP-10) con los servicios y repositorios reales
 * contra PostgreSQL local (TEST_DATABASE_URL): una tanda donde dos participantes no pagan.
 *
 * Cada escenario crea su propia tanda; usa una base desechable, nunca la de Railway.
 * Quincenal desde 2026-09-01 con 2 días de gracia y cuota de $100:
 *   sin número muerto → turno 1 = #1 (cobra 09-01, vence 09-03)
 *   con número muerto → turno 1 = #0, turno 2 = #1 (cobra 09-16, vence 09-18)
 */
describe.skipIf(!testDbUrl)('Número muerto: cobertura, riesgo y monto a entregar (Integración)', () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle>;
  let cobertura: CoberturaTurnosService;
  let tandas: TandaService;
  let entregas: EntregaService;
  let idRol: number;
  let idTipo: number;
  let organizador: number;

  const eventos = {
    publicarTurnoEnRiesgo: vi.fn(),
    publicarNumeroMuertoUsado: vi.fn(),
  };
  const storage = { subir: vi.fn().mockResolvedValue('https://storage.test/evidencia.jpg') };
  const evidencia = { buffer: Buffer.from('foto'), mimetype: 'image/jpeg', nombreOriginal: 'e.jpg' };

  const crearUsuario = async (nombre: string) => {
    const [user] = await db
      .insert(userTable)
      .values({
        name: nombre,
        lastName: 'Muerto',
        email: `${nombre}_${Date.now()}_${Math.random()}@tandea.test`,
        passwordHash: 'hash',
        idRole: idRol,
      })
      .returning({ idUser: userTable.idUser });
    return user.idUser;
  };

  /** Tanda ACTIVA con números #1..#3 (y el #0 si `conMuerto`). `pagos` dice qué pago tiene cada número. */
  const crearTanda = async (
    conMuerto: boolean,
    pagos: Array<'CONFIRMADO' | 'PENDIENTE' | null>,
  ) => {
    const [tanda] = await db
      .insert(tandaTable)
      .values({
        name: `Tanda muerto ${Date.now()}_${Math.random()}`,
        startDate: '2026-09-01',
        contributionAmount: '100',
        numParticipants: 3,
        numRounds: 1,
        graceDays: 2,
        periodicity: 'quincenal',
        hasDeadNumber: conMuerto,
        idTandaType: idTipo,
        idAdmin: organizador,
        status: 'ACTIVA',
        inviteCode: `MU${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      })
      .returning({ idTanda: tandaTable.idTanda });

    let idMuerto: number | null = null;
    if (conMuerto) {
      const [m] = await db
        .insert(numberTable)
        .values({ idTanda: tanda.idTanda, roundNumber: 1, numberValue: 0, idUser: null, isDeadNumber: true })
        .returning({ idNumber: numberTable.idNumber });
      idMuerto = m.idNumber;
    }

    const numeros: number[] = [];
    for (const [i, pago] of pagos.entries()) {
      const idUser = await crearUsuario(`p${i + 1}`);
      const [n] = await db
        .insert(numberTable)
        .values({ idTanda: tanda.idTanda, roundNumber: 1, numberValue: i + 1, idUser, isDeadNumber: false })
        .returning({ idNumber: numberTable.idNumber });
      numeros.push(n.idNumber);
      if (pago) {
        await db.insert(paymentTable).values({
          idNumber: n.idNumber,
          cashAmount: '100',
          totalAmount: '100',
          confirmedByParticipant: true,
          confirmedByAdmin: pago === 'CONFIRMADO',
          status: pago,
        });
      }
    }
    return { idTanda: tanda.idTanda, numeros, idMuerto };
  };

  const estadoDe = async (idNumber: number) =>
    (await db.select().from(numberTable).where(eq(numberTable.idNumber, idNumber)))[0].status;

  const pagosDeCobertura = (idTanda: number) =>
    db
      .select({ idPayment: paymentTable.idPayment, idNumber: paymentTable.idNumber, status: paymentTable.status, total: paymentTable.totalAmount, idDeadNumber: paymentTable.idDeadNumber })
      .from(paymentTable)
      .innerJoin(numberTable, eq(numberTable.idNumber, paymentTable.idNumber))
      .where(and(eq(numberTable.idTanda, idTanda), isNotNull(paymentTable.idDeadNumber)));

  const comoOrganizador = () => ({ idUser: organizador, role: 'usuario' });

  beforeAll(async () => {
    validateLocalDatabaseUrl(testDbUrl!);
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool);

    const tandaRepo = new DrizzleTandaRepository(db);
    cobertura = new CoberturaTurnosService(new DrizzleCoberturaRepository(db), eventos);
    tandas = new TandaService(tandaRepo, tandaRepo);
    entregas = new EntregaService(new DrizzleEntregaRepository(db), storage, {
      publicarEntregaRegistrada: vi.fn(),
    });

    [{ idRole: idRol }] = await db.select().from(roleTable).where(eq(roleTable.nameRole, 'usuario'));
    [{ idTandaType: idTipo }] = await db.select().from(tandaTypeTable).limit(1);
    organizador = await crearUsuario('organizador');
  });

  afterAll(async () => {
    await pool?.end();
  });

  describe('sin número muerto', () => {
    it('marca el turno en riesgo, avisa una sola vez y bloquea la entrega', async () => {
      eventos.publicarTurnoEnRiesgo.mockClear();
      const t = await crearTanda(false, ['CONFIRMADO', null, null]);

      const primera = await cobertura.revisarTurnosVencidos(new Date('2026-09-04T15:00:00.000Z'));
      expect(primera.enRiesgo).toBeGreaterThanOrEqual(1);
      expect(await estadoDe(t.numeros[0])).toBe('EN_RIESGO');
      expect(eventos.publicarTurnoEnRiesgo).toHaveBeenCalledWith(
        expect.objectContaining({ idTanda: t.idTanda, numero: 1, pagosFaltantes: 2, montoFaltante: 200 }),
      );

      // Segunda corrida el mismo día: no repite el aviso de esta tanda
      eventos.publicarTurnoEnRiesgo.mockClear();
      await cobertura.revisarTurnosVencidos(new Date('2026-09-04T15:30:00.000Z'));
      expect(eventos.publicarTurnoEnRiesgo).not.toHaveBeenCalledWith(
        expect.objectContaining({ idTanda: t.idTanda }),
      );

      // El seguimiento lo muestra bloqueado y la entrega se rechaza
      const seguimiento = await tandas.obtenerSeguimiento(t.idTanda, organizador, 'usuario');
      expect(seguimiento.turnoVigente).toMatchObject({ numberValue: 1, estadoTurno: 'EN_RIESGO', bloqueado: true });
      expect(seguimiento.participantes[0].estadoTurno).toBe('EN_RIESGO');
      await expect(
        entregas.registrar({ idNumber: t.numeros[0], transferAmount: 100, cashAmount: 0, evidencia }, comoOrganizador()),
      ).rejects.toThrow('faltan 2 pagos por regularizar');
    });

    it('al regularizarse los pagos el turno vuelve a pendiente y se puede entregar lo descontado', async () => {
      const t = await crearTanda(false, ['CONFIRMADO', null, null]);
      await cobertura.revisarTurnosVencidos(new Date('2026-09-04T15:00:00.000Z'));
      expect(await estadoDe(t.numeros[0])).toBe('EN_RIESGO');

      // Los otros dos pagan (uno ya confirmado, otro pendiente de revisar)
      for (const [i, estado] of [[1, 'CONFIRMADO'], [2, 'PENDIENTE']] as const) {
        await db.insert(paymentTable).values({
          idNumber: t.numeros[i],
          cashAmount: '100',
          totalAmount: '100',
          confirmedByParticipant: true,
          confirmedByAdmin: estado === 'CONFIRMADO',
          status: estado,
        });
      }
      await cobertura.revisarTurnosVencidos(new Date('2026-09-05T15:00:00.000Z'));
      expect(await estadoDe(t.numeros[0])).toBe('PENDIENTE');

      // Hay una cuota sin confirmar: se entregan $200 en vez de $300
      const seguimiento = await tandas.obtenerSeguimiento(t.idTanda, organizador, 'usuario');
      expect(seguimiento.turnoVigente).toMatchObject({
        totalTurno: 300,
        descuento: 100,
        montoAEntregar: 200,
        cuotasNoConfirmadas: 1,
        bloqueado: false,
      });
      await expect(
        entregas.registrar({ idNumber: t.numeros[0], transferAmount: 300, cashAmount: 0, evidencia }, comoOrganizador()),
      ).rejects.toThrow('deben sumar 200.00');
      await expect(
        entregas.registrar({ idNumber: t.numeros[0], transferAmount: 200, cashAmount: 0, evidencia }, comoOrganizador()),
      ).resolves.toMatchObject({ totalAmount: 200 });
    });
  });

  describe('con número muerto', () => {
    it('cubre los pagos faltantes una sola vez y lo refleja el seguimiento', async () => {
      eventos.publicarNumeroMuertoUsado.mockClear();
      eventos.publicarTurnoEnRiesgo.mockClear();
      const t = await crearTanda(true, ['CONFIRMADO', null, null]);

      // 09-19: ya venció el turno 2 (#1); el turno 1 era el #0
      const r = await cobertura.revisarTurnosVencidos(new Date('2026-09-19T15:00:00.000Z'));
      expect(r.cubiertos).toBeGreaterThanOrEqual(2);

      const cubiertos = await pagosDeCobertura(t.idTanda);
      expect(cubiertos.map((p) => p.idNumber).sort()).toEqual([t.numeros[1], t.numeros[2]].sort());
      for (const p of cubiertos) {
        expect(p).toMatchObject({ status: 'CONFIRMADO', total: '100.00', idDeadNumber: t.idMuerto });
      }
      expect(eventos.publicarNumeroMuertoUsado).toHaveBeenCalledWith(
        expect.objectContaining({ idTanda: t.idTanda, idNumeroMuerto: t.idMuerto, montoCubierto: 200 }),
      );
      expect(await estadoDe(t.numeros[0])).toBe('PENDIENTE'); // nada en riesgo

      // Idempotente: otra corrida no crea más pagos ni repite el evento de esta tanda
      eventos.publicarNumeroMuertoUsado.mockClear();
      await cobertura.revisarTurnosVencidos(new Date('2026-09-19T16:00:00.000Z'));
      expect(await pagosDeCobertura(t.idTanda)).toHaveLength(2);
      // Se revisan todas las tandas activas de la base; aquí solo importa esta
      const deEstaTanda = expect.objectContaining({ idTanda: t.idTanda });
      expect(eventos.publicarNumeroMuertoUsado).not.toHaveBeenCalledWith(deEstaTanda);
      expect(eventos.publicarTurnoEnRiesgo).not.toHaveBeenCalledWith(deEstaTanda);

      const seguimiento = await tandas.obtenerSeguimiento(t.idTanda, organizador, 'usuario');
      expect(seguimiento.numeroMuerto).toMatchObject({ pagosCubiertos: 2, montoCubierto: 200 });
      expect(seguimiento.participantes.map((p) => p.cubiertoPorNumeroMuerto)).toEqual([false, true, true]);
      expect(seguimiento.turnoVigente).toMatchObject({ numberValue: 1, montoAEntregar: 300 });
    });

    it('el número muerto no se puede cobrar mientras queden turnos por entregar', async () => {
      const t = await crearTanda(true, ['CONFIRMADO', 'CONFIRMADO', 'CONFIRMADO']);

      await expect(
        entregas.registrar({ idNumber: t.idMuerto!, transferAmount: 300, cashAmount: 0, evidencia }, comoOrganizador()),
      ).rejects.toThrow('solo puede cobrarse al terminar la vuelta 1');
    });
  });
});

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import {
  evidenceTable,
  numberTable,
  payoutTable,
  roleTable,
  tandaTable,
  userTable,
} from '../src/database/tandea.schema';
import { validateLocalDatabaseUrl } from '../src/database/seeds/tanda-type.seed';
import { TandaService } from '../src/tandas/application/services/tanda.service';
import { DrizzleTandaRepository } from '../src/tandas/infrastructure/adapters/out/database/drizzle-tanda.repository';
import { PagoService } from '../src/pagos/application/services/pago.service';
import { DrizzlePagoRepository } from '../src/pagos/infrastructure/adapters/out/database/drizzle-pago.repository';
import { EntregaService } from '../src/entregas/application/services/entrega.service';
import { DrizzleEntregaRepository } from '../src/entregas/infrastructure/adapters/out/database/drizzle-entrega.repository';

const testDbUrl = process.env.TEST_DATABASE_URL;

/**
 * [QA-ENTREGA] Flujo crear → unirse → iniciar → pagar → confirmar → entregar → cerrar turno.
 *
 * Usa los servicios y repositorios reales contra PostgreSQL local (TEST_DATABASE_URL);
 * solo se simulan el almacenamiento, el OCR y los eventos.
 */
describe.skipIf(!testDbUrl)('Flujo completo de una tanda (Integración)', () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle>;
  let tandas: TandaService;
  let pagos: PagoService;
  let entregas: EntregaService;

  let organizador: number;
  let participantes: number[];
  let idTanda: number;

  const evidencia = { buffer: Buffer.from('foto'), mimetype: 'image/jpeg', nombreOriginal: 'e.jpg' };
  const comoOrganizador = () => ({ idUser: organizador, role: 'usuario' });

  const crearUsuario = async (idRole: number, nombre: string) => {
    const [user] = await db
      .insert(userTable)
      .values({
        name: nombre,
        lastName: 'Prueba',
        email: `${nombre}_${Date.now()}_${Math.random()}@tandea.test`,
        passwordHash: 'hash',
        idRole,
      })
      .returning({ idUser: userTable.idUser });
    return user.idUser;
  };

  const numeroDe = async (valor: number) => {
    const filas = await db.select().from(numberTable).where(eq(numberTable.idTanda, idTanda));
    return filas.find((n) => n.numberValue === valor)!;
  };

  const estadoTanda = async () => {
    const [tanda] = await db.select().from(tandaTable).where(eq(tandaTable.idTanda, idTanda));
    return tanda.status;
  };

  beforeAll(async () => {
    validateLocalDatabaseUrl(testDbUrl!);
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool);

    const tandaRepo = new DrizzleTandaRepository(db);
    const storage = { subir: vi.fn().mockResolvedValue('https://storage.test/evidencia.jpg') };
    const ocr = { verificarMonto: vi.fn().mockResolvedValue({ montoDetectado: null }) };
    const eventos = {
      publicarPagoRegistrado: vi.fn(),
      publicarPagoConfirmado: vi.fn(),
      publicarPagoRechazado: vi.fn(),
    };
    tandas = new TandaService(tandaRepo, tandaRepo);
    pagos = new PagoService(new DrizzlePagoRepository(db), storage, ocr as never, eventos);
    entregas = new EntregaService(new DrizzleEntregaRepository(db), storage);

    const [rol] = await db.select().from(roleTable).where(eq(roleTable.nameRole, 'usuario'));
    organizador = await crearUsuario(rol.idRole, 'organizador');
    participantes = [
      await crearUsuario(rol.idRole, 'ana'),
      await crearUsuario(rol.idRole, 'luis'),
      await crearUsuario(rol.idRole, 'eva'),
    ];
  });

  afterAll(async () => {
    await pool?.end();
  });

  it('crea la tanda con número muerto #0 y la fecha final con el periodo extra', async () => {
    const tanda = await tandas.crearTanda({
      name: 'Tanda integración',
      startDate: '2026-11-01',
      contributionAmount: 100,
      numParticipants: 3,
      periodicity: 'quincenal',
      hasDeadNumber: true,
      idAdmin: organizador,
    });
    idTanda = tanda.idTanda!;

    expect(tanda.endDate).toBe('2026-12-16');
    expect((await numeroDe(0)).isDeadNumber).toBe(true);
  });

  it('no deja iniciar ni pagar hasta que estén apartados todos los números', async () => {
    const [tanda] = await db.select().from(tandaTable).where(eq(tandaTable.idTanda, idTanda));

    await tandas.unirseTanda({
      inviteCode: tanda.inviteCode,
      idUser: participantes[0],
      selectedNumbers: [1],
    });

    await expect(tandas.cambiarEstadoTanda(idTanda, 'ACTIVA', organizador, 'usuario')).rejects.toThrow(
      'Faltan 2 números',
    );
    await expect(
      pagos.registrar({
        idUser: participantes[0],
        idNumber: (await numeroDe(1)).idNumber,
        metodoPago: 'efectivo',
        cashAmount: 100,
        comprobante: null,
      }),
    ).rejects.toThrow('inicia la tanda');

    for (const [i, valor] of [[1, 2], [2, 3]]) {
      await tandas.unirseTanda({
        inviteCode: tanda.inviteCode,
        idUser: participantes[i],
        selectedNumbers: [valor],
      });
    }
    await tandas.cambiarEstadoTanda(idTanda, 'ACTIVA', organizador, 'usuario');

    expect(await estadoTanda()).toBe('ACTIVA');
  });

  it('el organizador ve en el seguimiento quién pagó y puede confirmarlo', async () => {
    const pago = await pagos.registrar({
      idUser: participantes[0],
      idNumber: (await numeroDe(1)).idNumber,
      metodoPago: 'efectivo',
      cashAmount: 100,
      comprobante: null,
    });

    let seguimiento = await tandas.obtenerSeguimiento(idTanda, organizador, 'usuario');
    expect(seguimiento.participantes[0]).toMatchObject({
      numberValue: 1,
      estadoPago: 'PENDIENTE',
      idPayment: pago.idPayment,
    });
    expect(seguimiento.participantes[1].idPayment).toBeNull();

    await pagos.confirmar(pago.idPayment!, { idUser: organizador, role: 'usuario' } as never);

    seguimiento = await tandas.obtenerSeguimiento(idTanda, organizador, 'usuario');
    expect(seguimiento.participantes[0].estadoPago).toBe('CONFIRMADO');

    const detalle = await tandas.obtenerTandaPorId(idTanda, participantes[0], 'usuario');
    expect(detalle.misNumeros?.[0]).toMatchObject({ numberValue: 1, estadoPago: 'CONFIRMADO' });
  });

  it('no deja entregar un turno que no es el vigente', async () => {
    const numero = await numeroDe(2);

    await expect(
      entregas.registrar(
        { idNumber: numero.idNumber, transferAmount: 300, cashAmount: 0, evidencia },
        comoOrganizador(),
      ),
    ).rejects.toThrow('Aún no es el turno del número #2');
  });

  it('registra la entrega con evidencia y queda esperando al receptor', async () => {
    const numero = await numeroDe(1);

    const entrega = await entregas.registrar(
      { idNumber: numero.idNumber, transferAmount: 200, cashAmount: 100, evidencia },
      comoOrganizador(),
    );

    expect(entrega).toMatchObject({ totalAmount: 300, status: 'PENDIENTE', confirmedByAdmin: true });
    expect((await numeroDe(1)).status).toBe('ENTREGA_PENDIENTE_CONFIRMACION');
    const evidencias = await db
      .select()
      .from(evidenceTable)
      .where(eq(evidenceTable.idPayout, entrega.idPayout));
    expect(evidencias).toHaveLength(1);

    await expect(
      entregas.registrar(
        { idNumber: numero.idNumber, transferAmount: 300, cashAmount: 0, evidencia },
        comoOrganizador(),
      ),
    ).rejects.toThrow('ya tiene una entrega');
  });

  it('un problema reportado no cierra el turno; la confirmación del receptor sí', async () => {
    const numero = await numeroDe(1);
    const [payout] = await db
      .select()
      .from(payoutTable)
      .where(eq(payoutTable.idNumber, numero.idNumber));
    const receptor = { idUser: participantes[0], role: 'usuario' };

    await entregas.reportarProblema(payout.idPayout, 'Faltó dinero', receptor);
    expect((await numeroDe(1)).status).toBe('ENTREGA_PENDIENTE_CONFIRMACION');

    const entrega = await entregas.confirmar(payout.idPayout, receptor);

    expect(entrega).toMatchObject({ status: 'CONFIRMADO', confirmedByRecipient: true });
    expect((await numeroDe(1)).status).toBe('ENTREGADO');
    expect(await estadoTanda()).toBe('ACTIVA');
    await expect(entregas.confirmar(payout.idPayout, receptor)).rejects.toThrow('ya fue confirmada');
  });

  it('al cerrar el último turno la tanda queda FINALIZADA', async () => {
    for (const [i, valor] of [[1, 2], [2, 3]]) {
      const numero = await numeroDe(valor);
      const entrega = await entregas.registrar(
        { idNumber: numero.idNumber, transferAmount: 300, cashAmount: 0, evidencia },
        comoOrganizador(),
      );
      await entregas.confirmar(entrega.idPayout, { idUser: participantes[i], role: 'usuario' });
    }

    expect(await estadoTanda()).toBe('FINALIZADA');
  });
});

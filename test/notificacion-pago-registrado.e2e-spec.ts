import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq } from 'drizzle-orm';
import { notificationTable, numberTable, roleTable, tandaTable, userTable } from '../src/database/tandea.schema';
import { validateLocalDatabaseUrl } from '../src/database/seeds/tanda-type.seed';
import { DATABASE_TOKEN } from '../src/common/tokens';
import { PagoModule } from '../src/pagos/pago.module';
import { PAGO_SERVICE_PORT, type PagoUseCasesPort } from '../src/pagos/domain/ports/in/pago-use-cases.port';
import { STORAGE_PORT } from '../src/pagos/domain/ports/out/storage.port';
import { CloudinaryAdapter } from '../src/pagos/infrastructure/adapters/out/storage/cloudinary.adapter';
import { NotificacionModule } from '../src/notificaciones/notificacion.module';
import { NOTIFICACION_PORT } from '../src/notificaciones/domain/ports/out/notificacion.port';
import { TandaService } from '../src/tandas/application/services/tanda.service';
import { DrizzleTandaRepository } from '../src/tandas/infrastructure/adapters/out/database/drizzle-tanda.repository';

const testDbUrl = process.env.TEST_DATABASE_URL;

/**
 * [QA-NOTIF] Integración evento PagoRegistrado → notificación generada.
 *
 * Módulos reales de Nest (Pagos + Notificaciones + bus de eventos) contra PostgreSQL
 * local. Solo se simula NotificacionPort (el push) y Cloudinary, que es externo
 * y no se usa en un pago en efectivo.
 */
describe.skipIf(!testDbUrl)('Pago registrado genera notificación (Integración)', () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle>;
  let moduleRef: TestingModule;
  const push = { enviar: vi.fn().mockResolvedValue(undefined) };

  let organizador: number;
  let participantes: number[];
  let idTanda: number;

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

  beforeAll(async () => {
    validateLocalDatabaseUrl(testDbUrl!);
    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool);

    const almacenamientoFalso = { subir: vi.fn() };
    moduleRef = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot(), PagoModule, NotificacionModule],
    })
      .overrideProvider(DATABASE_TOKEN)
      .useValue(db)
      .overrideProvider(NOTIFICACION_PORT)
      .useValue(push)
      .overrideProvider(STORAGE_PORT)
      .useValue(almacenamientoFalso)
      .overrideProvider(CloudinaryAdapter)
      .useValue(almacenamientoFalso)
      .compile();
    await moduleRef.init();

    // La tanda se arma con los servicios reales de Tandas, fuera del módulo bajo prueba
    const [rol] = await db.select().from(roleTable).where(eq(roleTable.nameRole, 'usuario'));
    organizador = await crearUsuario(rol.idRole, 'organizador');
    participantes = [
      await crearUsuario(rol.idRole, 'ana'),
      await crearUsuario(rol.idRole, 'luis'),
      await crearUsuario(rol.idRole, 'eva'),
    ];

    const tandaRepo = new DrizzleTandaRepository(db);
    const tandas = new TandaService(tandaRepo, tandaRepo);
    const tanda = await tandas.crearTanda({
      name: 'Tanda QA-NOTIF',
      startDate: '2026-11-01',
      contributionAmount: 100,
      numParticipants: 3,
      periodicity: 'quincenal',
      hasDeadNumber: false,
      idAdmin: organizador,
    });
    idTanda = tanda.idTanda!;
    for (const [i, valor] of participantes.entries()) {
      await tandas.unirseTanda({ inviteCode: tanda.inviteCode, idUser: valor, selectedNumbers: [i + 1] });
    }
    await tandas.cambiarEstadoTanda(idTanda, 'ACTIVA', organizador, 'usuario');
  });

  afterAll(async () => {
    await moduleRef?.close();
    await pool?.end();
  });

  it('guarda la notificación del organizador y manda el push', async () => {
    const [numero] = await db
      .select()
      .from(numberTable)
      .where(and(eq(numberTable.idTanda, idTanda), eq(numberTable.numberValue, 1)));

    const pagos = moduleRef.get<PagoUseCasesPort>(PAGO_SERVICE_PORT);
    const pago = await pagos.registrar({
      idUser: participantes[0],
      idNumber: numero.idNumber,
      metodoPago: 'efectivo',
      cashAmount: 100,
      comprobante: null,
    });

    // El listener corre asíncrono respecto a quien emite
    await vi.waitFor(() => expect(push.enviar).toHaveBeenCalledTimes(1));

    const filas = await db
      .select()
      .from(notificationTable)
      .where(and(eq(notificationTable.idUser, organizador), eq(notificationTable.idTanda, idTanda)));
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ type: 'pago_registrado', isRead: false });
    expect(filas[0].message).toContain('Tanda QA-NOTIF');

    expect(push.enviar).toHaveBeenCalledWith(
      organizador,
      'Nuevo pago por revisar',
      filas[0].message,
      { type: 'pago_registrado', route: `/pagos/${pago.idPayment}/revisar` },
    );

    // El participante no recibe aviso de su propio pago
    const delParticipante = await db
      .select()
      .from(notificationTable)
      .where(eq(notificationTable.idUser, participantes[0]));
    expect(delParticipante).toHaveLength(0);

    const [tanda] = await db.select().from(tandaTable).where(eq(tandaTable.idTanda, idTanda));
    expect(tanda.status).toBe('ACTIVA');
  });
});

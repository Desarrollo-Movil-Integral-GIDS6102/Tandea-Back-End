import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { PassportModule } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { PagoController } from '../src/pagos/infrastructure/adapters/in/http/controllers/pago.controller';
import { PAGO_SERVICE_PORT } from '../src/pagos/domain/ports/in/pago-use-cases.port';
import { JwtStrategy } from '../src/auth/infrastructure/adapters/in/http/strategies/jwt.strategy';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { Pago } from '../src/pagos/domain/entities/Pago';
import {
  ConfirmacionOrganizadorPreviaError,
  PagoNotFoundError,
  PagoRechazadoError,
  PagoYaConfirmadoError,
  UsuarioNoAutorizadoError,
} from '../src/pagos/domain/errors/pago.errors';

describe('PagoController — Confirmación y Rechazo (SP-3-[BE-PAGO] / AP-05)', () => {
  let app: NestFastifyApplication;
  let jwtService: JwtService;
  let tokenOrganizador: string;
  let tokenNoAutorizado: string;

  const servicio = {
    registrar: vi.fn(),
    obtenerPago: vi.fn(),
    confirmar: vi.fn(),
    rechazar: vi.fn(),
    confirmarOrganizador: vi.fn(),
    actualizarResultadoOcr: vi.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [PagoController],
      providers: [
        JwtStrategy,
        { provide: PAGO_SERVICE_PORT, useValue: servicio },
      ],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.setGlobalPrefix('api/v1');
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    jwtService = new JwtService({
      secret: process.env.JWT_SECRET ?? 'tandea_secret_key_sprint1',
    });

    tokenOrganizador = jwtService.sign({
      sub: 10,
      email: 'organizador@tandea.test',
      role: 'usuario',
    });

    tokenNoAutorizado = jwtService.sign({
      sub: 99,
      email: 'ajeno@tandea.test',
      role: 'usuario',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const crearPago = (overrides: Partial<Parameters<typeof Pago.reconstitute>[0]> = {}): Pago => {
    return Pago.reconstitute({
      idPayment: 15,
      idNumber: 3,
      metodoPago: 'transferencia',
      transferAmount: 1000,
      cashAmount: 0,
      totalAmount: 1000,
      status: 'PENDIENTE',
      confirmedByParticipant: true,
      confirmedByAdmin: false,
      evidenceUrl: 'https://storage.tandea.test/evidencias/pago_15.jpg',
      ocrVerified: true,
      ocrDetectedAmount: 1000,
      createdAt: new Date('2026-10-20T10:00:00Z'),
      updatedAt: new Date('2026-10-20T10:00:00Z'),
      ...overrides,
    });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // PATCH /api/v1/pagos/:id/confirmar
  // ─────────────────────────────────────────────────────────────────────────

  describe('PATCH /api/v1/pagos/:id/confirmar', () => {
    const patchConfirmar = (id: number | string, headers?: Record<string, string>) =>
      app.inject({
        method: 'PATCH',
        url: `/api/v1/pagos/${id}/confirmar`,
        headers: {
          authorization: `Bearer ${tokenOrganizador}`,
          ...headers,
        },
      });

    it('200 OK: confirmación exitosa por parte del organizador', async () => {
      const pagoConfirmado = crearPago({
        confirmedByAdmin: true,
        status: 'CONFIRMADO',
      });
      servicio.confirmar.mockResolvedValue(pagoConfirmado);

      const res = await patchConfirmar(15);

      expect(res.statusCode).toBe(200);
      expect(servicio.confirmar).toHaveBeenCalledWith(
        15,
        expect.objectContaining({ idUser: 10 }),
      );

      const body = res.json();
      expect(body).toMatchObject({
        idPayment: 15,
        status: 'CONFIRMADO',
        confirmedByAdmin: true,
        confirmedByParticipant: true,
      });
    });

    it('401 Unauthorized: sin cabecera Authorization o token inválido', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/pagos/15/confirmar',
      });

      expect(res.statusCode).toBe(401);
      expect(servicio.confirmar).not.toHaveBeenCalled();
    });

    it('403 Forbidden: usuario autenticado pero sin permisos sobre la tanda', async () => {
      servicio.confirmar.mockRejectedValue(new UsuarioNoAutorizadoError());

      const res = await patchConfirmar(15, {
        authorization: `Bearer ${tokenNoAutorizado}`,
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().message).toContain('Solo el organizador de la tanda');
    });

    it('404 Not Found: pago inexistente', async () => {
      servicio.confirmar.mockRejectedValue(new PagoNotFoundError(999));

      const res = await patchConfirmar(999);

      expect(res.statusCode).toBe(404);
      expect(res.json().message).toBe('Pago con id "999" no encontrado');
    });

    it('422 Unprocessable Entity: el organizador ya confirmó previamente este pago', async () => {
      servicio.confirmar.mockRejectedValue(new ConfirmacionOrganizadorPreviaError());

      const res = await patchConfirmar(15);

      expect(res.statusCode).toBe(422);
      expect(res.json().message).toBe('El organizador ya confirmó este pago');
    });

    it('422 Unprocessable Entity: el pago ya está completamente confirmado', async () => {
      servicio.confirmar.mockRejectedValue(new PagoYaConfirmadoError());

      const res = await patchConfirmar(15);

      expect(res.statusCode).toBe(422);
      expect(res.json().message).toBe('Este pago ya está completamente confirmado');
    });

    it('422 Unprocessable Entity: el pago se encuentra en estado rechazado', async () => {
      servicio.confirmar.mockRejectedValue(new PagoRechazadoError());

      const res = await patchConfirmar(15);

      expect(res.statusCode).toBe(422);
      expect(res.json().message).toBe('El pago fue rechazado y no admite más confirmaciones');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // PATCH /api/v1/pagos/:id/rechazar
  // ─────────────────────────────────────────────────────────────────────────

  describe('PATCH /api/v1/pagos/:id/rechazar', () => {
    const patchRechazar = (
      id: number | string,
      payload?: unknown,
      headers?: Record<string, string>,
    ) =>
      app.inject({
        method: 'PATCH',
        url: `/api/v1/pagos/${id}/rechazar`,
        payload: payload ?? { motivo: 'Comprobante no coincide con la cuenta destino' },
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${tokenOrganizador}`,
          ...headers,
        },
      });

    it('200 OK: rechazo exitoso por el organizador con motivo válido', async () => {
      const motivo = 'Comprobante no coincide con la cuenta destino';
      const pagoRechazado = crearPago({
        status: 'RECHAZADO',
        rejectionReason: motivo,
      });
      servicio.rechazar.mockResolvedValue(pagoRechazado);

      const res = await patchRechazar(15, { motivo });

      expect(res.statusCode).toBe(200);
      expect(servicio.rechazar).toHaveBeenCalledWith(
        15,
        motivo,
        expect.objectContaining({ idUser: 10 }),
      );

      const body = res.json();
      expect(body).toMatchObject({
        idPayment: 15,
        status: 'RECHAZADO',
        rejectionReason: motivo,
      });
    });

    it('401 Unauthorized: sin token', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/pagos/15/rechazar',
        payload: { motivo: 'Motivo de prueba válido' },
        headers: { 'content-type': 'application/json' },
      });

      expect(res.statusCode).toBe(401);
      expect(servicio.rechazar).not.toHaveBeenCalled();
    });

    it('403 Forbidden: usuario sin permisos sobre la tanda', async () => {
      servicio.rechazar.mockRejectedValue(new UsuarioNoAutorizadoError());

      const res = await patchRechazar(
        15,
        { motivo: 'Comprobante ilegible' },
        { authorization: `Bearer ${tokenNoAutorizado}` },
      );

      expect(res.statusCode).toBe(403);
    });

    it('404 Not Found: pago inexistente', async () => {
      servicio.rechazar.mockRejectedValue(new PagoNotFoundError(888));

      const res = await patchRechazar(888, { motivo: 'Comprobante ilegible' });

      expect(res.statusCode).toBe(404);
    });

    it.each([
      ['cuerpo vacío', {}],
      ['motivo menor a 5 caracteres', { motivo: 'no' }],
      ['motivo ausente', { otroCampo: 'texto' }],
      ['motivo que excede 500 caracteres', { motivo: 'a'.repeat(501) }],
    ])('422 Unprocessable Entity (Zod): validación de motivo (%s)', async (_caso, payload) => {
      const res = await patchRechazar(15, payload);

      expect(res.statusCode).toBe(422);
      expect(servicio.rechazar).not.toHaveBeenCalled();
    });

    it('422 Unprocessable Entity: no permite rechazar pagos ya confirmados', async () => {
      servicio.rechazar.mockRejectedValue(new PagoYaConfirmadoError());

      const res = await patchRechazar(15, {
        motivo: 'Intento de rechazar tras haber confirmado',
      });

      expect(res.statusCode).toBe(422);
      expect(res.json().message).toBe('Este pago ya está completamente confirmado');
    });
  });
});

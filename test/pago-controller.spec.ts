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
import { DATABASE_TOKEN } from '../src/common/tokens';
import { JwtStrategy } from '../src/auth/infrastructure/adapters/in/http/strategies/jwt.strategy';
import { TandaMemberGuard } from '../src/auth/infrastructure/adapters/in/http/guards/tanda-member.guard';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { Pago } from '../src/pagos/domain/entities/Pago';
import { PagoFactory } from '../src/pagos/domain/factories/pago.factory';
import {
  ConfirmacionOrganizadorPreviaError,
  MontoHibridoInvalidoError,
  NumeroAjenoError,
  NumeroNoEncontradoError,
  PagoDuplicadoError,
  PagoNotFoundError,
  PagoRechazadoError,
  PagoYaConfirmadoError,
} from '../src/pagos/domain/errors/pago.errors';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PDF = Buffer.from('%PDF-1.7\n%comprobante');

interface ArchivoForm {
  field?: string;
  filename: string;
  contentType: string;
  content: Buffer;
}

function multipart(fields: Record<string, string>, archivo?: ArchivoForm) {
  const boundary = '----tandea-test-boundary';
  const partes: Buffer[] = [];

  for (const [name, value] of Object.entries(fields)) {
    partes.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
      ),
    );
  }

  if (archivo) {
    partes.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${archivo.field ?? 'file'}"; filename="${archivo.filename}"\r\nContent-Type: ${archivo.contentType}\r\n\r\n`,
      ),
      archivo.content,
      Buffer.from('\r\n'),
    );
  }

  partes.push(Buffer.from(`--${boundary}--\r\n`));

  return {
    payload: Buffer.concat(partes),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

function pagoRegistrado(): Pago {
  const pago = PagoFactory.crear({
    idNumber: 10,
    metodoPago: 'hibrido',
    totalAmount: 1000,
    transferAmount: 600,
    cashAmount: 400,
    evidenceUrl: 'https://res.cloudinary.com/tandea/image/upload/comprobantes/pago.png',
    confirmedByParticipant: true,
  });
  return Pago.reconstitute({ ...pago.toPrimitives(), idPayment: 45 });
}

describe('PagoController', () => {
  let app: NestFastifyApplication;
  let token: string;
  const servicio = {
    registrar: vi.fn(),
    obtenerPago: vi.fn(),
    confirmar: vi.fn(),
    rechazar: vi.fn(),
    confirmarOrganizador: vi.fn(),
    confirmarReceptor: vi.fn(),
    actualizarResultadoOcr: vi.fn(),
  };

  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [PagoController],
      providers: [
        JwtStrategy,
        TandaMemberGuard,
        { provide: PAGO_SERVICE_PORT, useValue: servicio },
        { provide: DATABASE_TOKEN, useValue: mockDb },
      ],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.setGlobalPrefix('api/v1');
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    token = new JwtService({
      secret: process.env.JWT_SECRET ?? 'tandea_secret_key_sprint1',
    }).sign({ sub: 7, email: 'ana@tandea.test', role: 'participante' });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    servicio.registrar.mockResolvedValue(pagoRegistrado());
    mockDb.limit.mockResolvedValue([{ idPayment: 45, idAdmin: 7 }]);
  });

  const camposHibrido = {
    idNumber: '10',
    metodoPago: 'hibrido',
    transferAmount: '600',
    cashAmount: '400',
  };

  const enviar = (
    form: ReturnType<typeof multipart>,
    headers: Record<string, string> = { authorization: `Bearer ${token}` },
  ) =>
    app.inject({
      method: 'POST',
      url: '/api/v1/pagos',
      payload: form.payload,
      headers: { 'content-type': form.contentType, ...headers },
    });

  // ── POST /api/v1/pagos ───────────────────────────────────────────────────

  describe('POST /api/v1/pagos (multipart)', () => {
    it('201: registra un pago híbrido con comprobante PNG y responde sin datos sensibles', async () => {
      const res = await enviar(
        multipart(camposHibrido, { filename: 'spei.png', contentType: 'image/png', content: PNG }),
      );

      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({
        idPayment: 45,
        idNumber: 10,
        metodoPago: 'hibrido',
        totalAmount: 1000,
        transferAmount: 600,
        cashAmount: 400,
        status: 'PENDIENTE',
        confirmedByParticipant: true,
        confirmedByAdmin: false,
        evidenceUrl: expect.stringContaining('cloudinary'),
      });
      expect(JSON.stringify(res.json())).not.toMatch(/password|hash/i);
    });

    it('201: acepta comprobante JPG', async () => {
      const res = await enviar(
        multipart(camposHibrido, { filename: 'recibo.jpg', contentType: 'image/jpeg', content: JPG }),
      );
      expect(res.statusCode).toBe(201);
    });

    it('201: acepta comprobante PDF', async () => {
      const res = await enviar(
        multipart(camposHibrido, { filename: 'spei.pdf', contentType: 'application/pdf', content: PDF }),
      );
      expect(res.statusCode).toBe(201);
    });

    it('201: acepta pago en efectivo sin archivo', async () => {
      servicio.registrar.mockResolvedValue(
        Pago.reconstitute({
          idPayment: 46,
          idNumber: 10,
          metodoPago: 'efectivo',
          totalAmount: 1000,
          transferAmount: 0,
          cashAmount: 1000,
          status: 'PENDIENTE',
          confirmedByParticipant: true,
          confirmedByAdmin: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );

      const res = await enviar(
        multipart({ idNumber: '10', metodoPago: 'efectivo', cashAmount: '1000' }),
      );
      expect(res.statusCode).toBe(201);
      expect(res.json().metodoPago).toBe('efectivo');
      expect(res.json().evidenceUrl).toBeNull();
    });

    it('400: rechaza tipos de archivo no permitidos', async () => {
      const res = await enviar(
        multipart(camposHibrido, {
          filename: 'animacion.gif',
          contentType: 'image/gif',
          content: Buffer.from('GIF89a'),
        }),
      );
      expect(res.statusCode).toBe(400);
      expect(res.json().message).toContain('JPG, PNG o PDF');
      expect(servicio.registrar).not.toHaveBeenCalled();
    });

    it('400: rechaza un archivo cuyo contenido no coincide con el tipo declarado', async () => {
      const res = await enviar(
        multipart(camposHibrido, {
          filename: 'falso.png',
          contentType: 'image/png',
          content: Buffer.from('<script>alert(1)</script>'),
        }),
      );
      expect(res.statusCode).toBe(400);
      expect(servicio.registrar).not.toHaveBeenCalled();
    });

    it('400: rechaza el archivo en un campo distinto de "file"', async () => {
      const res = await enviar(
        multipart(camposHibrido, {
          field: 'comprobante',
          filename: 'spei.png',
          contentType: 'image/png',
          content: PNG,
        }),
      );
      expect(res.statusCode).toBe(400);
      expect(servicio.registrar).not.toHaveBeenCalled();
    });

    it('413: rechaza comprobantes de más de 10 MB', async () => {
      const res = await enviar(
        multipart(camposHibrido, {
          filename: 'pesado.png',
          contentType: 'image/png',
          content: Buffer.concat([PNG, Buffer.alloc(10 * 1024 * 1024 + 1)]),
        }),
      );
      expect(res.statusCode).toBe(413);
    });

    it('401: sin token', async () => {
      const res = await enviar(multipart(camposHibrido), {});
      expect(res.statusCode).toBe(401);
      expect(servicio.registrar).not.toHaveBeenCalled();
    });

    it('422: DTO inválido (método desconocido e idNumber no numérico)', async () => {
      const res = await enviar(multipart({ idNumber: 'abc', metodoPago: 'cheque' }));
      expect(res.statusCode).toBe(422);
      expect(servicio.registrar).not.toHaveBeenCalled();
    });

    it.each([
      ['403', new NumeroAjenoError(), 403],
      ['404', new NumeroNoEncontradoError(10), 404],
      ['409', new PagoDuplicadoError(10), 409],
      ['422 (suma híbrida)', new MontoHibridoInvalidoError(400, 500, 900, 1000), 422],
    ])('%s: traduce el error de dominio del caso de uso', async (_caso, error, status) => {
      servicio.registrar.mockRejectedValue(error);

      const res = await enviar(
        multipart(camposHibrido, { filename: 'spei.png', contentType: 'image/png', content: PNG }),
      );

      expect(res.statusCode).toBe(status);
      expect(res.json().message).toBe(error.message);
    });
  });

  // ── PATCH /api/v1/pagos/:id/confirmar (AP-05) ─────────────────────────────

  describe('PATCH /api/v1/pagos/:id/confirmar', () => {
    it('200: el admin de la tanda confirma el pago correctamente', async () => {
      const pagoConfirmado = Pago.reconstitute({
        idPayment: 45,
        idNumber: 10,
        metodoPago: 'transferencia',
        totalAmount: 1000,
        transferAmount: 1000,
        cashAmount: 0,
        status: 'PENDIENTE',
        confirmedByParticipant: false,
        confirmedByAdmin: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      servicio.confirmar.mockResolvedValue(pagoConfirmado);

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/pagos/45/confirmar',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        idPayment: 45,
        confirmedByAdmin: true,
        status: 'PENDIENTE',
      });
      expect(servicio.confirmar).toHaveBeenCalledWith(45, {
        idUser: 7,
        email: 'ana@tandea.test',
        role: 'participante',
      });
    });

    it('403: usuario que NO es admin de la tanda es rechazado por TandaMemberGuard', async () => {
      mockDb.limit.mockResolvedValue([{ idPayment: 45, idAdmin: 999 }]); // idAdmin 999 !== user 7

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/pagos/45/confirmar',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().message).toMatch(/Solo el administrador de la tanda/i);
      expect(servicio.confirmar).not.toHaveBeenCalled();
    });

    it('404: pago inexistente', async () => {
      mockDb.limit.mockResolvedValue([]); // No existe en BD
      servicio.confirmar.mockRejectedValue(new PagoNotFoundError(45));

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/pagos/45/confirmar',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().message).toMatch(/Pago con id "45" no encontrado/i);
    });

    it('422: confirmar un pago ya confirmado lanza 422', async () => {
      servicio.confirmar.mockRejectedValue(new PagoYaConfirmadoError());

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/pagos/45/confirmar',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(422);
      expect(res.json().message).toMatch(/ya está completamente confirmado/i);
    });

    it('422: confirmar un pago ya rechazado lanza 422', async () => {
      servicio.confirmar.mockRejectedValue(new PagoRechazadoError());

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/pagos/45/confirmar',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(422);
      expect(res.json().message).toMatch(/El pago fue rechazado y no admite más confirmaciones/i);
    });

    it('422: confirmar cuando el organizador ya confirmó lanza 422', async () => {
      servicio.confirmar.mockRejectedValue(new ConfirmacionOrganizadorPreviaError());

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/pagos/45/confirmar',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(422);
      expect(res.json().message).toMatch(/El organizador ya confirmó este pago/i);
    });
  });

  // ── PATCH /api/v1/pagos/:id/rechazar (AP-05) ──────────────────────────────

  describe('PATCH /api/v1/pagos/:id/rechazar', () => {
    it('200: el admin de la tanda rechaza el pago con motivo', async () => {
      const pagoRechazado = Pago.reconstitute({
        idPayment: 45,
        idNumber: 10,
        metodoPago: 'transferencia',
        totalAmount: 1000,
        transferAmount: 1000,
        cashAmount: 0,
        status: 'RECHAZADO',
        rejectionReason: 'Comprobante bancario apócrifo',
        confirmedByParticipant: true,
        confirmedByAdmin: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      servicio.rechazar.mockResolvedValue(pagoRechazado);

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/pagos/45/rechazar',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: { motivo: 'Comprobante bancario apócrifo' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        idPayment: 45,
        status: 'RECHAZADO',
        rejectionReason: 'Comprobante bancario apócrifo',
      });
      expect(servicio.rechazar).toHaveBeenCalledWith(
        45,
        'Comprobante bancario apócrifo',
        {
          idUser: 7,
          email: 'ana@tandea.test',
          role: 'participante',
        },
      );
    });

    it('403: usuario que NO es admin de la tanda recibe 403 al rechazar', async () => {
      mockDb.limit.mockResolvedValue([{ idPayment: 45, idAdmin: 999 }]);

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/pagos/45/rechazar',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: { motivo: 'Fondos no reflejados' },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().message).toMatch(/Solo el administrador de la tanda/i);
      expect(servicio.rechazar).not.toHaveBeenCalled();
    });

    it('422: rechazar sin cuerpo o sin motivo lanza 422 (Zod)', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/pagos/45/rechazar',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: {},
      });

      expect(res.statusCode).toBe(422);
      expect(servicio.rechazar).not.toHaveBeenCalled();
    });

    it('422: rechazar con motivo menor a 5 caracteres lanza 422 (Zod)', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/pagos/45/rechazar',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: { motivo: 'no' },
      });

      expect(res.statusCode).toBe(422);
      expect(res.json().message).toMatch(/al menos 5 caracteres/i);
      expect(servicio.rechazar).not.toHaveBeenCalled();
    });

    it('422: rechazar un pago ya confirmado lanza 422', async () => {
      servicio.rechazar.mockRejectedValue(new PagoYaConfirmadoError());

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/pagos/45/rechazar',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: { motivo: 'Comprobante inválido' },
      });

      expect(res.statusCode).toBe(422);
      expect(res.json().message).toMatch(/ya está completamente confirmado/i);
    });

    it('404: pago inexistente al rechazar', async () => {
      mockDb.limit.mockResolvedValue([]);
      servicio.rechazar.mockRejectedValue(new PagoNotFoundError(45));

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/pagos/45/rechazar',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        payload: { motivo: 'Fondos no recibidos' },
      });

      expect(res.statusCode).toBe(404);
    });
  });
});

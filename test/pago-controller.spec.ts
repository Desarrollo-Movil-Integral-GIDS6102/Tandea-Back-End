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
import { COMPROBANTE_MAX_BYTES } from '../src/pagos/infrastructure/adapters/in/http/multipart/comprobante.file';
import { Pago } from '../src/pagos/domain/entities/Pago';
import { PagoFactory } from '../src/pagos/domain/factories/pago.factory';
import {
  MontoHibridoInvalidoError,
  NumeroAjenoError,
  NumeroNoEncontradoError,
  PagoDuplicadoError,
} from '../src/pagos/domain/errors/pago.errors';

/**
 * [BE-PAGO] POST /api/v1/pagos (AP-03) — controlador sobre Fastify real
 * (multipart, JwtAuthGuard y filtros), con el caso de uso mockeado.
 */

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

describe('PagoController — POST /api/v1/pagos (multipart)', () => {
  let app: NestFastifyApplication;
  let token: string;
  const servicio = {
    registrar: vi.fn(),
    obtenerPago: vi.fn(),
    confirmarOrganizador: vi.fn(),
    confirmarReceptor: vi.fn(),
    actualizarResultadoOcr: vi.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [PagoController],
      providers: [JwtStrategy, { provide: PAGO_SERVICE_PORT, useValue: servicio }],
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

  // ── Casos exitosos ──────────────────────────────────────────────────────

  it('201: registra un pago híbrido con comprobante PNG y responde sin datos sensibles', async () => {
    const res = await enviar(
      multipart(camposHibrido, { filename: 'spei.png', contentType: 'image/png', content: PNG }),
    );

    expect(res.statusCode).toBe(201);
    expect(servicio.registrar).toHaveBeenCalledWith({
      idUser: 7,
      idNumber: 10,
      metodoPago: 'hibrido',
      transferAmount: 600,
      cashAmount: 400,
      comprobante: {
        buffer: PNG,
        mimetype: 'image/png',
        nombreOriginal: 'spei.png',
      },
    });

    const body = res.json();
    expect(body).toMatchObject({
      idPayment: 45,
      idNumber: 10,
      metodoPago: 'hibrido',
      transferAmount: 600,
      cashAmount: 400,
      totalAmount: 1000,
      status: 'PENDIENTE',
      confirmedByParticipant: true,
      confirmedByAdmin: false,
      ocrVerified: false,
      ocrDetectedAmount: null,
    });
    expect(Object.keys(body)).not.toEqual(
      expect.arrayContaining(['idUser', 'email', 'passwordHash']),
    );
  });

  it.each([
    ['JPG', 'image/jpeg', JPG],
    ['PDF', 'application/pdf', PDF],
  ])('201: acepta comprobante %s', async (_nombre, contentType, content) => {
    const res = await enviar(
      multipart(camposHibrido, { filename: 'comprobante', contentType, content }),
    );

    expect(res.statusCode).toBe(201);
    expect(servicio.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ comprobante: expect.objectContaining({ mimetype: contentType }) }),
    );
  });

  it('201: acepta pago en efectivo sin archivo', async () => {
    const res = await enviar(
      multipart({ idNumber: '10', metodoPago: 'efectivo', cashAmount: '1000' }),
    );

    expect(res.statusCode).toBe(201);
    expect(servicio.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ metodoPago: 'efectivo', comprobante: null }),
    );
  });

  // ── Archivos inválidos ──────────────────────────────────────────────────

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

  it('201: acepta un comprobante de exactamente 10 MB', async () => {
    const limite = Buffer.concat([PNG, Buffer.alloc(COMPROBANTE_MAX_BYTES - PNG.length)]);

    const res = await enviar(
      multipart(camposHibrido, { filename: 'limite.png', contentType: 'image/png', content: limite }),
    );

    expect(res.statusCode).toBe(201);
  });

  it('413: rechaza comprobantes de más de 10 MB', async () => {
    const grande = Buffer.concat([PNG, Buffer.alloc(COMPROBANTE_MAX_BYTES)]);

    const res = await enviar(
      multipart(camposHibrido, { filename: 'grande.png', contentType: 'image/png', content: grande }),
    );

    expect(res.statusCode).toBe(413);
    expect(servicio.registrar).not.toHaveBeenCalled();
  });

  // ── Autenticación y validación ──────────────────────────────────────────

  it('401: sin token', async () => {
    const res = await enviar(multipart(camposHibrido), {});

    expect(res.statusCode).toBe(401);
    expect(servicio.registrar).not.toHaveBeenCalled();
  });

  it('422: DTO inválido (método desconocido e idNumber no numérico)', async () => {
    const res = await enviar(multipart({ idNumber: 'abc', metodoPago: 'cheque' }));

    expect(res.statusCode).toBe(422);
    expect(res.json().details.map((d: { field: string }) => d.field)).toEqual(
      expect.arrayContaining(['idNumber', 'metodoPago']),
    );
    expect(servicio.registrar).not.toHaveBeenCalled();
  });

  // ── Errores de dominio traducidos a HTTP ────────────────────────────────

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

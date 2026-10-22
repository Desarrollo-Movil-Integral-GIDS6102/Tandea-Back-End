import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { ZodError } from 'zod';
import { FastifyReply, FastifyRequest } from 'fastify';
import { Pago } from '../src/pagos/domain/entities/pago.entity';
import {
  MontoHibridoInvalidoError,
  ReglaNegocioPagoError,
} from '../src/pagos/domain/errors/pago.errors';
import { zPagoCreate } from '../src/pagos/application/dtos/pago.dto';
import { PagoService } from '../src/pagos/application/services/pago.service';
import { PagoRepositoryPort } from '../src/pagos/domain/ports/out/pago-repository.port';
import { PagoController } from '../src/pagos/infrastructure/adapters/in/http/controllers/pago.controller';
import { PagoDomainExceptionFilter } from '../src/pagos/infrastructure/adapters/in/http/filters/pago-domain-exception.filter';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';

/**
 * [BE-PAGO] Pruebas unitarias de pago híbrido (AP-03):
 * Validar que transferencia + efectivo = cuota en pago híbrido comparando en centavos enteros.
 */
describe('[AP-03] Validación de suma en Pago Híbrido (Efectivo + Transferencia)', () => {
  const dummyUUID1 = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const dummyUUID2 = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';

  const baseHibridoProps = {
    tandaId: dummyUUID1,
    participanteId: dummyUUID2,
    numeroPago: 1,
    monto: 1000.0,
    montoEfectivo: 400.0,
    montoTransferencia: 600.0,
    metodoPago: 'hibrido' as const,
    comprobanteUrl: 'https://storage.tandea.app/comprobantes/pago_1.jpg',
    fechaPago: new Date('2026-10-22T10:00:00.000Z'),
  };

  describe('1. Dominio Puro: Entidad Pago y Regla de Negocio AP-03', () => {
    it('Caso 1: Un pago híbrido cuya suma sea exacta se acepta', () => {
      const pago = Pago.create({ ...baseHibridoProps });

      expect(pago).toBeDefined();
      expect(pago.monto).toBe(1000);
      expect(pago.montoEfectivo).toBe(400);
      expect(pago.montoTransferencia).toBe(600);
      expect(pago.metodoPago).toBe('hibrido');
      expect(pago.estado).toBe('pendiente');
    });

    it('Caso 2: Un pago híbrido cuya suma sea menor que el importe declarado se rechaza con MontoHibridoInvalidoError', () => {
      expect(() => {
        Pago.create({
          ...baseHibridoProps,
          monto: 1000,
          montoEfectivo: 400,
          montoTransferencia: 590, // Suma 990 != 1000
        });
      }).toThrowError(MontoHibridoInvalidoError);

      try {
        Pago.create({
          ...baseHibridoProps,
          monto: 1000,
          montoEfectivo: 400,
          montoTransferencia: 590,
        });
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(MontoHibridoInvalidoError);
        const hibridoErr = err as MontoHibridoInvalidoError;
        expect(hibridoErr.montoEfectivo).toBe(400);
        expect(hibridoErr.montoTransferencia).toBe(590);
        expect(hibridoErr.sumaCalculada).toBe(990);
        expect(hibridoErr.montoEsperado).toBe(1000);
        expect(hibridoErr.message).toContain('debe ser igual a la cuota total de $1000');
      }
    });

    it('Caso 3: Un pago híbrido cuya suma sea mayor que el importe declarado se rechaza con MontoHibridoInvalidoError', () => {
      expect(() => {
        Pago.create({
          ...baseHibridoProps,
          monto: 1000,
          montoEfectivo: 500,
          montoTransferencia: 600, // Suma 1100 != 1000
        });
      }).toThrowError(MontoHibridoInvalidoError);
    });

    it('Caso 4: El caso de precisión IEEE 754 (0.1 + 0.2 frente a 0.3) se acepta operando en centavos enteros', () => {
      const pago = Pago.create({
        ...baseHibridoProps,
        monto: 0.3,
        montoEfectivo: 0.1,
        montoTransferencia: 0.2,
      });

      expect(pago).toBeDefined();
      expect(pago.monto).toBe(0.3);
      expect(pago.montoEfectivo).toBe(0.1);
      expect(pago.montoTransferencia).toBe(0.2);
    });

    it('Rechaza componentes menores o iguales a cero en método híbrido', () => {
      expect(() => {
        Pago.create({
          ...baseHibridoProps,
          monto: 500,
          montoEfectivo: 0,
          montoTransferencia: 500,
        });
      }).toThrowError(ReglaNegocioPagoError);

      expect(() => {
        Pago.create({
          ...baseHibridoProps,
          monto: 500,
          montoEfectivo: 500,
          montoTransferencia: 0,
        });
      }).toThrowError(ReglaNegocioPagoError);
    });

    it('Rechaza comprobante vacío o ausente en método híbrido', () => {
      expect(() => {
        Pago.create({
          ...baseHibridoProps,
          comprobanteUrl: null,
        });
      }).toThrowError(ReglaNegocioPagoError);

      expect(() => {
        Pago.create({
          ...baseHibridoProps,
          comprobanteUrl: '   ',
        });
      }).toThrowError(ReglaNegocioPagoError);
    });

    it('Rechaza montos con más de dos decimales en dominio', () => {
      expect(() => {
        Pago.create({
          ...baseHibridoProps,
          monto: 1000.555,
          montoEfectivo: 400.555,
          montoTransferencia: 600,
        });
      }).toThrowError(ReglaNegocioPagoError);
    });

    it('Conserva las reglas de negocio para métodos efectivo y transferencia', () => {
      // Efectivo válido
      const pagoEfectivo = Pago.create({
        ...baseHibridoProps,
        metodoPago: 'efectivo',
        monto: 500,
        montoEfectivo: 500,
        montoTransferencia: 0,
        comprobanteUrl: null,
      });
      expect(pagoEfectivo.metodoPago).toBe('efectivo');

      // Efectivo con transferencia > 0 se rechaza
      expect(() => {
        Pago.create({
          ...baseHibridoProps,
          metodoPago: 'efectivo',
          monto: 500,
          montoEfectivo: 400,
          montoTransferencia: 100,
        });
      }).toThrowError(ReglaNegocioPagoError);

      // Transferencia válida
      const pagoTransf = Pago.create({
        ...baseHibridoProps,
        metodoPago: 'transferencia',
        monto: 500,
        montoEfectivo: 0,
        montoTransferencia: 500,
        comprobanteUrl: 'https://storage.tandea.app/comprobante.jpg',
      });
      expect(pagoTransf.metodoPago).toBe('transferencia');

      // Transferencia sin comprobante se rechaza
      expect(() => {
        Pago.create({
          ...baseHibridoProps,
          metodoPago: 'transferencia',
          monto: 500,
          montoEfectivo: 0,
          montoTransferencia: 500,
          comprobanteUrl: null,
        });
      }).toThrowError(ReglaNegocioPagoError);
    });
  });

  describe('2. Validación Zod en DTO (zPagoCreate)', () => {
    const validDtoPayload = {
      tandaId: dummyUUID1,
      participanteId: dummyUUID2,
      numeroPago: 1,
      monto: 1000.0,
      montoEfectivo: 400.0,
      montoTransferencia: 600.0,
      metodoPago: 'hibrido',
      comprobanteUrl: 'https://storage.tandea.app/comprobante.jpg',
      fechaPago: '2026-10-22T10:00:00.000Z',
    };

    it('Acepta un pago híbrido cuya suma en centavos enteros coincide exactamente', () => {
      const parsed = zPagoCreate.safeParse(validDtoPayload);
      expect(parsed.success).toBe(true);
    });

    it('Acepta el caso de precisión flotante IEEE 754 (0.1 + 0.2 = 0.3)', () => {
      const parsed = zPagoCreate.safeParse({
        ...validDtoPayload,
        monto: 0.3,
        montoEfectivo: 0.1,
        montoTransferencia: 0.2,
      });
      expect(parsed.success).toBe(true);
    });

    it('Rechaza cuando la suma de efectivo + transferencia es menor que el monto', () => {
      const parsed = zPagoCreate.safeParse({
        ...validDtoPayload,
        monto: 1000,
        montoEfectivo: 400,
        montoTransferencia: 599.99, // Falta 0.01
      });

      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const issue = parsed.error.issues.find((i) => i.path.includes('monto'));
        expect(issue).toBeDefined();
        expect(issue?.message).toContain('montoEfectivo (400) + montoTransferencia (599.99)');
      }
    });

    it('Rechaza cuando la suma de efectivo + transferencia es mayor que el monto', () => {
      const parsed = zPagoCreate.safeParse({
        ...validDtoPayload,
        monto: 1000,
        montoEfectivo: 500,
        montoTransferencia: 500.01,
      });

      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const issue = parsed.error.issues.find((i) => i.path.includes('monto'));
        expect(issue).toBeDefined();
      }
    });

    it('Rechaza montos con más de dos decimales en Zod', () => {
      const parsed = zPagoCreate.safeParse({
        ...validDtoPayload,
        monto: 1000,
        montoEfectivo: 400.123,
        montoTransferencia: 599.877,
      });

      expect(parsed.success).toBe(false);
    });

    it('Rechaza importes negativos o no finitos en Zod', () => {
      expect(
        zPagoCreate.safeParse({
          ...validDtoPayload,
          montoEfectivo: -50,
          montoTransferencia: 1050,
        }).success,
      ).toBe(false);

      expect(
        zPagoCreate.safeParse({
          ...validDtoPayload,
          montoEfectivo: Number.POSITIVE_INFINITY,
        }).success,
      ).toBe(false);

      expect(
        zPagoCreate.safeParse({
          ...validDtoPayload,
          montoTransferencia: Number.NaN,
        }).success,
      ).toBe(false);
    });

    it('Rechaza método híbrido cuando alguno de los componentes es cero', () => {
      const parsed = zPagoCreate.safeParse({
        ...validDtoPayload,
        monto: 1000,
        montoEfectivo: 0,
        montoTransferencia: 1000,
      });

      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const issue = parsed.error.issues.find((i) => i.path.includes('metodoPago'));
        expect(issue?.message).toContain(
          'Método "hibrido" requiere que tanto montoEfectivo como montoTransferencia sean mayores a cero',
        );
      }
    });
  });

  describe('3. Filtro HTTP: PagoDomainExceptionFilter', () => {
    it('Traduce MontoHibridoInvalidoError a HTTP 422 Unprocessable Entity', () => {
      const exception = new MontoHibridoInvalidoError(400, 500, 900, 1000);

      const mockSend = vi.fn();
      const mockStatus = vi.fn().mockReturnValue({ send: mockSend });
      const mockHost = {
        switchToHttp: () => ({
          getResponse: () => ({ status: mockStatus }) as unknown as FastifyReply,
        }),
      } as unknown as ArgumentsHost;

      const filter = new PagoDomainExceptionFilter();
      filter.catch(exception, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 422,
          error: 'Unprocessable Entity',
          message: expect.stringContaining('debe ser igual a la cuota total de $1000'),
        }),
      );
    });

    it('GlobalExceptionFilter traduce ZodError de suma híbrida inconsistente a HTTP 422 Unprocessable Entity', () => {
      const parseResult = zPagoCreate.safeParse({
        tandaId: dummyUUID1,
        participanteId: dummyUUID2,
        numeroPago: 1,
        monto: 1000,
        montoEfectivo: 400,
        montoTransferencia: 500,
        metodoPago: 'hibrido',
        comprobanteUrl: 'https://storage.tandea.app/comprobante.jpg',
        fechaPago: '2026-10-22T10:00:00.000Z',
      });
      expect(parseResult.success).toBe(false);
      if (parseResult.success) return;

      const mockSend = vi.fn();
      const mockStatus = vi.fn().mockReturnValue({ send: mockSend });
      const mockHost = {
        switchToHttp: () => ({
          getResponse: () => ({ status: mockStatus }) as unknown as FastifyReply,
          getRequest: () => ({ url: '/api/v1/pagos' }) as unknown as FastifyRequest,
        }),
      } as unknown as ArgumentsHost;

      const filter = new GlobalExceptionFilter();
      filter.catch(parseResult.error, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 422,
          error: 'Unprocessable Entity',
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'monto',
              message: expect.stringContaining('montoEfectivo (400) + montoTransferencia (500)'),
            }),
          ]),
        }),
      );
    });
  });

  describe('4. Capa de Aplicación y Controlador: Orquestación y No Persistencia', () => {
    let mockRepo: PagoRepositoryPort;
    let service: PagoService;
    let controller: PagoController;

    const mockCreate = vi.fn();
    const mockFindById = vi.fn();
    const mockUpdate = vi.fn();

    beforeEach(() => {
      vi.clearAllMocks();
      mockRepo = {
        create: mockCreate,
        findById: mockFindById,
        update: mockUpdate,
      };
      service = new PagoService(mockRepo);
      controller = new PagoController(service);

      mockCreate.mockImplementation(async (p: Pago) => p);
    });

    it('Controlador crea y persiste el pago exitosamente cuando los montos híbridos son válidos', async () => {
      const validBody = {
        tandaId: dummyUUID1,
        participanteId: dummyUUID2,
        numeroPago: 1,
        monto: 1000,
        montoEfectivo: 450,
        montoTransferencia: 550,
        metodoPago: 'hibrido',
        comprobanteUrl: 'https://storage.tandea.app/comprobante.jpg',
        fechaPago: '2026-10-22T10:00:00.000Z',
      };

      const result = await controller.crearPago(validBody);

      expect(result).toBeDefined();
      expect(result.monto).toBe(1000);
      expect(result.montoEfectivo).toBe(450);
      expect(result.montoTransferencia).toBe(550);
      expect(mockCreate).toHaveBeenCalledOnce();
    });

    it('Controlador rechaza con ZodError ante montos híbridos inconsistentes y NO invoca persistencia', async () => {
      const invalidBody = {
        tandaId: dummyUUID1,
        participanteId: dummyUUID2,
        numeroPago: 1,
        monto: 1000,
        montoEfectivo: 400,
        montoTransferencia: 500, // Discrepancia: 900 != 1000
        metodoPago: 'hibrido',
        comprobanteUrl: 'https://storage.tandea.app/comprobante.jpg',
        fechaPago: '2026-10-22T10:00:00.000Z',
      };

      const error = await controller.crearPago(invalidBody).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ZodError);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('Servicio rechaza mediante regla de dominio ante llamada directa inconsistente y NO persiste', async () => {
      await expect(
        service.crearPago({
          tandaId: dummyUUID1,
          participanteId: dummyUUID2,
          numeroPago: 1,
          monto: 500,
          montoEfectivo: 200,
          montoTransferencia: 250, // 450 != 500
          metodoPago: 'hibrido',
          comprobanteUrl: 'https://storage.tandea.app/comprobante.jpg',
          fechaPago: new Date(),
        }),
      ).rejects.toThrowError(MontoHibridoInvalidoError);

      expect(mockCreate).not.toHaveBeenCalled();
    });
  });
});

import { describe, it, expect, vi } from 'vitest';
import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { PagoFactory } from '../src/pagos/domain/factories/pago.factory';
import {
  MontoHibridoInvalidoError,
  ReglaNegocioPagoError,
} from '../src/pagos/domain/errors/pago.errors';
import { zRegistrarPago } from '../src/pagos/application/dtos/pago.dto';
import { PagoDomainExceptionFilter } from '../src/pagos/infrastructure/adapters/in/http/filters/pago-domain-exception.filter';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';

/**
 * [BE-PAGO] Pruebas unitarias de pago híbrido (AP-03):
 * Validar que transferencia + efectivo = cuota en pago híbrido comparando en centavos enteros.
 */
describe('[AP-03] Validación de suma en Pago Híbrido (Efectivo + Transferencia)', () => {
  const comprobante = 'https://storage.tandea.app/comprobantes/pago_1.jpg';

  const baseHibrido = {
    idNumber: 10,
    metodoPago: 'hibrido' as const,
    totalAmount: 1000.0,
    cashAmount: 400.0,
    transferAmount: 600.0,
    evidenceUrl: comprobante,
  };

  describe('1. Dominio Puro: PagoFactory y Regla de Negocio AP-03', () => {
    it('Caso 1: Un pago híbrido cuya suma sea exacta se acepta', () => {
      const pago = PagoFactory.crear({ ...baseHibrido });

      expect(pago).toBeDefined();
      expect(pago.totalAmount).toBe(1000);
      expect(pago.cashAmount).toBe(400);
      expect(pago.transferAmount).toBe(600);
      expect(pago.metodoPago).toBe('hibrido');
      expect(pago.status).toBe('PENDIENTE');
    });

    it('Caso 2: Un pago híbrido cuya suma sea menor que la cuota se rechaza con MontoHibridoInvalidoError', () => {
      const crear = () =>
        PagoFactory.crear({ ...baseHibrido, cashAmount: 400, transferAmount: 590 }); // 990 != 1000

      expect(crear).toThrowError(MontoHibridoInvalidoError);

      try {
        crear();
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

    it('Caso 3: Un pago híbrido cuya suma sea mayor que la cuota se rechaza con MontoHibridoInvalidoError', () => {
      expect(() =>
        PagoFactory.crear({ ...baseHibrido, cashAmount: 500, transferAmount: 600 }), // 1100 != 1000
      ).toThrowError(MontoHibridoInvalidoError);
    });

    it('Caso 4: El caso de precisión IEEE 754 (0.1 + 0.2 frente a 0.3) se acepta operando en centavos enteros', () => {
      const pago = PagoFactory.crear({
        ...baseHibrido,
        totalAmount: 0.3,
        cashAmount: 0.1,
        transferAmount: 0.2,
      });

      expect(pago.totalAmount).toBe(0.3);
      expect(pago.cashAmount).toBe(0.1);
      expect(pago.transferAmount).toBe(0.2);
    });

    it('Rechaza componentes menores o iguales a cero en método híbrido', () => {
      expect(() =>
        PagoFactory.crear({ ...baseHibrido, totalAmount: 500, cashAmount: 0, transferAmount: 500 }),
      ).toThrowError(ReglaNegocioPagoError);

      expect(() =>
        PagoFactory.crear({ ...baseHibrido, totalAmount: 500, cashAmount: 500, transferAmount: 0 }),
      ).toThrowError(ReglaNegocioPagoError);

      expect(() =>
        PagoFactory.crear({ ...baseHibrido, cashAmount: -100, transferAmount: 1100 }),
      ).toThrowError(ReglaNegocioPagoError);
    });

    it('Rechaza comprobante vacío o ausente en método híbrido', () => {
      expect(() => PagoFactory.crear({ ...baseHibrido, evidenceUrl: null })).toThrowError(
        ReglaNegocioPagoError,
      );
      expect(() => PagoFactory.crear({ ...baseHibrido, evidenceUrl: '   ' })).toThrowError(
        ReglaNegocioPagoError,
      );
    });

    it('Rechaza montos con más de dos decimales o no finitos en dominio', () => {
      expect(() =>
        PagoFactory.crear({ ...baseHibrido, totalAmount: 1000.555, cashAmount: 400.555 }),
      ).toThrowError(ReglaNegocioPagoError);

      expect(() =>
        PagoFactory.crear({ ...baseHibrido, cashAmount: Number.POSITIVE_INFINITY }),
      ).toThrowError(ReglaNegocioPagoError);
    });

    it('Conserva las reglas de negocio para métodos efectivo y transferencia', () => {
      const pagoEfectivo = PagoFactory.crear({
        idNumber: 10,
        metodoPago: 'efectivo',
        totalAmount: 500,
        cashAmount: 500,
      });
      expect(pagoEfectivo.metodoPago).toBe('efectivo');

      expect(() =>
        PagoFactory.crear({
          idNumber: 10,
          metodoPago: 'efectivo',
          totalAmount: 500,
          cashAmount: 400,
          transferAmount: 100,
        }),
      ).toThrowError(ReglaNegocioPagoError);

      const pagoTransf = PagoFactory.crear({
        idNumber: 10,
        metodoPago: 'transferencia',
        totalAmount: 500,
        transferAmount: 500,
        evidenceUrl: comprobante,
      });
      expect(pagoTransf.metodoPago).toBe('transferencia');

      expect(() =>
        PagoFactory.crear({
          idNumber: 10,
          metodoPago: 'transferencia',
          totalAmount: 500,
          transferAmount: 500,
          evidenceUrl: null,
        }),
      ).toThrowError(ReglaNegocioPagoError);
    });
  });

  describe('2. Validación Zod en DTO (zRegistrarPago)', () => {
    const validDtoPayload = {
      idNumber: 10,
      metodoPago: 'hibrido',
      cashAmount: 400.0,
      transferAmount: 600.0,
    };

    it('Acepta un pago híbrido con ambos componentes positivos', () => {
      expect(zRegistrarPago.safeParse(validDtoPayload).success).toBe(true);
    });

    it('Acepta montos enviados como texto (campos multipart)', () => {
      const parsed = zRegistrarPago.safeParse({
        idNumber: '10',
        metodoPago: 'hibrido',
        cashAmount: '0.1',
        transferAmount: '0.2',
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.idNumber).toBe(10);
        expect(parsed.data.cashAmount).toBe(0.1);
        expect(parsed.data.transferAmount).toBe(0.2);
      }
    });

    it('Rechaza montos con más de dos decimales en Zod', () => {
      expect(
        zRegistrarPago.safeParse({ ...validDtoPayload, cashAmount: 400.123 }).success,
      ).toBe(false);
    });

    it('Rechaza importes negativos o no finitos en Zod', () => {
      expect(zRegistrarPago.safeParse({ ...validDtoPayload, cashAmount: -50 }).success).toBe(false);
      expect(
        zRegistrarPago.safeParse({ ...validDtoPayload, cashAmount: Number.POSITIVE_INFINITY }).success,
      ).toBe(false);
      expect(
        zRegistrarPago.safeParse({ ...validDtoPayload, transferAmount: 'abc' }).success,
      ).toBe(false);
    });

    it('Rechaza método híbrido cuando alguno de los componentes es cero', () => {
      const parsed = zRegistrarPago.safeParse({ ...validDtoPayload, cashAmount: 0 });

      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const issue = parsed.error.issues.find((i) => i.path.includes('metodoPago'));
        expect(issue?.message).toContain(
          'Método "hibrido" requiere que tanto cashAmount como transferAmount sean mayores a cero',
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

    it('GlobalExceptionFilter traduce ZodError de pago híbrido inconsistente a HTTP 422 Unprocessable Entity', () => {
      const parseResult = zRegistrarPago.safeParse({
        idNumber: 10,
        metodoPago: 'hibrido',
        cashAmount: 0,
        transferAmount: 1000,
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
              field: 'metodoPago',
              message: expect.stringContaining('Método "hibrido" requiere'),
            }),
          ]),
        }),
      );
    });
  });
});

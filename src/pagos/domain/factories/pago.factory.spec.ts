import { describe, it, expect } from 'vitest';
import { PagoFactory } from './pago.factory';
import { Pago } from '../entities/Pago';
import { ReglaNegocioPagoError } from '../errors/pago.errors';

describe('Fábrica de Dominio: PagoFactory', () => {
  describe('Creación de Pago en Efectivo (efectivo)', () => {
    it('debe crear un pago en efectivo válido con montos correctos', () => {
      const pago = PagoFactory.crear({
        idNumber: 7,
        metodoPago: 'efectivo',
        totalAmount: 1000,
      });

      expect(pago).toBeInstanceOf(Pago);
      expect(pago.idNumber).toBe(7);
      expect(pago.metodoPago).toBe('efectivo');
      expect(pago.cashAmount).toBe(1000);
      expect(pago.transferAmount).toBe(0);
      expect(pago.totalAmount).toBe(1000);
      expect(pago.evidenceUrl).toBeNull();
      expect(pago.status).toBe('PENDIENTE');
      expect(pago.estaConfirmado()).toBe(false);
    });

    it('debe permitir comprobante opcional en efectivo', () => {
      const pago = PagoFactory.crear({
        idNumber: 7,
        metodoPago: 'efectivo',
        cashAmount: 800,
        evidenceUrl: 'https://storage.googleapis.com/recibo.jpg',
      });

      expect(pago.cashAmount).toBe(800);
      expect(pago.totalAmount).toBe(800);
      expect(pago.evidenceUrl).toBe('https://storage.googleapis.com/recibo.jpg');
    });

    it('debe lanzar error si se proporciona monto de transferencia en efectivo', () => {
      expect(() =>
        PagoFactory.crear({
          idNumber: 7,
          metodoPago: 'efectivo',
          totalAmount: 1000,
          transferAmount: 200,
        }),
      ).toThrow(ReglaNegocioPagoError);
    });

    it('debe lanzar error si el monto en efectivo no coincide con la cuota total', () => {
      expect(() =>
        PagoFactory.crear({
          idNumber: 7,
          metodoPago: 'efectivo',
          totalAmount: 1000,
          cashAmount: 800,
        }),
      ).toThrow(ReglaNegocioPagoError);
    });

    it('debe lanzar error si el monto en efectivo es menor o igual a cero', () => {
      expect(() =>
        PagoFactory.crear({
          idNumber: 7,
          metodoPago: 'efectivo',
          totalAmount: 0,
        }),
      ).toThrow(ReglaNegocioPagoError);
    });
  });

  describe('Creación de Pago por Transferencia (transferencia)', () => {
    it('debe crear un pago por transferencia válido con comprobante obligatorio', () => {
      const pago = PagoFactory.crear({
        idNumber: 12,
        metodoPago: 'transferencia',
        totalAmount: 1500,
        evidenceUrl: 'https://storage.googleapis.com/tandea/spei-12.pdf',
      });

      expect(pago).toBeInstanceOf(Pago);
      expect(pago.idNumber).toBe(12);
      expect(pago.metodoPago).toBe('transferencia');
      expect(pago.transferAmount).toBe(1500);
      expect(pago.cashAmount).toBe(0);
      expect(pago.totalAmount).toBe(1500);
      expect(pago.evidenceUrl).toBe('https://storage.googleapis.com/tandea/spei-12.pdf');
      expect(pago.estaConfirmado()).toBe(false);
    });

    it('debe lanzar error si falta el comprobante en transferencia', () => {
      expect(() =>
        PagoFactory.crear({
          idNumber: 12,
          metodoPago: 'transferencia',
          totalAmount: 1500,
        }),
      ).toThrow(ReglaNegocioPagoError);

      expect(() =>
        PagoFactory.crear({
          idNumber: 12,
          metodoPago: 'transferencia',
          totalAmount: 1500,
          evidenceUrl: '   ',
        }),
      ).toThrow(ReglaNegocioPagoError);
    });

    it('debe lanzar error si se proporciona monto en efectivo en transferencia', () => {
      expect(() =>
        PagoFactory.crear({
          idNumber: 12,
          metodoPago: 'transferencia',
          totalAmount: 1500,
          cashAmount: 100,
          evidenceUrl: 'https://storage.googleapis.com/spei.jpg',
        }),
      ).toThrow(ReglaNegocioPagoError);
    });

    it('debe lanzar error si el monto de transferencia no coincide con el total', () => {
      expect(() =>
        PagoFactory.crear({
          idNumber: 12,
          metodoPago: 'transferencia',
          totalAmount: 1500,
          transferAmount: 1400,
          evidenceUrl: 'https://storage.googleapis.com/spei.jpg',
        }),
      ).toThrow(ReglaNegocioPagoError);
    });
  });

  describe('Creación de Pago Híbrido (hibrido)', () => {
    it('debe crear un pago híbrido válido cumpliendo la invariante suma(efectivo + transferencia) == cuota', () => {
      const pago = PagoFactory.crear({
        idNumber: 20,
        metodoPago: 'hibrido',
        totalAmount: 1000,
        transferAmount: 600,
        cashAmount: 400,
        evidenceUrl: 'https://storage.googleapis.com/comprobante-parcial.jpg',
      });

      expect(pago).toBeInstanceOf(Pago);
      expect(pago.idNumber).toBe(20);
      expect(pago.metodoPago).toBe('hibrido');
      expect(pago.transferAmount).toBe(600);
      expect(pago.cashAmount).toBe(400);
      expect(pago.totalAmount).toBe(1000);
      expect(pago.evidenceUrl).toBe(
        'https://storage.googleapis.com/comprobante-parcial.jpg',
      );
      expect(pago.estaConfirmado()).toBe(false);
    });

    it('debe lanzar error si falta el comprobante obligatorio para el pago híbrido', () => {
      expect(() =>
        PagoFactory.crear({
          idNumber: 20,
          metodoPago: 'hibrido',
          totalAmount: 1000,
          transferAmount: 600,
          cashAmount: 400,
        }),
      ).toThrow(ReglaNegocioPagoError);
    });

    it('debe lanzar error si la transferencia es cero o negativa en pago híbrido', () => {
      expect(() =>
        PagoFactory.crear({
          idNumber: 20,
          metodoPago: 'hibrido',
          totalAmount: 1000,
          transferAmount: 0,
          cashAmount: 1000,
          evidenceUrl: 'https://comprobante.jpg',
        }),
      ).toThrow(ReglaNegocioPagoError);
    });

    it('debe lanzar error si el efectivo es cero o negativo en pago híbrido', () => {
      expect(() =>
        PagoFactory.crear({
          idNumber: 20,
          metodoPago: 'hibrido',
          totalAmount: 1000,
          transferAmount: 1000,
          cashAmount: 0,
          evidenceUrl: 'https://comprobante.jpg',
        }),
      ).toThrow(ReglaNegocioPagoError);
    });

    it('debe lanzar error si la suma de efectivo y transferencia no coincide con el total', () => {
      expect(() =>
        PagoFactory.crear({
          idNumber: 20,
          metodoPago: 'hibrido',
          totalAmount: 1000,
          transferAmount: 600,
          cashAmount: 300, // Suma 900 != 1000
          evidenceUrl: 'https://comprobante.jpg',
        }),
      ).toThrow(ReglaNegocioPagoError);
    });
  });

  describe('Validaciones Generales y Compatibilidad', () => {
    it('debe rechazar idNumber inválido (menor o igual a cero, o no entero)', () => {
      expect(() =>
        PagoFactory.crear({
          idNumber: 0,
          metodoPago: 'efectivo',
          totalAmount: 500,
        }),
      ).toThrow(ReglaNegocioPagoError);

      expect(() =>
        PagoFactory.crear({
          idNumber: -5,
          metodoPago: 'efectivo',
          totalAmount: 500,
        }),
      ).toThrow(ReglaNegocioPagoError);

      expect(() =>
        PagoFactory.crear({
          idNumber: 2.5,
          metodoPago: 'efectivo',
          totalAmount: 500,
        }),
      ).toThrow(ReglaNegocioPagoError);
    });

    it('debe rechazar métodos de pago no reconocidos', () => {
      expect(() =>
        PagoFactory.crear({
          idNumber: 1,
          metodoPago: 'tarjeta_credito',
          totalAmount: 500,
        }),
      ).toThrow(ReglaNegocioPagoError);
    });

    it('debe permitir inicializar con confirmedByParticipant y confirmedByAdmin preestablecidos', () => {
      const pago = PagoFactory.crear({
        idNumber: 1,
        metodoPago: 'efectivo',
        totalAmount: 500,
        confirmedByParticipant: true,
        confirmedByAdmin: true,
      });

      expect(pago.confirmedByParticipant).toBe(true);
      expect(pago.confirmedByAdmin).toBe(true);
      expect(pago.status).toBe('CONFIRMADO');
      expect(pago.estaConfirmado()).toBe(true);
    });
  });
});

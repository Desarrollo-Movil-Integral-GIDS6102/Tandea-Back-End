import { describe, it, expect } from 'vitest';
import { Pago, MetodoPago } from './Pago';
import {
  ConfirmacionAdminPreviaError,
  ConfirmacionParticipantePreviaError,
  PagoRechazadoError,
  PagoYaConfirmadoError,
} from '../errors/pago.errors';

describe('Entidad de Dominio: Pago', () => {
  it('debe instanciarse correctamente sin depender de NestJS ni de ningún framework', () => {
    const pago = Pago.create({
      idNumber: 1,
      metodoPago: 'efectivo',
      cashAmount: 500,
      transferAmount: 0,
      totalAmount: 500,
    });

    expect(pago).toBeInstanceOf(Pago);
    expect(pago.idNumber).toBe(1);
    expect(pago.metodoPago).toBe('efectivo');
    expect(pago.cashAmount).toBe(500);
    expect(pago.transferAmount).toBe(0);
    expect(pago.totalAmount).toBe(500);
    expect(pago.status).toBe('PENDIENTE');
    expect(pago.confirmedByParticipant).toBe(false);
    expect(pago.confirmedByAdmin).toBe(false);
  });

  describe('Flujo de Confirmaciones y estaConfirmado()', () => {
    it('estaConfirmado() debe retornar false cuando el pago recién se crea', () => {
      const pago = Pago.create({
        idNumber: 10,
        metodoPago: 'efectivo',
        totalAmount: 1000,
      });

      expect(pago.estaConfirmado()).toBe(false);
    });

    it('estaConfirmado() debe retornar false si SOLO el participante ha confirmado', () => {
      const pago = Pago.create({
        idNumber: 10,
        metodoPago: 'efectivo',
        totalAmount: 1000,
      });

      pago.confirmarPorParticipante();

      expect(pago.confirmedByParticipant).toBe(true);
      expect(pago.confirmedByAdmin).toBe(false);
      expect(pago.status).toBe('PENDIENTE');
      expect(pago.estaConfirmado()).toBe(false);
    });

    it('estaConfirmado() debe retornar false si SOLO el administrador ha confirmado', () => {
      const pago = Pago.create({
        idNumber: 10,
        metodoPago: 'efectivo',
        totalAmount: 1000,
      });

      pago.confirmarPorAdmin();

      expect(pago.confirmedByParticipant).toBe(false);
      expect(pago.confirmedByAdmin).toBe(true);
      expect(pago.status).toBe('PENDIENTE');
      expect(pago.estaConfirmado()).toBe(false);
    });

    it('estaConfirmado() debe retornar true y estado CONFIRMADO cuando AMBOS confirman (participante primero, admin después)', () => {
      const pago = Pago.create({
        idNumber: 10,
        metodoPago: 'efectivo',
        totalAmount: 1000,
      });

      pago.confirmarPorParticipante();
      expect(pago.estaConfirmado()).toBe(false);

      pago.confirmarPorAdmin();
      expect(pago.confirmedByParticipant).toBe(true);
      expect(pago.confirmedByAdmin).toBe(true);
      expect(pago.status).toBe('CONFIRMADO');
      expect(pago.estaConfirmado()).toBe(true);
    });

    it('estaConfirmado() debe retornar true y estado CONFIRMADO cuando AMBOS confirman (admin primero, participante después)', () => {
      const pago = Pago.create({
        idNumber: 10,
        metodoPago: 'transferencia',
        totalAmount: 1000,
        transferAmount: 1000,
        evidenceUrl: 'https://storage.googleapis.com/tandea/comprobante.jpg',
      });

      pago.confirmarPorAdmin();
      expect(pago.estaConfirmado()).toBe(false);

      pago.confirmarPorParticipante();
      expect(pago.confirmedByParticipant).toBe(true);
      expect(pago.confirmedByAdmin).toBe(true);
      expect(pago.status).toBe('CONFIRMADO');
      expect(pago.estaConfirmado()).toBe(true);
    });

    it('debe lanzar ConfirmacionParticipantePreviaError si el participante intenta confirmar dos veces', () => {
      const pago = Pago.create({
        idNumber: 10,
        metodoPago: 'efectivo',
        totalAmount: 1000,
      });

      pago.confirmarPorParticipante();

      expect(() => pago.confirmarPorParticipante()).toThrow(
        ConfirmacionParticipantePreviaError,
      );
    });

    it('debe lanzar ConfirmacionAdminPreviaError si el administrador intenta confirmar dos veces antes del participante', () => {
      const pago = Pago.create({
        idNumber: 10,
        metodoPago: 'efectivo',
        totalAmount: 1000,
      });

      pago.confirmarPorAdmin();

      expect(() => pago.confirmarPorAdmin()).toThrow(
        ConfirmacionAdminPreviaError,
      );
    });

    it('debe lanzar PagoYaConfirmadoError si se intenta confirmar una vez que el pago ya está completamente confirmado', () => {
      const pago = Pago.create({
        idNumber: 10,
        metodoPago: 'efectivo',
        totalAmount: 1000,
      });

      pago.confirmarPorParticipante();
      pago.confirmarPorAdmin();
      expect(pago.estaConfirmado()).toBe(true);

      expect(() => pago.confirmarPorParticipante()).toThrow(PagoYaConfirmadoError);
      expect(() => pago.confirmarPorAdmin()).toThrow(PagoYaConfirmadoError);
    });

    it('debe lanzar PagoRechazadoError si se intenta confirmar un pago rechazado', () => {
      const pago = Pago.create({
        idNumber: 10,
        metodoPago: 'efectivo',
        totalAmount: 1000,
      });

      pago.rechazar();
      expect(pago.status).toBe('RECHAZADO');

      expect(() => pago.confirmarPorParticipante()).toThrow(PagoRechazadoError);
      expect(() => pago.confirmarPorAdmin()).toThrow(PagoRechazadoError);
    });

    it('no debe permitir rechazar un pago que ya está confirmado', () => {
      const pago = Pago.create({
        idNumber: 10,
        metodoPago: 'efectivo',
        totalAmount: 1000,
      });

      pago.confirmarPorParticipante();
      pago.confirmarPorAdmin();

      expect(() => pago.rechazar()).toThrow(PagoYaConfirmadoError);
    });
  });

  describe('Validación OCR e Invariantes Financieras', () => {
    it('debe validar OCR con margen de tolerancia de +-1 peso', () => {
      const pago = Pago.create({
        idNumber: 5,
        metodoPago: 'transferencia',
        transferAmount: 500,
        totalAmount: 500,
        evidenceUrl: 'https://comprobante.jpg',
      });

      // Tolerancia exacta: 500
      pago.registrarResultadoOcr(500);
      expect(pago.ocrAprobado).toBe(true);
      expect(pago.montoOcrValidado).toBe(500);

      // Tolerancia +1 peso
      pago.registrarResultadoOcr(501);
      expect(pago.ocrAprobado).toBe(true);

      // Tolerancia -1 peso
      pago.registrarResultadoOcr(499);
      expect(pago.ocrAprobado).toBe(true);

      // Fuera de tolerancia (+2 pesos)
      pago.registrarResultadoOcr(502);
      expect(pago.ocrAprobado).toBe(false);
    });

    it('toPrimitives() debe devolver una copia inmutable congelada', () => {
      const pago = Pago.create({
        idNumber: 3,
        metodoPago: 'efectivo',
        totalAmount: 750,
      });

      const primitives = pago.toPrimitives();
      expect(Object.isFrozen(primitives)).toBe(true);
      expect(primitives.totalAmount).toBe(750);
      expect(primitives.idNumber).toBe(3);
    });
  });
});

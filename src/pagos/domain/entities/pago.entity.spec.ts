import { describe, it, expect } from 'vitest';
import { Pago } from './Pago';
import {
  ConfirmacionAdminPreviaError,
  ConfirmacionOrganizadorPreviaError,
  ConfirmacionParticipantePreviaError,
  MotivoRechazoRequeridoError,
  PagoRechazadoError,
  PagoYaConfirmadoError,
  PagoYaRechazadoError,
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
    expect(pago.estado).toBe('pendiente');
  });

  describe('Flujo de Confirmaciones y estaConfirmado()', () => {
    it('estaConfirmado() debe retornar false cuando el pago recién se crea', () => {
      const pago = Pago.create({
        idNumber: 10,
        metodoPago: 'efectivo',
        totalAmount: 1000,
      });

      expect(pago.estaConfirmado()).toBe(false);
      expect(pago.estado).toBe('pendiente');
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
      expect(pago.estado).toBe('pendiente');
    });

    it('estaConfirmado() debe retornar false y estado "confirmado_parcial" si SOLO el administrador confirma', () => {
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
      expect(pago.estado).toBe('confirmado_parcial');
    });

    it('confirmarPorOrganizador() debe actualizar confirmedByAdmin y pasar a "confirmado_parcial"', () => {
      const pago = Pago.create({
        idNumber: 10,
        metodoPago: 'efectivo',
        totalAmount: 1000,
      });

      pago.confirmarPorOrganizador();

      expect(pago.confirmedByAdmin).toBe(true);
      expect(pago.status).toBe('PENDIENTE');
      expect(pago.estado).toBe('confirmado_parcial');
      expect(pago.confirmadoOrganizadorEn).toBeInstanceOf(Date);
    });

    it('confirmarPorOrganizador() debe lanzar ConfirmacionOrganizadorPreviaError si ya fue confirmado por organizador', () => {
      const pago = Pago.create({
        idNumber: 10,
        metodoPago: 'efectivo',
        totalAmount: 1000,
      });

      pago.confirmarPorOrganizador();

      expect(() => pago.confirmarPorOrganizador()).toThrow(
        ConfirmacionOrganizadorPreviaError,
      );
    });

    it('estaConfirmado() debe retornar true y estado "confirmado" cuando AMBOS confirman (participante primero, admin después)', () => {
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
      expect(pago.estado).toBe('confirmado');
    });

    it('estaConfirmado() debe retornar true y estado "confirmado" cuando AMBOS confirman (admin primero, participante después)', () => {
      const pago = Pago.create({
        idNumber: 10,
        metodoPago: 'transferencia',
        totalAmount: 1000,
        transferAmount: 1000,
        evidenceUrl: 'https://storage.googleapis.com/tandea/comprobante.jpg',
      });

      pago.confirmarPorAdmin();
      expect(pago.estaConfirmado()).toBe(false);
      expect(pago.estado).toBe('confirmado_parcial');

      pago.confirmarPorParticipante();
      expect(pago.confirmedByParticipant).toBe(true);
      expect(pago.confirmedByAdmin).toBe(true);
      expect(pago.status).toBe('CONFIRMADO');
      expect(pago.estaConfirmado()).toBe(true);
      expect(pago.estado).toBe('confirmado');
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
      expect(() => pago.confirmarPorOrganizador()).toThrow(PagoYaConfirmadoError);
    });

    it('debe rechazar con motivo, guardar el motivo y pasar estado a "rechazado"', () => {
      const pago = Pago.create({
        idNumber: 10,
        metodoPago: 'transferencia',
        totalAmount: 1000,
      });

      pago.rechazar('Comprobante ilegible y monto discrepante');

      expect(pago.status).toBe('RECHAZADO');
      expect(pago.estado).toBe('rechazado');
      expect(pago.rejectionReason).toBe('Comprobante ilegible y monto discrepante');
    });

    it('debe lanzar MotivoRechazoRequeridoError si se intenta rechazar sin motivo o motivo vacío', () => {
      const pago = Pago.create({
        idNumber: 10,
        metodoPago: 'transferencia',
        totalAmount: 1000,
      });

      expect(() => pago.rechazar('')).toThrow(MotivoRechazoRequeridoError);
      expect(() => pago.rechazar('   ')).toThrow(MotivoRechazoRequeridoError);
    });

    it('debe lanzar PagoYaRechazadoError si se intenta rechazar un pago que ya fue rechazado', () => {
      const pago = Pago.create({
        idNumber: 10,
        metodoPago: 'efectivo',
        totalAmount: 1000,
      });

      pago.rechazar('Primer motivo');

      expect(() => pago.rechazar('Segundo motivo')).toThrow(PagoYaRechazadoError);
    });

    it('debe lanzar PagoRechazadoError si se intenta confirmar un pago rechazado', () => {
      const pago = Pago.create({
        idNumber: 10,
        metodoPago: 'efectivo',
        totalAmount: 1000,
      });

      pago.rechazar('Comprobante inválido');
      expect(pago.status).toBe('RECHAZADO');

      expect(() => pago.confirmarPorParticipante()).toThrow(PagoRechazadoError);
      expect(() => pago.confirmarPorAdmin()).toThrow(PagoRechazadoError);
      expect(() => pago.confirmarPorOrganizador()).toThrow(PagoRechazadoError);
    });

    it('no debe permitir rechazar un pago que ya está confirmado', () => {
      const pago = Pago.create({
        idNumber: 10,
        metodoPago: 'efectivo',
        totalAmount: 1000,
      });

      pago.confirmarPorParticipante();
      pago.confirmarPorAdmin();

      expect(() => pago.rechazar('Demasiado tarde')).toThrow(PagoYaConfirmadoError);
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

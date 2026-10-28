import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PagoService } from './pago.service';
import { Pago } from '../../domain/entities/Pago';
import {
  ComprobanteRequeridoError,
  ConfirmacionOrganizadorPreviaError,
  MontoHibridoInvalidoError,
  NumeroAjenoError,
  NumeroNoEncontradoError,
  PagoDuplicadoError,
  PagoNotFoundError,
  PagoRechazadoError,
  PagoYaConfirmadoError,
  ReglaNegocioPagoError,
  TandaNoEncontradaError,
  UsuarioNoAutorizadoError,
} from '../../domain/errors/pago.errors';
import type {
  NumeroConCuota,
  PagoRepositoryPort,
} from '../../domain/ports/out/pago-repository.port';
import type { StoragePort } from '../../domain/ports/out/storage.port';
import type { OcrServicePort } from '../../domain/ports/out/ocr-service.port';
import type { PagoEventsPort } from '../../domain/ports/out/pago-events.port';
import type {
  ComprobanteArchivo,
  RegistrarPagoCommand,
  UsuarioAutenticado,
} from '../../domain/ports/in/pago-use-cases.port';

const URL_COMPROBANTE = 'https://res.cloudinary.com/tandea/image/upload/comprobantes/pago.png';
const ID_USER = 7;
const ID_NUMBER = 10;
const ID_TANDA = 3;
const ID_ORGANIZADOR = 99;

const comprobante: ComprobanteArchivo = {
  buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  mimetype: 'image/png',
  nombreOriginal: 'spei.png',
};

function numero(overrides: Partial<NumeroConCuota> = {}): NumeroConCuota {
  return {
    idNumber: ID_NUMBER,
    idUser: ID_USER,
    roundNumber: 1,
    tanda: { idTanda: ID_TANDA, contributionAmount: 1000, idAdmin: ID_ORGANIZADOR, status: 'ACTIVA' },
    ...overrides,
  };
}

describe('PagoService', () => {
  let repo: { [K in keyof PagoRepositoryPort]: ReturnType<typeof vi.fn> };
  let storage: { subir: ReturnType<typeof vi.fn> };
  let ocr: { verificarMonto: ReturnType<typeof vi.fn> };
  let eventos: {
    publicarPagoRegistrado: ReturnType<typeof vi.fn>;
    publicarPagoConfirmado: ReturnType<typeof vi.fn>;
    publicarPagoRechazado: ReturnType<typeof vi.fn>;
  };
  let service: PagoService;

  beforeEach(() => {
    repo = {
      create: vi.fn(async (pago: Pago) =>
        Pago.reconstitute({ ...pago.toPrimitives(), idPayment: 45 }),
      ),
      findById: vi.fn(),
      update: vi.fn(async (pago: Pago) => pago),
      buscarNumeroConCuota: vi.fn().mockResolvedValue(numero()),
      existePagoActivo: vi.fn().mockResolvedValue(false),
    };
    storage = { subir: vi.fn().mockResolvedValue(URL_COMPROBANTE) };
    ocr = { verificarMonto: vi.fn().mockResolvedValue({ montoDetectado: null, coincide: false }) };
    eventos = {
      publicarPagoRegistrado: vi.fn().mockResolvedValue(undefined),
      publicarPagoConfirmado: vi.fn().mockResolvedValue(undefined),
      publicarPagoRechazado: vi.fn().mockResolvedValue(undefined),
    };

    service = new PagoService(
      repo as unknown as PagoRepositoryPort,
      storage as unknown as StoragePort,
      ocr as unknown as OcrServicePort,
      eventos as unknown as PagoEventsPort,
    );
  });

  describe('PagoService.registrar (AP-03)', () => {
    const registrar = (overrides: Partial<RegistrarPagoCommand> = {}) =>
      service.registrar({
        idUser: ID_USER,
        idNumber: ID_NUMBER,
        metodoPago: 'transferencia',
        transferAmount: 1000,
        comprobante,
        ...overrides,
      });

    const pagoGuardado = (): Pago => repo.create.mock.calls[0][0] as Pago;

    // ── Registro exitoso por método ─────────────────────────────────────────

    describe('registro exitoso', () => {
      it('transferencia: sube el comprobante, guarda pendiente y emite pago.registrado', async () => {
        ocr.verificarMonto.mockResolvedValue({ montoDetectado: 1000, coincide: true });

        const pago = await registrar();

        expect(storage.subir).toHaveBeenCalledWith(
          comprobante.buffer,
          expect.objectContaining({ carpeta: 'comprobantes', mimetype: 'image/png' }),
        );
        expect(ocr.verificarMonto).toHaveBeenCalledWith(comprobante.buffer, 1000);
        expect(repo.create).toHaveBeenCalledOnce();

        const guardado = pagoGuardado();
        expect(guardado.status).toBe('PENDIENTE');
        expect(guardado.confirmedByParticipant).toBe(true);
        expect(guardado.confirmedByAdmin).toBe(false);
        expect(guardado.transferAmount).toBe(1000);
        expect(guardado.cashAmount).toBe(0);
        expect(guardado.evidenceUrl).toBe(URL_COMPROBANTE);
        expect(guardado.ocrVerified).toBe(true);
        expect(guardado.ocrDetectedAmount).toBe(1000);

        expect(eventos.publicarPagoRegistrado).toHaveBeenCalledWith({
          paymentId: 45,
          tandaId: ID_TANDA,
          userId: ID_USER,
        });
        expect(pago.idPayment).toBe(45);
      });

      it('transferencia sin monto explícito: toma la cuota de la tanda', async () => {
        await registrar({ transferAmount: undefined });

        expect(pagoGuardado().transferAmount).toBe(1000);
        expect(pagoGuardado().totalAmount).toBe(1000);
      });

      it('efectivo sin comprobante: no sube archivo ni corre OCR', async () => {
        await registrar({
          metodoPago: 'efectivo',
          transferAmount: undefined,
          cashAmount: 1000,
          comprobante: null,
        });

        expect(storage.subir).not.toHaveBeenCalled();
        expect(ocr.verificarMonto).not.toHaveBeenCalled();
        const guardado = pagoGuardado();
        expect(guardado.cashAmount).toBe(1000);
        expect(guardado.evidenceUrl).toBeNull();
        expect(guardado.ocrVerified).toBe(false);
        expect(guardado.status).toBe('PENDIENTE');
        expect(eventos.publicarPagoRegistrado).toHaveBeenCalledOnce();
      });

      it('efectivo con comprobante opcional: lo guarda como evidencia sin correr OCR', async () => {
        await registrar({ metodoPago: 'efectivo', transferAmount: undefined, cashAmount: 1000 });

        expect(storage.subir).toHaveBeenCalledOnce();
        expect(ocr.verificarMonto).not.toHaveBeenCalled();
        expect(pagoGuardado().evidenceUrl).toBe(URL_COMPROBANTE);
      });

      it('híbrido: transferencia + efectivo = cuota; OCR verifica solo la parte transferida', async () => {
        await registrar({ metodoPago: 'hibrido', transferAmount: 600, cashAmount: 400 });

        expect(ocr.verificarMonto).toHaveBeenCalledWith(comprobante.buffer, 600);
        const guardado = pagoGuardado();
        expect(guardado.transferAmount).toBe(600);
        expect(guardado.cashAmount).toBe(400);
        expect(guardado.totalAmount).toBe(1000);
        expect(guardado.metodoPago).toBe('hibrido');
      });
    });

    // ── Validación del pago híbrido ─────────────────────────────────────────

    describe('validación de pago híbrido contra la cuota', () => {
      it.each([
        ['suma mayor', 700, 400],
        ['suma menor', 500, 400],
        ['diferencia de un centavo', 599.99, 400],
      ])('rechaza %s con MontoHibridoInvalidoError', async (_caso, transferAmount, cashAmount) => {
        await expect(
          registrar({ metodoPago: 'hibrido', transferAmount, cashAmount }),
        ).rejects.toThrowError(MontoHibridoInvalidoError);
      });

      it.each([
        ['negativo en efectivo', 1100, -100],
        ['negativo en transferencia', -100, 1100],
        ['cero en efectivo', 1000, 0],
        ['cero en transferencia', 0, 1000],
        ['más de dos decimales', 599.995, 400.005],
      ])('rechaza monto %s con ReglaNegocioPagoError', async (_caso, transferAmount, cashAmount) => {
        await expect(
          registrar({ metodoPago: 'hibrido', transferAmount, cashAmount }),
        ).rejects.toThrowError(ReglaNegocioPagoError);
      });

      it('acepta 0.1 + 0.2 = 0.3 comparando en centavos', async () => {
        repo.buscarNumeroConCuota.mockResolvedValue(
          numero({ tanda: { idTanda: ID_TANDA, contributionAmount: 0.3, idAdmin: ID_ORGANIZADOR, status: 'ACTIVA' } }),
        );

        await registrar({ metodoPago: 'hibrido', transferAmount: 0.1, cashAmount: 0.2 });

        expect(pagoGuardado().totalAmount).toBe(0.3);
      });

      it('no sube el comprobante ni persiste si los montos son inválidos', async () => {
        await expect(
          registrar({ metodoPago: 'hibrido', transferAmount: 700, cashAmount: 400 }),
        ).rejects.toThrow();

        expect(storage.subir).not.toHaveBeenCalled();
        expect(repo.create).not.toHaveBeenCalled();
        expect(eventos.publicarPagoRegistrado).not.toHaveBeenCalled();
      });

      it('rechaza transferencia o efectivo con monto distinto a la cuota', async () => {
        await expect(registrar({ transferAmount: 999.99 })).rejects.toThrowError(
          ReglaNegocioPagoError,
        );
        await expect(
          registrar({ metodoPago: 'efectivo', transferAmount: undefined, cashAmount: 1500 }),
        ).rejects.toThrowError(ReglaNegocioPagoError);
      });

      it('exige comprobante en transferencia e híbrido', async () => {
        await expect(registrar({ comprobante: null })).rejects.toThrowError(
          ComprobanteRequeridoError,
        );
        await expect(
          registrar({ metodoPago: 'hibrido', transferAmount: 600, cashAmount: 400, comprobante: null }),
        ).rejects.toThrowError(ComprobanteRequeridoError);
        expect(storage.subir).not.toHaveBeenCalled();
      });
    });

    // ── OCR ─────────────────────────────────────────────────────────────────

    describe('OCR', () => {
      it('si el OCR lanza error, guarda el pago pendiente con ocr_verified = false y monto nulo', async () => {
        ocr.verificarMonto.mockRejectedValue(new Error('Vision API caída'));

        await registrar();

        const guardado = pagoGuardado();
        expect(guardado.status).toBe('PENDIENTE');
        expect(guardado.ocrVerified).toBe(false);
        expect(guardado.ocrDetectedAmount).toBeNull();
        expect(eventos.publicarPagoRegistrado).toHaveBeenCalledOnce();
      });

      it('si el OCR detecta un monto distinto, guarda el monto y ocr_verified = false', async () => {
        ocr.verificarMonto.mockResolvedValue({ montoDetectado: 800, coincide: false });

        await registrar();

        expect(pagoGuardado().ocrVerified).toBe(false);
        expect(pagoGuardado().ocrDetectedAmount).toBe(800);
      });
    });

    // ── Errores de autorización y existencia ────────────────────────────────

    describe('errores', () => {
      it('lanza NumeroAjenoError (403) si el número no es del usuario', async () => {
        repo.buscarNumeroConCuota.mockResolvedValue(numero({ idUser: 99 }));

        await expect(registrar()).rejects.toThrowError(NumeroAjenoError);
        expect(storage.subir).not.toHaveBeenCalled();
      });

      it('lanza NumeroAjenoError si el número es un número muerto (sin dueño)', async () => {
        repo.buscarNumeroConCuota.mockResolvedValue(numero({ idUser: null }));

        await expect(registrar()).rejects.toThrowError(NumeroAjenoError);
      });

      it('lanza PagoDuplicadoError (409) si ya hay un pago pendiente o confirmado', async () => {
        repo.existePagoActivo.mockResolvedValue(true);

        await expect(registrar()).rejects.toThrowError(PagoDuplicadoError);
        expect(storage.subir).not.toHaveBeenCalled();
        expect(repo.create).not.toHaveBeenCalled();
      });

      it('propaga PagoDuplicadoError detectado dentro de la transacción y no emite evento', async () => {
        repo.create.mockRejectedValue(new PagoDuplicadoError(ID_NUMBER));

        await expect(registrar()).rejects.toThrowError(PagoDuplicadoError);
        expect(eventos.publicarPagoRegistrado).not.toHaveBeenCalled();
      });

      it('lanza NumeroNoEncontradoError (404) si el número no existe', async () => {
        repo.buscarNumeroConCuota.mockResolvedValue(null);

        await expect(registrar()).rejects.toThrowError(NumeroNoEncontradoError);
      });

      it('lanza TandaNoEncontradaError (404) si la tanda no existe', async () => {
        repo.buscarNumeroConCuota.mockResolvedValue(numero({ tanda: null }));

        await expect(registrar()).rejects.toThrowError(TandaNoEncontradaError);
      });

      it('rechaza el pago si la tanda aún no fue iniciada por el organizador', async () => {
        repo.buscarNumeroConCuota.mockResolvedValue(
          numero({ tanda: { idTanda: ID_TANDA, contributionAmount: 1000, status: 'PENDIENTE' } }),
        );

        await expect(registrar()).rejects.toThrowError(/inicia la tanda/);
        expect(repo.create).not.toHaveBeenCalled();
      });

      it('si falla la publicación del evento, igual responde con el pago guardado', async () => {
        eventos.publicarPagoRegistrado.mockRejectedValue(new Error('bus caído'));

        const pago = await registrar();

        expect(pago.idPayment).toBe(45);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CASO DE USO: CONFIRMAR PAGO (AP-05)
  // ─────────────────────────────────────────────────────────────────────────

  describe('PagoService.confirmar (AP-05)', () => {
    const organizador: UsuarioAutenticado = {
      idUser: ID_ORGANIZADOR,
      email: 'org@tandea.test',
      role: 'usuario',
    };

    const adminGlobal: UsuarioAutenticado = {
      idUser: 999,
      email: 'admin@tandea.test',
      role: 'admin_global',
    };

    const otroUsuario: UsuarioAutenticado = {
      idUser: 123,
      email: 'ajeno@tandea.test',
      role: 'usuario',
    };

    const pagoPendiente = (confirmedByParticipant = true): Pago => {
      return Pago.reconstitute({
        idPayment: 50,
        idNumber: ID_NUMBER,
        metodoPago: 'transferencia',
        totalAmount: 1000,
        transferAmount: 1000,
        cashAmount: 0,
        status: 'PENDIENTE',
        confirmedByParticipant,
        confirmedByAdmin: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    };

    it('organizador confirma pago exitosamente, actualiza confirmedByAdmin y emite pago.confirmado', async () => {
      const pago = pagoPendiente(true);
      repo.findById.mockResolvedValue(pago);

      const resultado = await service.confirmar(50, organizador);

      expect(resultado.confirmedByAdmin).toBe(true);
      expect(resultado.status).toBe('CONFIRMADO');
      expect(repo.update).toHaveBeenCalledWith(
        expect.objectContaining({ confirmedByAdmin: true }),
      );
      expect(eventos.publicarPagoConfirmado).toHaveBeenCalledWith({
        paymentId: 50,
        tandaId: ID_TANDA,
        confirmedByAdmin: true,
      });
    });

    it('administrador global puede confirmar pago aunque no sea el idAdmin de la tanda', async () => {
      const pago = pagoPendiente(true);
      repo.findById.mockResolvedValue(pago);

      const resultado = await service.confirmar(50, adminGlobal);

      expect(resultado.confirmedByAdmin).toBe(true);
      expect(repo.update).toHaveBeenCalledOnce();
      expect(eventos.publicarPagoConfirmado).toHaveBeenCalledOnce();
    });

    it('rechaza con UsuarioNoAutorizadoError si el usuario no es el organizador ni admin global', async () => {
      const pago = pagoPendiente(true);
      repo.findById.mockResolvedValue(pago);

      await expect(service.confirmar(50, otroUsuario)).rejects.toThrowError(
        UsuarioNoAutorizadoError,
      );
      expect(repo.update).not.toHaveBeenCalled();
      expect(eventos.publicarPagoConfirmado).not.toHaveBeenCalled();
    });

    it('lanza PagoNotFoundError (404) si el pago no existe', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.confirmar(9999, organizador)).rejects.toThrowError(
        PagoNotFoundError,
      );
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('lanza ConfirmacionOrganizadorPreviaError (422) si el organizador ya había confirmado', async () => {
      const pago = Pago.reconstitute({
        idPayment: 50,
        idNumber: ID_NUMBER,
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
      repo.findById.mockResolvedValue(pago);

      await expect(service.confirmar(50, organizador)).rejects.toThrowError(
        ConfirmacionOrganizadorPreviaError,
      );
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('lanza PagoYaConfirmadoError (422) si el pago ya está completamente confirmado', async () => {
      const pago = Pago.reconstitute({
        idPayment: 50,
        idNumber: ID_NUMBER,
        metodoPago: 'transferencia',
        totalAmount: 1000,
        transferAmount: 1000,
        cashAmount: 0,
        status: 'CONFIRMADO',
        confirmedByParticipant: true,
        confirmedByAdmin: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      repo.findById.mockResolvedValue(pago);

      await expect(service.confirmar(50, organizador)).rejects.toThrowError(
        PagoYaConfirmadoError,
      );
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('lanza PagoRechazadoError (422) si se intenta confirmar un pago previamente rechazado', async () => {
      const pago = Pago.reconstitute({
        idPayment: 50,
        idNumber: ID_NUMBER,
        metodoPago: 'transferencia',
        totalAmount: 1000,
        transferAmount: 1000,
        cashAmount: 0,
        status: 'RECHAZADO',
        confirmedByParticipant: true,
        confirmedByAdmin: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      repo.findById.mockResolvedValue(pago);

      await expect(service.confirmar(50, organizador)).rejects.toThrowError(
        PagoRechazadoError,
      );
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('continúa exitosamente si falla la emisión del evento', async () => {
      const pago = pagoPendiente(true);
      repo.findById.mockResolvedValue(pago);
      eventos.publicarPagoConfirmado.mockRejectedValue(new Error('Event bus down'));

      const resultado = await service.confirmar(50, organizador);

      expect(resultado.confirmedByAdmin).toBe(true);
      expect(repo.update).toHaveBeenCalledOnce();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CASO DE USO: RECHAZAR PAGO (AP-05)
  // ─────────────────────────────────────────────────────────────────────────

  describe('PagoService.rechazar (AP-05)', () => {
    const organizador: UsuarioAutenticado = {
      idUser: ID_ORGANIZADOR,
      email: 'org@tandea.test',
      role: 'usuario',
    };

    const adminGlobal: UsuarioAutenticado = {
      idUser: 999,
      email: 'admin@tandea.test',
      role: 'admin_global',
    };

    const otroUsuario: UsuarioAutenticado = {
      idUser: 123,
      email: 'ajeno@tandea.test',
      role: 'usuario',
    };

    const pagoPendiente = (): Pago => {
      return Pago.reconstitute({
        idPayment: 60,
        idNumber: ID_NUMBER,
        metodoPago: 'transferencia',
        totalAmount: 1000,
        transferAmount: 1000,
        cashAmount: 0,
        status: 'PENDIENTE',
        confirmedByParticipant: true,
        confirmedByAdmin: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    };

    it('organizador rechaza pago exitosamente, guarda motivo y emite pago.rechazado', async () => {
      const pago = pagoPendiente();
      repo.findById.mockResolvedValue(pago);

      const motivo = 'Comprobante no legible y sin número de rastreo válido';
      const resultado = await service.rechazar(60, motivo, organizador);

      expect(resultado.status).toBe('RECHAZADO');
      expect(resultado.rejectionReason).toBe(motivo);
      expect(repo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'RECHAZADO',
          rejectionReason: motivo,
        }),
      );
      expect(eventos.publicarPagoRechazado).toHaveBeenCalledWith({
        paymentId: 60,
        tandaId: ID_TANDA,
        motivo,
      });
    });

    it('administrador global puede rechazar pago', async () => {
      const pago = pagoPendiente();
      repo.findById.mockResolvedValue(pago);

      const motivo = 'Fraude detectado por mesa de control';
      const resultado = await service.rechazar(60, motivo, adminGlobal);

      expect(resultado.status).toBe('RECHAZADO');
      expect(resultado.rejectionReason).toBe(motivo);
      expect(repo.update).toHaveBeenCalledOnce();
      expect(eventos.publicarPagoRechazado).toHaveBeenCalledOnce();
    });

    it('rechaza con UsuarioNoAutorizadoError si el usuario no es organizador ni admin global', async () => {
      const pago = pagoPendiente();
      repo.findById.mockResolvedValue(pago);

      await expect(
        service.rechazar(60, 'Motivo de prueba', otroUsuario),
      ).rejects.toThrowError(UsuarioNoAutorizadoError);

      expect(repo.update).not.toHaveBeenCalled();
      expect(eventos.publicarPagoRechazado).not.toHaveBeenCalled();
    });

    it('lanza PagoNotFoundError (404) si el pago no existe', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(
        service.rechazar(9999, 'Motivo cualquiera', organizador),
      ).rejects.toThrowError(PagoNotFoundError);

      expect(repo.update).not.toHaveBeenCalled();
    });

    it('lanza PagoYaConfirmadoError (422) si se intenta rechazar un pago ya confirmado', async () => {
      const pago = Pago.reconstitute({
        idPayment: 60,
        idNumber: ID_NUMBER,
        metodoPago: 'transferencia',
        totalAmount: 1000,
        transferAmount: 1000,
        cashAmount: 0,
        status: 'CONFIRMADO',
        confirmedByParticipant: true,
        confirmedByAdmin: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      repo.findById.mockResolvedValue(pago);

      await expect(
        service.rechazar(60, 'Intento de rechazar pago confirmado', organizador),
      ).rejects.toThrowError(PagoYaConfirmadoError);

      expect(repo.update).not.toHaveBeenCalled();
      expect(eventos.publicarPagoRechazado).not.toHaveBeenCalled();
    });

    it('continúa exitosamente si falla la emisión del evento', async () => {
      const pago = pagoPendiente();
      repo.findById.mockResolvedValue(pago);
      eventos.publicarPagoRechazado.mockRejectedValue(new Error('Event bus down'));

      const resultado = await service.rechazar(60, 'Comprobante falso', organizador);

      expect(resultado.status).toBe('RECHAZADO');
      expect(repo.update).toHaveBeenCalledOnce();
    });
  });
});

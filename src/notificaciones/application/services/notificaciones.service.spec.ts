import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificacionesService } from './notificaciones.service';
import type {
  ContextoPago,
  NotificacionRepositoryPort,
} from '../../domain/ports/out/notificacion-repository.port';
import type { NotificacionPort } from '../../domain/ports/out/notificacion.port';

const ID_PAGO = 15;
const ID_TANDA = 3;
const ID_ORGANIZADOR = 99;
const ID_PARTICIPANTE = 7;

const contexto = (cambios: Partial<ContextoPago> = {}): ContextoPago => ({
  paymentId: ID_PAGO,
  idTanda: ID_TANDA,
  nombreTanda: 'Tanda de la oficina',
  idOrganizador: ID_ORGANIZADOR,
  idParticipante: ID_PARTICIPANTE,
  nombreParticipante: 'Ana López',
  numero: 4,
  ...cambios,
});

describe('NotificacionesService', () => {
  let repositorio: { buscarContextoPago: ReturnType<typeof vi.fn>; guardar: ReturnType<typeof vi.fn> };
  let push: { enviar: ReturnType<typeof vi.fn> };
  let service: NotificacionesService;

  beforeEach(() => {
    repositorio = {
      buscarContextoPago: vi.fn().mockResolvedValue(contexto()),
      guardar: vi.fn().mockResolvedValue(1),
    };
    push = { enviar: vi.fn().mockResolvedValue(undefined) };
    service = new NotificacionesService(
      repositorio as unknown as NotificacionRepositoryPort,
      push as unknown as NotificacionPort,
    );
  });

  describe('pago.registrado', () => {
    it('guarda y envía el aviso al organizador con la ruta de revisión', async () => {
      await service.alRegistrarPago({ paymentId: ID_PAGO, tandaId: ID_TANDA, userId: ID_PARTICIPANTE });

      expect(repositorio.guardar).toHaveBeenCalledWith({
        idUser: ID_ORGANIZADOR,
        idTanda: ID_TANDA,
        type: 'pago_registrado',
        message: 'Ana López registró el pago del número 4 en la tanda "Tanda de la oficina".',
      });
      expect(push.enviar).toHaveBeenCalledWith(
        ID_ORGANIZADOR,
        'Nuevo pago por revisar',
        expect.any(String),
        { type: 'pago_registrado', route: `/pagos/${ID_PAGO}/revisar` },
      );
    });

    it('no avisa cuando el organizador paga su propio número', async () => {
      repositorio.buscarContextoPago.mockResolvedValue(contexto({ idParticipante: ID_ORGANIZADOR }));

      await service.alRegistrarPago({ paymentId: ID_PAGO, tandaId: ID_TANDA, userId: ID_ORGANIZADOR });

      expect(repositorio.guardar).not.toHaveBeenCalled();
      expect(push.enviar).not.toHaveBeenCalled();
    });
  });

  describe('pago.confirmado', () => {
    it('avisa al participante dueño del número', async () => {
      await service.alConfirmarPago({ paymentId: ID_PAGO, tandaId: ID_TANDA, confirmedByAdmin: true });

      expect(repositorio.guardar).toHaveBeenCalledWith(
        expect.objectContaining({ idUser: ID_PARTICIPANTE, type: 'pago_confirmado' }),
      );
      expect(push.enviar).toHaveBeenCalledWith(
        ID_PARTICIPANTE,
        'Pago confirmado',
        expect.any(String),
        { type: 'pago_confirmado', route: `/tandas/detalle/${ID_TANDA}` },
      );
    });

    it('resuelve la tanda desde el pago aunque el evento llegue con tandaId 0', async () => {
      await service.alConfirmarPago({ paymentId: ID_PAGO, tandaId: 0, confirmedByAdmin: true });

      expect(repositorio.guardar).toHaveBeenCalledWith(expect.objectContaining({ idTanda: ID_TANDA }));
    });
  });

  describe('pago.rechazado', () => {
    it('incluye el motivo en el mensaje al participante', async () => {
      await service.alRechazarPago({ paymentId: ID_PAGO, tandaId: ID_TANDA, motivo: 'El comprobante no se lee' });

      expect(repositorio.guardar).toHaveBeenCalledWith(
        expect.objectContaining({
          idUser: ID_PARTICIPANTE,
          type: 'pago_rechazado',
          message: expect.stringContaining('El comprobante no se lee'),
        }),
      );
    });
  });

  it('no hace nada si el pago no existe', async () => {
    repositorio.buscarContextoPago.mockResolvedValue(null);

    await service.alConfirmarPago({ paymentId: 404, confirmedByAdmin: true });

    expect(repositorio.guardar).not.toHaveBeenCalled();
    expect(push.enviar).not.toHaveBeenCalled();
  });

  it('conserva la notificación en la bandeja aunque falle el push', async () => {
    push.enviar.mockRejectedValue(new Error('FCM caído'));

    await expect(
      service.alConfirmarPago({ paymentId: ID_PAGO, tandaId: ID_TANDA, confirmedByAdmin: true }),
    ).resolves.toBeUndefined();
    expect(repositorio.guardar).toHaveBeenCalledTimes(1);
  });
});

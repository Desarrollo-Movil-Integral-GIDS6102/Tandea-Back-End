import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as firebaseApp from 'firebase-admin/app';
import * as firebaseMessaging from 'firebase-admin/messaging';
import { NotificacionFcmAdapter } from '../src/notificaciones/infrastructure/adapters/out/push/notificacion-fcm.adapter';
import { FcmTokenRepositoryPort } from '../src/notificaciones/domain/ports/out/fcm-token-repository.port';
import { FcmTokenService } from '../src/notificaciones/application/services/fcm-token.service';
import { UsersFcmController } from '../src/notificaciones/infrastructure/adapters/in/http/controllers/users-fcm.controller';

vi.mock('firebase-admin/app', () => ({
  getApps: vi.fn(() => []),
  initializeApp: vi.fn(() => ({})),
  cert: vi.fn(() => ({})),
}));

vi.mock('firebase-admin/messaging', () => ({
  getMessaging: vi.fn(),
}));

describe('Adaptador de Infraestructura: NotificacionFcmAdapter y PATCH /users/me/fcm-token', () => {
  const originalEnv = { ...process.env };
  let tokenStore: Map<number, string | null>;
  let mockFcmTokenRepo: FcmTokenRepositoryPort;
  let obtenerTokenSpy: ReturnType<typeof vi.fn>;
  let guardarTokenSpy: ReturnType<typeof vi.fn>;
  let borrarTokenSpy: ReturnType<typeof vi.fn>;
  let mockSend: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({
      project_id: 'tandea-fcm-project',
      client_email: 'firebase-adminsdk@tandea-fcm-project.iam.gserviceaccount.com',
      private_key:
        '-----BEGIN PRIVATE KEY-----\\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC\\n-----END PRIVATE KEY-----\\n',
    });

    tokenStore = new Map<number, string | null>();

    obtenerTokenSpy = vi.fn().mockImplementation(async (userId: number) => {
      return tokenStore.get(userId) ?? null;
    });
    guardarTokenSpy = vi
      .fn()
      .mockImplementation(async (userId: number, fcmToken: string) => {
        tokenStore.set(userId, fcmToken);
      });
    borrarTokenSpy = vi.fn().mockImplementation(async (userId: number) => {
      tokenStore.set(userId, null);
    });

    mockFcmTokenRepo = {
      obtenerTokenPorUsuario: obtenerTokenSpy,
      guardarToken: guardarTokenSpy,
      borrarToken: borrarTokenSpy,
    };

    mockSend = vi
      .fn()
      .mockResolvedValue('projects/tandea-fcm-project/messages/msg_123');

    vi.mocked(firebaseApp.getApps).mockReturnValue([]);
    vi.mocked(firebaseMessaging.getMessaging).mockReturnValue({
      send: mockSend,
    } as unknown as firebaseMessaging.Messaging);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('debe leer la cuenta de servicio desde la variable de entorno FIREBASE_SERVICE_ACCOUNT', () => {
    new NotificacionFcmAdapter(mockFcmTokenRepo);

    expect(firebaseApp.cert).toHaveBeenCalledWith({
      projectId: 'tandea-fcm-project',
      clientEmail: 'firebase-adminsdk@tandea-fcm-project.iam.gserviceaccount.com',
      privateKey:
        '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC\n-----END PRIVATE KEY-----\n',
    });
    expect(firebaseApp.initializeApp).toHaveBeenCalledOnce();
  });

  it('PATCH /users/me/fcm-token debe guardar el token del usuario autenticado y permitir enviar notificación', async () => {
    const service = new FcmTokenService(mockFcmTokenRepo);
    const controller = new UsersFcmController(service);
    const adapter = new NotificacionFcmAdapter(mockFcmTokenRepo);

    const authenticatedUser = {
      idUser: 7,
      email: 'participante@tandea.com',
      role: 'usuario',
    };

    // 1. El usuario registra su token FCM mediante PATCH /users/me/fcm-token
    const response = await controller.updateFcmToken(authenticatedUser, {
      fcmToken: 'fcm_device_token_real_celular_abc123',
    });

    expect(response).toEqual({
      message: 'Token FCM actualizado correctamente',
      fcmToken: 'fcm_device_token_real_celular_abc123',
    });
    expect(guardarTokenSpy).toHaveBeenCalledWith(
      7,
      'fcm_device_token_real_celular_abc123',
    );
    expect(tokenStore.get(7)).toBe('fcm_device_token_real_celular_abc123');

    // 2. Se envía una notificación mediante NotificacionPort.enviar(userId, titulo, cuerpo)
    await adapter.enviar(
      7,
      'Recordatorio de pago',
      'Tu aporte de la ronda 2 vence mañana',
    );

    expect(mockSend).toHaveBeenCalledWith({
      token: 'fcm_device_token_real_celular_abc123',
      notification: {
        title: 'Recordatorio de pago',
        body: 'Tu aporte de la ronda 2 vence mañana',
      },
      android: { priority: 'high', notification: { channelId: 'tandea_avisos' } },
    });
  });

  it('debe borrar el token de la base de datos si FCM responde not-registered', async () => {
    const service = new FcmTokenService(mockFcmTokenRepo);
    const controller = new UsersFcmController(service);
    const adapter = new NotificacionFcmAdapter(mockFcmTokenRepo);

    const authenticatedUser = {
      idUser: 15,
      email: 'usuario15@tandea.com',
      role: 'usuario',
    };

    // 1. Guardar el token mediante PATCH /users/me/fcm-token
    await controller.updateFcmToken(authenticatedUser, {
      token: 'token_expirado_o_desinstalado_xyz',
    });
    expect(tokenStore.get(15)).toBe('token_expirado_o_desinstalado_xyz');

    // 2. Simular respuesta messaging/registration-token-not-registered de FCM
    const fcmNotRegisteredError = Object.assign(
      new Error('Requested entity was not found.'),
      { code: 'messaging/registration-token-not-registered' },
    );
    mockSend.mockRejectedValueOnce(fcmNotRegisteredError);

    // 3. Enviar notificación -> debe capturar not-registered y borrar el token
    await expect(
      adapter.enviar(15, 'Turno entregado', 'Has recibido tu tanda'),
    ).resolves.toBeUndefined();

    expect(borrarTokenSpy).toHaveBeenCalledWith(15);
    expect(tokenStore.get(15)).toBeNull();
  });

  it('debe omitir el envío si el usuario no tiene token FCM registrado', async () => {
    const adapter = new NotificacionFcmAdapter(mockFcmTokenRepo);

    await adapter.enviar(99, 'Título', 'Cuerpo');

    expect(obtenerTokenSpy).toHaveBeenCalledWith(99);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('PATCH /users/me/fcm-token debe rechazar un payload sin token válido', async () => {
    const service = new FcmTokenService(mockFcmTokenRepo);
    const controller = new UsersFcmController(service);

    await expect(
      controller.updateFcmToken(
        { idUser: 1, email: 'a@b.com', role: 'usuario' },
        { fcmToken: '   ' },
      ),
    ).rejects.toThrow();
  });
});


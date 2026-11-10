import { Injectable, Inject, Logger } from '@nestjs/common';
import * as firebaseApp from 'firebase-admin/app';
import * as firebaseMessaging from 'firebase-admin/messaging';
import { NotificacionPort } from '../../../../domain/ports/out/notificacion.port';
import {
  FCM_TOKEN_REPOSITORY_PORT,
  type FcmTokenRepositoryPort,
} from '../../../../domain/ports/out/fcm-token-repository.port';

/**
 * Adaptador Secundario (Driven / Outbound Adapter): NotificacionFcmAdapter
 *
 * Implementa el puerto NotificacionPort utilizando Firebase Cloud Messaging (firebase-admin).
 *
 * Cumplimiento de Criterios de Aceptación:
 * 1. NotificacionPort.enviar(userId, titulo, cuerpo, data?) envía una notificación push real vía FCM.
 * 2. La cuenta de servicio se lee exclusivamente de variables de entorno:
 *    - FIREBASE_SERVICE_ACCOUNT (o FIREBASE_SERVICE_ACCOUNT_JSON) en JSON o Base64
 *    - O bien FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY
 *    Nunca se lee de un archivo dentro del repositorio.
 * 3. Si FCM responde not-registered (messaging/registration-token-not-registered),
 *    se borra automáticamente el token del usuario en la base de datos.
 */
@Injectable()
export class NotificacionFcmAdapter implements NotificacionPort {
  private readonly logger = new Logger(NotificacionFcmAdapter.name);

  constructor(
    @Inject(FCM_TOKEN_REPOSITORY_PORT)
    private readonly fcmTokenRepository: FcmTokenRepositoryPort,
  ) {
    this.inicializarFirebase();
  }

  private inicializarFirebase(): void {
    if (firebaseApp.getApps().length > 0) {
      return;
    }

    const serviceAccount = this.obtenerCuentaDeServicioDesdeEnv();
    if (!serviceAccount) {
      this.logger.warn(
        'Credenciales de Firebase no configuradas en variables de entorno. FCM permanecerá inactivo hasta configurarlas.',
      );
      return;
    }

    firebaseApp.initializeApp({
      credential: firebaseApp.cert(serviceAccount),
    });
  }

  private obtenerCuentaDeServicioDesdeEnv(): firebaseApp.ServiceAccount | null {
    const rawJsonEnv =
      process.env.FIREBASE_SERVICE_ACCOUNT ??
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    if (rawJsonEnv && rawJsonEnv.trim().length > 0) {
      const trimmed = rawJsonEnv.trim();
      const jsonString = trimmed.startsWith('{')
        ? trimmed
        : Buffer.from(trimmed, 'base64').toString('utf-8');

      const parsed = JSON.parse(jsonString) as Record<string, string>;
      const projectId = parsed.project_id ?? parsed.projectId;
      const clientEmail = parsed.client_email ?? parsed.clientEmail;
      const rawPrivateKey = parsed.private_key ?? parsed.privateKey;
      const privateKey = rawPrivateKey
        ? rawPrivateKey.replace(/\\n/g, '\n')
        : undefined;

      if (projectId && clientEmail && privateKey) {
        return {
          projectId,
          clientEmail,
          privateKey,
        };
      }
    }

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (projectId && clientEmail && privateKey) {
      return {
        projectId,
        clientEmail,
        privateKey,
      };
    }

    return null;
  }

  async enviar(
    userId: number,
    titulo: string,
    cuerpo: string,
    data?: Record<string, string>,
  ): Promise<void> {
    const token = await this.fcmTokenRepository.obtenerTokenPorUsuario(userId);

    if (!token) {
      this.logger.warn(
        `El usuario ${userId} no tiene un token FCM registrado. Omitiendo notificación.`,
      );
      return;
    }

    if (firebaseApp.getApps().length === 0) {
      this.inicializarFirebase();
    }

    try {
      await firebaseMessaging.getMessaging().send({
        token,
        notification: {
          title: titulo,
          body: cuerpo,
        },
        ...(data ? { data } : {}),
        // Prioridad alta: con la normal Android retrasa el aviso minutos cuando el celular está en reposo
        android: { priority: 'high', notification: { channelId: 'tandea_avisos' } },
      });
      this.logger.log(
        `Notificación FCM enviada exitosamente al usuario ${userId}`,
      );
    } catch (error: any) {
      if (this.esErrorTokenNoRegistrado(error)) {
        this.logger.warn(
          `Token FCM no registrado para el usuario ${userId}. Borrando token de la base de datos.`,
        );
        await this.fcmTokenRepository.borrarToken(userId);
        return;
      }

      this.logger.error(
        `Error al enviar notificación FCM al usuario ${userId}: ${error?.message ?? error}`,
      );
      throw error;
    }
  }

  private esErrorTokenNoRegistrado(error: any): boolean {
    const code: string = error?.code ?? error?.errorInfo?.code ?? '';
    const message: string = error?.message ?? '';

    return (
      code === 'messaging/registration-token-not-registered' ||
      code === 'not-registered' ||
      code.endsWith('/registration-token-not-registered') ||
      message.includes('registration-token-not-registered') ||
      message.includes('not-registered')
    );
  }
}


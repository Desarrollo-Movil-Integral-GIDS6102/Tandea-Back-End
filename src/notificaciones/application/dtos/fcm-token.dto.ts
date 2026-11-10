import { z } from 'zod';

export const zUpdateFcmTokenDto = z
  .object({
    fcmToken: z
      .string()
      .trim()
      .min(1, 'El token FCM no puede estar vacío')
      .optional(),
    token: z
      .string()
      .trim()
      .min(1, 'El token FCM no puede estar vacío')
      .optional(),
    fcm_token: z
      .string()
      .trim()
      .min(1, 'El token FCM no puede estar vacío')
      .optional(),
  })
  .refine((data) => Boolean(data.fcmToken || data.token || data.fcm_token), {
    message: 'El token FCM es requerido',
    path: ['fcmToken'],
  })
  .transform((data) => ({
    fcmToken: (data.fcmToken ?? data.token ?? data.fcm_token) as string,
  }));

export type UpdateFcmTokenDto = z.infer<typeof zUpdateFcmTokenDto>;


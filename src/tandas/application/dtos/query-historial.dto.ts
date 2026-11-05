import { z } from 'zod';

export const zQueryHistorial = z.object({
  userId: z.coerce
    .number({ invalid_type_error: 'El parámetro "userId" debe ser un número entero' })
    .int('El parámetro "userId" debe ser un número entero')
    .positive('El parámetro "userId" debe ser mayor a 0')
    .optional(),

  cursor: z
    .string({ invalid_type_error: 'El parámetro "cursor" debe ser texto' })
    .trim()
    .min(1, 'El parámetro "cursor" no puede ir vacío')
    .optional(),

  limit: z.coerce
    .number({ invalid_type_error: 'El parámetro "limit" debe ser un número entero' })
    .int('El límite debe ser un número entero')
    .min(1, 'El límite debe ser al menos 1')
    .max(50, 'El límite no puede exceder 50')
    .default(20),
});

export type QueryHistorialDto = z.infer<typeof zQueryHistorial>;

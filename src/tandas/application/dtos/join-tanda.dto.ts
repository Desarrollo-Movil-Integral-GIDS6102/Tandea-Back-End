import { z } from 'zod';

export const zJoinTanda = z.object({
  inviteCode: z
    .string({
      required_error: 'El campo "inviteCode" (código de invitación) es obligatorio',
      invalid_type_error: 'El campo "inviteCode" debe ser una cadena de texto',
    })
    .min(3, 'El código de invitación debe tener al menos 3 caracteres')
    .max(20, 'El código de invitación no puede exceder 20 caracteres'),

  selectedNumber: z.coerce
    .number({ invalid_type_error: 'El campo "selectedNumber" debe ser un número entero' })
    .int('El turno debe ser un número entero')
    .min(1, 'El turno debe ser mayor o igual a 1')
    .optional(),
});

export type JoinTandaDto = z.infer<typeof zJoinTanda>;

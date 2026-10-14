import { z } from 'zod';

export const zUpdateTanda = z.object({
  name: z
    .string({ invalid_type_error: 'El campo "name" debe ser una cadena de texto' })
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(150, 'El nombre no puede exceder 150 caracteres')
    .optional(),

  description: z
    .string({ invalid_type_error: 'El campo "description" debe ser una cadena de texto o null' })
    .max(500, 'La descripción no puede exceder 500 caracteres')
    .nullable()
    .optional(),
});

export type UpdateTandaDto = z.infer<typeof zUpdateTanda>;

export const zUpdateTandaStatus = z.object({
  status: z.enum(['PENDIENTE', 'ACTIVA', 'FINALIZADA', 'SUSPENDIDA', 'CANCELADA'], {
    required_error: 'El campo "status" es requerido',
    invalid_type_error: 'Estado inválido. Debe ser exactamente uno de: PENDIENTE, ACTIVA, FINALIZADA, SUSPENDIDA o CANCELADA',
  }),
});

export type UpdateTandaStatusDto = z.infer<typeof zUpdateTandaStatus>;

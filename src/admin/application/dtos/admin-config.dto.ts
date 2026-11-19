import { z } from 'zod';

export const zActualizarConfigDto = z.object({
  maxUsersPerTanda: z.coerce
    .number({
      required_error: 'El campo "maxUsersPerTanda" es obligatorio',
      invalid_type_error: 'El campo "maxUsersPerTanda" debe ser un número entero',
    })
    .int('El máximo de participantes por tanda debe ser un número entero')
    .min(3, 'El máximo de participantes por tanda debe ser al menos 3')
    .max(50, 'El máximo de participantes por tanda no puede exceder 50'),

  maxActiveTandasPerUser: z.coerce
    .number({
      required_error: 'El campo "maxActiveTandasPerUser" es obligatorio',
      invalid_type_error: 'El campo "maxActiveTandasPerUser" debe ser un número entero',
    })
    .int('El máximo de tandas activas por usuario debe ser un número entero')
    .min(1, 'El máximo de tandas activas por usuario debe ser al menos 1')
    .max(50, 'El máximo de tandas activas por usuario no puede exceder 50'),

  maxGraceDays: z.coerce
    .number({
      required_error: 'El campo "maxGraceDays" es obligatorio',
      invalid_type_error: 'El campo "maxGraceDays" debe ser un número entero',
    })
    .int('El máximo de días de gracia debe ser un número entero')
    .min(0, 'Los días de gracia no pueden ser negativos')
    .max(30, 'El máximo de días de gracia no puede exceder 30'),
});

export type ActualizarConfigDto = z.infer<typeof zActualizarConfigDto>;

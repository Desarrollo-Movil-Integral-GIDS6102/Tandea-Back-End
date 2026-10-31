import { z } from 'zod';

export const zCreateTanda = z.object({
  name: z
    .string({
      required_error: 'El campo "name" (nombre de la tanda) es obligatorio',
      invalid_type_error: 'El campo "name" debe ser una cadena de texto',
    })
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(150, 'El nombre no puede exceder 150 caracteres'),

  description: z
    .string({ invalid_type_error: 'El campo "description" debe ser una cadena de texto' })
    .max(500, 'La descripción no puede exceder 500 caracteres')
    .optional(),

  startDate: z
    .string({
      required_error: 'El campo "startDate" (fecha de inicio) es obligatorio',
      invalid_type_error: 'El campo "startDate" debe ser una fecha en formato texto',
    })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha de inicio debe tener el formato estricto YYYY-MM-DD (ej. 2026-11-01)'),

  contributionAmount: z
    .number({
      required_error: 'El campo "contributionAmount" (monto de aportación) es obligatorio',
      invalid_type_error: 'El campo "contributionAmount" debe ser un número',
    })
    .positive('El monto de contribución debe ser mayor a 0'),

  numParticipants: z
    .number({
      required_error: 'El campo "numParticipants" (número de participantes) es obligatorio',
      invalid_type_error: 'El campo "numParticipants" debe ser un número entero',
    })
    .int('El número de participantes debe ser un número entero')
    .min(3, 'Una tanda requiere al menos 3 participantes')
    .max(50, 'El número máximo de participantes permitido es 50'),

  numRounds: z
    .number({ invalid_type_error: 'El campo "numRounds" debe ser un número entero' })
    .int('El número de rondas debe ser un entero')
    .min(1, 'Debe haber al menos 1 ronda')
    .default(1),

  graceDays: z
    .number({ invalid_type_error: 'El campo "graceDays" debe ser un número entero' })
    .int('Los días de gracia deben ser un número entero')
    .min(0, 'Los días de gracia no pueden ser negativos')
    .default(0),

  periodicity: z
    .enum(['diaria', 'semanal', 'quincenal', 'mensual'], {
      invalid_type_error: 'El campo "periodicity" debe ser diaria, semanal, quincenal o mensual',
    })
    .default('quincenal'),

  hasDeadNumber: z
    .boolean({ invalid_type_error: 'El campo "hasDeadNumber" debe ser booleano (true o false)' })
    .default(false),

  idTandaType: z
    .number({ invalid_type_error: 'El campo "idTandaType" debe ser un número entero positivo' })
    .int('El idTandaType debe ser un número entero')
    .positive('El idTandaType debe ser positivo')
    .default(1),
});

export type CreateTandaDto = z.infer<typeof zCreateTanda>;

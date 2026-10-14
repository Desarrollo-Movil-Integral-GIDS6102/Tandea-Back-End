import { z } from 'zod';

export const zQueryTandas = z.object({
  page: z.coerce
    .number({ invalid_type_error: 'El parámetro "page" debe ser un número entero' })
    .int('La página debe ser un número entero')
    .min(1, 'La página debe ser mayor o igual a 1')
    .default(1),

  limit: z.coerce
    .number({ invalid_type_error: 'El parámetro "limit" debe ser un número entero' })
    .int('El límite debe ser un número entero')
    .min(1, 'El límite por página debe ser al menos 1')
    .max(100, 'El límite por página no puede exceder 100')
    .default(10),

  search: z.string({ invalid_type_error: 'El parámetro "search" debe ser texto' }).trim().optional(),
  name: z.string({ invalid_type_error: 'El parámetro "name" debe ser texto' }).trim().optional(),

  status: z
    .enum(['PENDIENTE', 'ACTIVA', 'FINALIZADA', 'SUSPENDIDA', 'CANCELADA'], {
      invalid_type_error: 'El filtro "status" debe ser uno de: PENDIENTE, ACTIVA, FINALIZADA, SUSPENDIDA o CANCELADA',
    })
    .optional(),

  startDateFrom: z
    .string({ invalid_type_error: 'El parámetro "startDateFrom" debe ser texto en formato YYYY-MM-DD' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'El parámetro "startDateFrom" debe tener formato YYYY-MM-DD (ej. 2026-11-01)')
    .optional(),

  startDateTo: z
    .string({ invalid_type_error: 'El parámetro "startDateTo" debe ser texto en formato YYYY-MM-DD' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'El parámetro "startDateTo" debe tener formato YYYY-MM-DD (ej. 2026-12-31)')
    .optional(),

  scope: z
    .enum(['dueno', 'participante', 'todos'], {
      invalid_type_error: 'El filtro "scope" solo admite: "dueno", "participante" o "todos"',
    })
    .default('todos'),

  sortBy: z
    .enum(['name', 'startDate', 'createdAt', 'contributionAmount'], {
      invalid_type_error: 'El ordenamiento "sortBy" solo admite: "name", "startDate", "createdAt" o "contributionAmount"',
    })
    .default('createdAt'),

  sortOrder: z
    .enum(['asc', 'desc'], {
      invalid_type_error: 'El orden "sortOrder" solo admite "asc" o "desc"',
    })
    .default('desc'),
});

export type QueryTandasDto = z.infer<typeof zQueryTandas>;

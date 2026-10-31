import { z } from 'zod';

const zMonto = z.coerce
  .number({ invalid_type_error: 'El monto debe ser un número' })
  .min(0, 'El monto no puede ser negativo')
  .default(0);

/** Llega como multipart/form-data, por eso los números se convierten desde texto. */
export const zRegistrarEntrega = z.object({
  idNumber: z.coerce
    .number({ required_error: 'El campo "idNumber" es obligatorio' })
    .int('El idNumber debe ser un número entero')
    .positive('El idNumber debe ser positivo'),
  transferAmount: zMonto,
  cashAmount: zMonto,
});

export const zReportarProblema = z.object({
  motivo: z
    .string({ required_error: 'Describe el problema' })
    .trim()
    .min(1, 'Describe el problema')
    .max(500, 'El motivo no puede exceder 500 caracteres'),
});

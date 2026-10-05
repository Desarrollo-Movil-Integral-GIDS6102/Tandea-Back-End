import { z } from 'zod';

// ─────────────────────────────────────────────
// Enums compartidos
// ─────────────────────────────────────────────

export const zMetodoPago = z.enum(['efectivo', 'transferencia', 'hibrido']);
export const zEstadoPago = z.enum([
  'pendiente',
  'confirmado_parcial',
  'confirmado',
  'rechazado',
]);

// ─────────────────────────────────────────────
// DTO de ENTRADA — Crear un Pago (Command)
// ─────────────────────────────────────────────

export const zPagoCreate = z
  .object({
    tandaId: z.string().uuid({ message: 'tandaId debe ser un UUID válido' }),
    participanteId: z
      .string()
      .uuid({ message: 'participanteId debe ser un UUID válido' }),
    numeroPago: z
      .number()
      .int()
      .positive({ message: 'El número de pago debe ser un entero positivo' }),
    monto: z
      .number()
      .positive({ message: 'El monto debe ser mayor a cero' })
      .multipleOf(0.01, { message: 'El monto no puede tener más de 2 decimales' }),
    montoEfectivo: z.number().min(0).default(0),
    montoTransferencia: z.number().min(0).default(0),
    metodoPago: zMetodoPago,
    comprobanteUrl: z
      .string()
      .url({ message: 'El comprobante debe ser una URL válida' })
      .nullable()
      .default(null),
    fechaPago: z.coerce.date({
      errorMap: () => ({ message: 'fechaPago debe ser una fecha válida' }),
    }),
  })
  .superRefine((data, ctx) => {
    const totalParciales = parseFloat(
      (data.montoEfectivo + data.montoTransferencia).toFixed(2),
    );

    // Validar que los parciales sumen el total
    if (totalParciales !== data.monto) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['monto'],
        message: `montoEfectivo (${data.montoEfectivo}) + montoTransferencia (${data.montoTransferencia}) debe ser igual a monto (${data.monto})`,
      });
    }

    // Comprobante obligatorio si hay transferencia
    if (data.montoTransferencia > 0 && !data.comprobanteUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['comprobanteUrl'],
        message:
          'comprobanteUrl es obligatorio cuando existe un monto de transferencia',
      });
    }

    // Consistencia método/montos
    if (data.metodoPago === 'efectivo' && data.montoTransferencia > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['metodoPago'],
        message:
          'Método "efectivo" no permite montoTransferencia mayor a cero',
      });
    }
    if (data.metodoPago === 'transferencia' && data.montoEfectivo > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['metodoPago'],
        message:
          'Método "transferencia" no permite montoEfectivo mayor a cero',
      });
    }
    if (
      data.metodoPago === 'hibrido' &&
      (data.montoEfectivo === 0 || data.montoTransferencia === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['metodoPago'],
        message:
          'Método "hibrido" requiere que tanto montoEfectivo como montoTransferencia sean mayores a cero',
      });
    }
  });

export type CreatePagoDto = z.infer<typeof zPagoCreate>;

// ─────────────────────────────────────────────
// DTO de SALIDA — Respuesta de un Pago
// ─────────────────────────────────────────────

export const zPagoResponse = z.object({
  id: z.string().uuid(),
  tandaId: z.string().uuid(),
  participanteId: z.string().uuid(),
  numeroPago: z.number().int().positive(),
  monto: z.number(),
  montoEfectivo: z.number(),
  montoTransferencia: z.number(),
  metodoPago: zMetodoPago,
  estado: zEstadoPago,
  comprobanteUrl: z.string().url().nullable(),
  montoOcrValidado: z.number().nullable(),
  ocrAprobado: z.boolean().nullable(),
  confirmadoOrganizadorEn: z.coerce.date().nullable(),
  confirmadoReceptorEn: z.coerce.date().nullable(),
  fechaPago: z.coerce.date(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type PagoResponseDto = z.infer<typeof zPagoResponse>;

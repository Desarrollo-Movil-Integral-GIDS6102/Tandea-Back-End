import { z } from 'zod';
import { esMontoMonetarioValido } from '../../domain/utils/moneda.util';

// ─────────────────────────────────────────────
// Enums compartidos
// ─────────────────────────────────────────────

export const zMetodoPago = z.enum(['efectivo', 'transferencia', 'hibrido'], {
  errorMap: () => ({
    message: 'metodoPago debe ser "efectivo", "transferencia" o "hibrido"',
  }),
});
export const zEstadoPago = z.enum(['PENDIENTE', 'CONFIRMADO', 'RECHAZADO']);

// ─────────────────────────────────────────────
// Helpers de campos
// ─────────────────────────────────────────────

/**
 * Monto opcional. Acepta número o texto (los campos de multipart llegan como string).
 * Cadena vacía o ausente → undefined (la cuota real la decide el servicio).
 */
const zMontoOpcional = (campo: string) =>
  z.preprocess(
    (v) => (v === undefined || v === null || v === '' ? undefined : Number(v)),
    z
      .number({ invalid_type_error: `${campo} debe ser un número` })
      .refine(esMontoMonetarioValido, {
        message: `${campo} debe ser un número finito, no negativo y con máximo 2 decimales`,
      })
      .optional(),
  );

// ─────────────────────────────────────────────
// DTO de ENTRADA — Registrar un Pago (AP-03)
// Campos de texto del multipart/form-data; el archivo viaja en `file`.
// ─────────────────────────────────────────────

export const zRegistrarPago = z
  .object({
    idNumber: z.coerce
      .number({ invalid_type_error: 'idNumber debe ser un número' })
      .int({ message: 'idNumber debe ser un entero' })
      .positive({ message: 'idNumber debe ser un entero positivo' }),
    metodoPago: zMetodoPago,
    transferAmount: zMontoOpcional('transferAmount'),
    cashAmount: zMontoOpcional('cashAmount'),
  })
  .superRefine((data, ctx) => {
    // Consistencia método/montos (la suma contra la cuota se valida en el dominio)
    if (data.metodoPago === 'efectivo' && (data.transferAmount ?? 0) > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['metodoPago'],
        message: 'Método "efectivo" no permite transferAmount mayor a cero',
      });
    }
    if (data.metodoPago === 'transferencia' && (data.cashAmount ?? 0) > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['metodoPago'],
        message: 'Método "transferencia" no permite cashAmount mayor a cero',
      });
    }
    if (
      data.metodoPago === 'hibrido' &&
      (!data.cashAmount || !data.transferAmount)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['metodoPago'],
        message:
          'Método "hibrido" requiere que tanto cashAmount como transferAmount sean mayores a cero',
      });
    }
  });

export type RegistrarPagoDto = z.infer<typeof zRegistrarPago>;

// ─────────────────────────────────────────────
// DTO de ENTRADA — Rechazar un Pago (AP-05)
// ─────────────────────────────────────────────

export const zRechazarPago = z.object({
  motivo: z
    .string({ required_error: 'El motivo de rechazo es obligatorio' })
    .trim()
    .min(5, { message: 'El motivo debe tener al menos 5 caracteres' })
    .max(500, { message: 'El motivo no puede exceder 500 caracteres' }),
});

export type RechazarPagoDto = z.infer<typeof zRechazarPago>;

// ─────────────────────────────────────────────
// DTO de SALIDA — Respuesta de un Pago
// ─────────────────────────────────────────────

export const zPagoResponse = z.object({
  idPayment: z.number().int().positive(),
  idNumber: z.number().int().positive(),
  metodoPago: zMetodoPago,
  transferAmount: z.number(),
  cashAmount: z.number(),
  totalAmount: z.number(),
  status: zEstadoPago,
  confirmedByParticipant: z.boolean(),
  confirmedByAdmin: z.boolean(),
  ocrVerified: z.boolean(),
  ocrDetectedAmount: z.number().nullable(),
  evidenceUrl: z.string().url().nullable(),
  rejectionReason: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type PagoResponseDto = z.infer<typeof zPagoResponse>;

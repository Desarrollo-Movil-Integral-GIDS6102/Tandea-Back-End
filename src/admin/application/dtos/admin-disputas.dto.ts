import { z } from 'zod';

const CAMPOS_MONTO_PROHIBIDOS = [
  'monto',
  'amount',
  'totalAmount',
  'total_amount',
  'transferAmount',
  'transfer_amount',
  'cashAmount',
  'cash_amount',
  'contributionAmount',
  'contribution_amount',
] as const;

export const zCrearDisputaDto = z
  .object({
    idTanda: z.coerce
      .number({ required_error: 'El campo "idTanda" es obligatorio' })
      .int('El idTanda debe ser un número entero')
      .positive('El idTanda debe ser positivo'),
    motivo: z.string().trim().max(500, 'El motivo no puede exceder 500 caracteres').optional(),
    reason: z.string().trim().max(500, 'El motivo no puede exceder 500 caracteres').optional(),
    idPayment: z.coerce
      .number()
      .int('El idPayment debe ser un número entero')
      .positive('El idPayment debe ser positivo')
      .optional(),
    idPayout: z.coerce
      .number()
      .int('El idPayout debe ser un número entero')
      .positive('El idPayout debe ser positivo')
      .optional(),
  })
  .superRefine((val, ctx) => {
    const texto = (val.motivo ?? val.reason)?.trim();
    if (!texto) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['motivo'],
        message: 'El motivo de la disputa es obligatorio',
      });
    }
  })
  .transform((val) => ({
    idTanda: val.idTanda,
    motivo: (val.motivo ?? val.reason)!.trim(),
    idPayment: val.idPayment,
    idPayout: val.idPayout,
  }));

export const zListarDisputasQuery = z.object({
  status: z.enum(['ABIERTA', 'EN_REVISION', 'RESUELTA', 'DESCARTADA']).optional(),
  idTanda: z.coerce
    .number()
    .int('El idTanda debe ser un número entero')
    .positive('El idTanda debe ser positivo')
    .optional(),
});

export const zResolverDisputaDto = z
  .object({
    accion: z.enum(['mantener', 'revertir', 'suspender'], {
      required_error: 'El campo "accion" es obligatorio (mantener | revertir | suspender)',
      invalid_type_error: 'La acción debe ser mantener, revertir o suspender',
    }),
    notas: z.string().trim().max(1000, 'Las notas no pueden exceder 1000 caracteres').optional(),
    notes: z.string().trim().max(1000, 'Las notas no pueden exceder 1000 caracteres').optional(),
    resolutionNotes: z
      .string()
      .trim()
      .max(1000, 'Las notas no pueden exceder 1000 caracteres')
      .optional(),
  })
  .passthrough()
  .superRefine((val, ctx) => {
    for (const campo of CAMPOS_MONTO_PROHIBIDOS) {
      if (campo in val && (val as Record<string, unknown>)[campo] !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [campo],
          message: 'Prohibido modificar montos directamente al resolver una disputa',
        });
      }
    }

    const texto = (val.notas ?? val.notes ?? val.resolutionNotes)?.trim();
    if (!texto) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['notas'],
        message: 'Las notas de resolución son obligatorias',
      });
    }
  })
  .transform((val) => ({
    accion: val.accion,
    notas: (val.notas ?? val.notes ?? val.resolutionNotes)!.trim(),
  }));

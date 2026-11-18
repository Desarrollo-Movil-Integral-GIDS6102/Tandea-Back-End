import { z } from 'zod';

const zBooleanoOpcional = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .optional()
  .transform((val) => {
    if (val === undefined) return undefined;
    if (typeof val === 'boolean') return val;
    return val === 'true';
  });

export const zBuscarUsuariosQuery = z
  .object({
    q: z.string().trim().max(150, 'La búsqueda no puede exceder 150 caracteres').optional(),
    search: z.string().trim().max(150, 'La búsqueda no puede exceder 150 caracteres').optional(),
    active: zBooleanoOpcional,
  })
  .transform(({ q, search, active }) => {
    const termino = (q ?? search)?.trim();
    return {
      q: termino && termino.length > 0 ? termino : undefined,
      active,
    };
  });

export const zSuspenderUsuarioDto = z
  .object({
    motivo: z.string().trim().max(500, 'El motivo no puede exceder 500 caracteres').optional(),
    reason: z.string().trim().max(500, 'El motivo no puede exceder 500 caracteres').optional(),
  })
  .transform(({ motivo, reason }) => {
    const texto = (motivo ?? reason)?.trim();
    return {
      motivo: texto && texto.length > 0 ? texto : undefined,
    };
  });

import { z } from 'zod';

/**
 * zRegisterDto — Esquema de validación con Zod para el registro de nuevos usuarios en Tandea.
 *
 * Reglas de negocio:
 *  - email: formato válido obligatorio.
 *  - password: longitud mínima de 8 caracteres.
 *  - name / lastName: cadenas obligatorias no vacías.
 *  - age: entero mayor o igual a 18 (opcional/nullable).
 *  - gender: texto opcional/nullable.
 */
export const zRegisterDto = z.object({
  email: z
    .string({ required_error: 'El correo electrónico es requerido' })
    .email('El formato del correo electrónico no es válido'),
  password: z
    .string({ required_error: 'La contraseña es requerida' })
    .min(8, 'La contraseña debe tener al menos 8 caracteres'),
  name: z.string({ required_error: 'El nombre es requerido' }).min(1, 'El nombre es requerido'),
  lastName: z.string({ required_error: 'El apellido es requerido' }).min(1, 'El apellido es requerido'),
  age: z
    .number()
    .int('La edad debe ser un número entero')
    .min(18, 'Debe ser mayor de edad para participar')
    .optional()
    .nullable(),
  gender: z.string().optional().nullable(),
});

export type RegisterDto = z.infer<typeof zRegisterDto>;

/**
 * zRegisterResponseDto — Esquema de validación para la respuesta de registro exitoso.
 * Incluye el token JWT generado y los datos seguros del usuario registrado.
 */
export const zRegisterResponseDto = z.object({
  access_token: z.string(),
  user: z.object({
    idUser: z.number(),
    email: z.string().email(),
    name: z.string(),
    lastName: z.string(),
    role: z.string(),
    age: z.number().optional().nullable(),
    gender: z.string().optional().nullable(),
  }),
});

export type RegisterResponseDto = z.infer<typeof zRegisterResponseDto>;


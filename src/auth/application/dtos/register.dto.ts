import { z } from 'zod';

export const zRegisterDto = z.object({
  email: z
    .string({ required_error: 'El correo electrónico es requerido' })
    .email('El formato del correo electrónico no es válido')
    .transform((val) => val.trim().toLowerCase()),
  password: z
    .string({ required_error: 'La contraseña es requerida' })
    .min(6, 'La contraseña debe contener al menos 6 caracteres'),
  name: z
    .string({ required_error: 'El nombre es requerido' })
    .min(1, 'El nombre no puede estar vacío')
    .transform((val) => val.trim()),
  lastName: z
    .string({ required_error: 'El apellido es requerido' })
    .min(1, 'El apellido no puede estar vacío')
    .transform((val) => val.trim()),
  age: z.coerce
    .number()
    .int('La edad debe ser un número entero')
    .positive('La edad debe ser mayor a 0')
    .optional()
    .nullable(),
  gender: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val ? val.trim() : null)),
});

export type RegisterDto = z.infer<typeof zRegisterDto>;

export const zRegisterResponseDto = z.object({
  access_token: z.string(),
  user: z.object({
    idUser: z.number(),
    email: z.string().email(),
    name: z.string(),
    lastName: z.string(),
    role: z.string(),
    age: z.number().nullable().optional(),
    gender: z.string().nullable().optional(),
  }),
});

export type RegisterResponseDto = z.infer<typeof zRegisterResponseDto>;

import { z } from 'zod';

export const zLoginDto = z.object({
  email: z
    .string({ required_error: 'El correo electrónico es requerido' })
    .email('El formato del correo electrónico no es válido'),
  password: z
    .string({ required_error: 'La contraseña es requerida' })
    .min(1, 'La contraseña no puede estar vacía'),
});

export type LoginDto = z.infer<typeof zLoginDto>;

export const zLoginResponseDto = z.object({
  access_token: z.string(),
  user: z.object({
    idUser: z.number(),
    email: z.string().email(),
    name: z.string(),
    lastName: z.string(),
    role: z.string(),
  }),
});

export type LoginResponseDto = z.infer<typeof zLoginResponseDto>;

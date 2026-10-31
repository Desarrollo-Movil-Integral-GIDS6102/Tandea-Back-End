import { z } from 'zod';

export const zActualizarPerfilDto = z
  .object({
    name: z
      .string({ invalid_type_error: 'El nombre debe ser texto' })
      .trim()
      .min(1, 'El nombre es requerido')
      .max(100, 'El nombre no puede exceder 100 caracteres')
      .optional(),
    lastName: z
      .string({ invalid_type_error: 'El apellido debe ser texto' })
      .trim()
      .min(1, 'El apellido es requerido')
      .max(100, 'El apellido no puede exceder 100 caracteres')
      .optional(),
    age: z
      .number({ invalid_type_error: 'La edad debe ser un número' })
      .int('La edad debe ser un número entero')
      .min(18, 'Debe ser mayor de edad para participar')
      .nullable()
      .optional(),
    gender: z
      .string({ invalid_type_error: 'El género debe ser texto' })
      .trim()
      .max(50, 'El género no puede exceder 50 caracteres')
      .nullable()
      .optional(),
  })
  .strict('Solo se pueden editar nombre, apellido, edad y género');

export const zCambiarPasswordDto = z.object({
  codigo: z
    .string({ required_error: 'El código es requerido' })
    .trim()
    .regex(/^\d{6}$/, 'El código debe tener 6 dígitos'),
  nuevaPassword: z
    .string({ required_error: 'La nueva contraseña es requerida' })
    .min(1, 'La nueva contraseña es requerida'),
});

const zCorreo = z
  .string({ required_error: 'El correo electrónico es requerido' })
  .trim()
  .email('El formato del correo electrónico no es válido');

export const zRecuperarPasswordDto = z.object({ email: zCorreo });

export const zRestablecerPasswordDto = zCambiarPasswordDto.extend({ email: zCorreo });

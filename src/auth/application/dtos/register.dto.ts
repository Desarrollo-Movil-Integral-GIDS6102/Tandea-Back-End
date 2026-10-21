import { z } from 'zod';
import {
  PASSWORD_MESSAGES,
  PASSWORD_MIN_LENGTH,
  validatePassword,
} from '../../domain/policies/password-policy';

export { PASSWORD_MIN_LENGTH };

/**
 * zRegisterDto — Esquema de validación con Zod para el registro de nuevos usuarios en Tandea.
 *
 * Reglas de negocio:
 *  - email: obligatorio, no vacío y con formato válido. Se recortan espacios
 *    laterales (trim); no se cambia mayúsculas/minúsculas para no alterar la
 *    política actual de unicidad de correo.
 *  - password: obligatoria y conforme a la política de dominio `validatePassword`
 *    (mín. 12 caracteres, máx. 72 bytes, sin patrones predecibles, comunes ni
 *    datos personales). No se recorta ni se exigen símbolos arbitrarios.
 *  - name / lastName: cadenas obligatorias; se rechazan vacías o solo espacios.
 *  - age: entero mayor o igual a 18 (opcional/nullable).
 *  - gender: texto opcional/nullable.
 */
const requiredTrimmedString = (requiredMsg: string, typeMsg: string) =>
  z
    .string({ required_error: requiredMsg, invalid_type_error: typeMsg })
    .trim()
    .min(1, requiredMsg);

export const zRegisterDto = z
  .object({
    email: z
      .string({
        required_error: 'El correo electrónico es requerido',
        invalid_type_error: 'El correo electrónico debe ser texto',
      })
      .trim()
      .min(1, 'El correo electrónico es requerido')
      .email('El formato del correo electrónico no es válido'),
    password: z
      .string({
        required_error: 'La contraseña es requerida',
        invalid_type_error: 'La contraseña debe ser texto',
      })
      .min(1, 'La contraseña es requerida')
      .superRefine((password, ctx) => {
        for (const message of validatePassword(password)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message });
        }
      }),
    name: requiredTrimmedString(
      'El nombre es requerido',
      'El nombre debe ser texto',
    ),
    lastName: requiredTrimmedString(
      'El apellido es requerido',
      'El apellido debe ser texto',
    ),
    age: z
      .number({ invalid_type_error: 'La edad debe ser un número' })
      .int('La edad debe ser un número entero')
      .min(18, 'Debe ser mayor de edad para participar')
      .optional()
      .nullable(),
    gender: z
      .string({ invalid_type_error: 'El género debe ser texto' })
      .optional()
      .nullable(),
  })
  .superRefine((dto, ctx) => {
    // Regla contextual: la contraseña no debe contener datos personales del usuario.
    const errors = validatePassword(dto.password, dto);
    if (errors.includes(PASSWORD_MESSAGES.personalInfo)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['password'],
        message: PASSWORD_MESSAGES.personalInfo,
      });
    }
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

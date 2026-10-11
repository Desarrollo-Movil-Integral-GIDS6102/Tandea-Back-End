import {
  IsEmail,
  MinLength,
  IsString,
  IsOptional,
  IsInt,
  Min,
} from 'class-validator';

/**
 * RegisterDto — DTO de validación para registro de nuevos usuarios en Tandea.
 *
 * Reglas de negocio:
 *  - email: formato válido obligatorio (@IsEmail).
 *  - password: texto con longitud mínima de 8 caracteres (@MinLength(8)).
 *  - name / lastName / age / gender: datos opcionales para complementar el perfil.
 */
export class RegisterDto {
  @IsEmail({}, { message: 'El formato del correo electrónico no es válido' })
  email: string;

  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  password: string;

  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsOptional()
  name?: string;

  @IsString({ message: 'El apellido debe ser una cadena de texto' })
  @IsOptional()
  lastName?: string;

  @IsInt({ message: 'La edad debe ser un número entero' })
  @Min(18, { message: 'Debe ser mayor de edad para participar' })
  @IsOptional()
  age?: number;

  @IsString({ message: 'El género debe ser una cadena de texto' })
  @IsOptional()
  gender?: string;
}

/**
 * RegisterResponseDto — Respuesta segura tras el registro exitoso.
 * IMPORTANTE: NUNCA debe incluir password_hash ni información sensible.
 */
export interface RegisterResponseDto {
  idUser: number;
  email: string;
  name: string;
  lastName: string;
  role: string;
  active: boolean;
  age?: number | null;
  gender?: string | null;
}

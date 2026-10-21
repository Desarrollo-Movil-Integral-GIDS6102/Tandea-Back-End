/**
 * PasswordPolicy — Política de contraseñas seguras de Tandea (dominio puro, sin dependencias).
 *
 * Inspirada en NIST SP 800-63B: prioriza longitud e imprevisibilidad en lugar de
 * exigir combinaciones arbitrarias de símbolos. Se favorecen frases de contraseña.
 *
 * Reglas:
 *  - Longitud mínima de 12 caracteres.
 *  - Máximo de 72 bytes UTF-8 (límite real de bcrypt; lo excedente se ignoraría al hashear).
 *  - No puede estar formada solo por números.
 *  - Sin patrones repetitivos (pocos caracteres distintos, bloques repetidos, 4+ caracteres iguales seguidos).
 *  - Sin secuencias consecutivas de 4+ dígitos o letras (ascendentes o descendentes) ni patrones de teclado.
 *  - No puede ser (ni basarse en) una contraseña común o comprometida conocida.
 *  - No puede contener el nombre, apellido o la parte local del correo del usuario.
 */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_BYTES = 72;

const SEQUENCE_RUN = 4;
const MIN_UNIQUE_CHARS = 5;

export const PASSWORD_MESSAGES = {
  tooShort: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`,
  tooLong: `La contraseña no debe exceder ${PASSWORD_MAX_BYTES} bytes`,
  onlyDigits: 'La contraseña no puede estar formada solo por números',
  repetitive: 'La contraseña contiene patrones repetitivos',
  sequential:
    'La contraseña contiene secuencias predecibles (p. ej. 1234, abcd o qwerty)',
  common: 'La contraseña es demasiado común o ha sido comprometida',
  personalInfo:
    'La contraseña no debe contener tu nombre, apellido o correo electrónico',
} as const;

/** Lista reducida de contraseñas/bases más comunes en filtraciones públicas. */
const COMMON_PASSWORDS = new Set([
  'password',
  'passw0rd',
  'contrasena',
  'contraseña',
  'clave',
  'qwerty',
  'qwertyuiop',
  'iloveyou',
  'teamo',
  'admin',
  'administrator',
  'administrador',
  'welcome',
  'bienvenido',
  'letmein',
  'monkey',
  'dragon',
  'football',
  'futbol',
  'baseball',
  'master',
  'shadow',
  'sunshine',
  'princess',
  'superman',
  'batman',
  'trustno1',
  'starwars',
  'pokemon',
  'login',
  'usuario',
  'user',
  'test',
  'tandea',
  'secret',
  'secreto',
  'changeme',
  'default',
  'root',
  'toor',
  'mexico',
  'america',
  'hola',
  'holamundo',
  'helloworld',
  'abc',
  'abcd',
  'abcdef',
  'asdf',
  'asdfgh',
  'zxcvbn',
  'qazwsx',
  'michael',
  'jordan',
  'charlie',
  'jesus',
  'cristo',
  'dios',
  'amor',
  'familia',
  'computer',
  'internet',
  'samsung',
  'google',
  'facebook',
  'whatever',
  'freedom',
  'flower',
  'hunter',
  'killer',
]);

const KEYBOARD_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1234567890'];
const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
  '!': 'i',
};

export interface PasswordContext {
  email?: string | null;
  name?: string | null;
  lastName?: string | null;
}

const byteLength = (s: string): number => new TextEncoder().encode(s).length;

const deLeet = (s: string): string =>
  s.replace(/[013457@$!]/g, (c) => LEET[c] ?? c);

function hasSequence(lower: string): boolean {
  let asc = 1;
  let desc = 1;
  for (let i = 1; i < lower.length; i++) {
    const prev = lower.charCodeAt(i - 1);
    const cur = lower.charCodeAt(i);
    const sameClass =
      (/[a-z]/.test(lower[i]) && /[a-z]/.test(lower[i - 1])) ||
      (/\d/.test(lower[i]) && /\d/.test(lower[i - 1]));
    asc = sameClass && cur - prev === 1 ? asc + 1 : 1;
    desc = sameClass && prev - cur === 1 ? desc + 1 : 1;
    if (asc >= SEQUENCE_RUN || desc >= SEQUENCE_RUN) return true;
  }
  for (const row of KEYBOARD_ROWS) {
    const rev = row.split('').reverse().join('');
    for (let i = 0; i + SEQUENCE_RUN <= row.length; i++) {
      if (
        lower.includes(row.slice(i, i + SEQUENCE_RUN)) ||
        lower.includes(rev.slice(i, i + SEQUENCE_RUN))
      ) {
        return true;
      }
    }
  }
  return false;
}

function isRepetitive(lower: string): boolean {
  if (new Set(lower).size < MIN_UNIQUE_CHARS) return true;
  if (/(.)\1{3,}/u.test(lower)) return true;
  return /^(.+?)\1+$/su.test(lower);
}

function isCommon(lower: string): boolean {
  if (COMMON_PASSWORDS.has(lower)) return true;
  // Base alfabética: "Password123!" -> "password"; "P@ssw0rd2024" -> "password".
  const lettersOnly = deLeet(lower).replace(/[^a-zñ]/g, '');
  const stripped = lower.replace(/^[^a-zñ]+|[^a-zñ]+$/g, '');
  return (
    COMMON_PASSWORDS.has(lettersOnly) ||
    COMMON_PASSWORDS.has(stripped) ||
    COMMON_PASSWORDS.has(deLeet(stripped))
  );
}

function containsPersonalInfo(lower: string, ctx: PasswordContext): boolean {
  const tokens = [ctx.email?.split('@')[0], ctx.name, ctx.lastName]
    .flatMap((v) => (v ?? '').toLowerCase().split(/[\s._\-+]+/))
    .filter((t) => t.length >= 4);
  return tokens.some((t) => lower.includes(t));
}

/**
 * Evalúa una contraseña y devuelve la lista de mensajes de las reglas incumplidas
 * (vacía si es válida). Nunca incluye la contraseña en los mensajes.
 */
export function validatePassword(
  password: string,
  ctx: PasswordContext = {},
): string[] {
  const errors: string[] = [];
  const lower = password.toLowerCase();

  if (password.length < PASSWORD_MIN_LENGTH)
    errors.push(PASSWORD_MESSAGES.tooShort);
  if (byteLength(password) > PASSWORD_MAX_BYTES)
    errors.push(PASSWORD_MESSAGES.tooLong);
  if (/^\d+$/.test(password)) errors.push(PASSWORD_MESSAGES.onlyDigits);
  if (isRepetitive(lower)) errors.push(PASSWORD_MESSAGES.repetitive);
  if (hasSequence(lower)) errors.push(PASSWORD_MESSAGES.sequential);
  if (isCommon(lower)) errors.push(PASSWORD_MESSAGES.common);
  if (containsPersonalInfo(lower, ctx))
    errors.push(PASSWORD_MESSAGES.personalInfo);

  return errors;
}

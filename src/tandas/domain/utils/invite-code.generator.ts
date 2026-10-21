import * as crypto from 'crypto';

export class InviteCodeGenerator {
  // Caracteres seguros y legibles sin confusión visual
  private static readonly CHARACTERS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

  /**
   * Genera un código legible con prefijo TND (ej. TND-7K9A2B)
   */
  static generate(length: number = 6): string {
    const bytes = crypto.randomBytes(length);
    let result = '';
    for (let i = 0; i < length; i++) {
      result += this.CHARACTERS[bytes[i] % this.CHARACTERS.length];
    }
    return `TND-${result}`;
  }
}

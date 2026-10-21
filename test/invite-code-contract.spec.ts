import { describe, it, expect } from 'vitest';
import { zJoinTanda } from '../src/tandas/application/dtos/join-tanda.dto';
import { InviteCodeGenerator } from '../src/tandas/domain/utils/invite-code.generator';

describe('[AP-02] Contrato del Código de Invitación de Tandas (Backend)', () => {
  describe('Generador de Códigos (InviteCodeGenerator)', () => {
    it('debe generar códigos con prefijo TND-, longitud de 10 caracteres y formato TND-XXXXXX', () => {
      const code = InviteCodeGenerator.generate();

      expect(code).toBeDefined();
      expect(code).toHaveLength(10);
      expect(code.startsWith('TND-')).toBe(true);
      expect(code).toMatch(/^TND-[2-9A-HJ-NP-Z]{6}$/);
    });

    it('debe generar códigos únicos y aleatorios', () => {
      const generated = new Set<string>();
      for (let i = 0; i < 50; i++) {
        generated.add(InviteCodeGenerator.generate());
      }
      expect(generated.size).toBe(50);
    });
  });

  describe('Esquema de Validación de Entrada (zJoinTanda)', () => {
    it('debe aceptar y normalizar códigos válidos de 10 caracteres generados por el backend', () => {
      const backendCode = InviteCodeGenerator.generate();
      const result = zJoinTanda.parse({ inviteCode: backendCode });

      expect(result.inviteCode).toBe(backendCode);
      expect(result.inviteCode).toHaveLength(10);
    });

    it('debe aceptar códigos válidos de 8 caracteres (compatibilidad AP-02)', () => {
      const code8 = 'TND-7K9A';
      expect(code8).toHaveLength(8);

      const result = zJoinTanda.parse({ inviteCode: code8 });
      expect(result.inviteCode).toBe('TND-7K9A');
    });

    it('debe aceptar códigos válidos de 9 caracteres (compatibilidad AP-02)', () => {
      const code9 = 'TND-VRN01';
      expect(code9).toHaveLength(9);

      const result = zJoinTanda.parse({ inviteCode: code9 });
      expect(result.inviteCode).toBe('TND-VRN01');
    });

    it('debe aceptar códigos válidos de 10 caracteres', () => {
      const code10 = 'TND-9X4K2P';
      expect(code10).toHaveLength(10);

      const result = zJoinTanda.parse({ inviteCode: code10 });
      expect(result.inviteCode).toBe('TND-9X4K2P');
    });

    it('debe sanitizar espacios laterales (trim) y convertir a mayúsculas automáticamente', () => {
      const rawCode = '   tnd-9x4k2p   ';
      const result = zJoinTanda.parse({ inviteCode: rawCode });

      expect(result.inviteCode).toBe('TND-9X4K2P');
      expect(result.inviteCode).toHaveLength(10);
    });

    it('debe rechazar códigos con menos de 3 caracteres', () => {
      const parsed = zJoinTanda.safeParse({ inviteCode: 'AB' });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0].message).toBe(
          'El código de invitación debe tener al menos 3 caracteres',
        );
      }
    });

    it('debe rechazar códigos que excedan los 20 caracteres', () => {
      const tooLong = 'TND-123456789012345678'; // 22 caracteres
      expect(tooLong.length).toBeGreaterThan(20);

      const parsed = zJoinTanda.safeParse({ inviteCode: tooLong });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0].message).toBe(
          'El código de invitación no puede exceder 20 caracteres',
        );
      }
    });

    it('debe rechazar peticiones sin inviteCode', () => {
      const parsed = zJoinTanda.safeParse({});
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0].message).toBe(
          'El campo "inviteCode" (código de invitación) es obligatorio',
        );
      }
    });

    it('debe rechazar inviteCode con tipo de dato no string', () => {
      const parsed = zJoinTanda.safeParse({ inviteCode: 1234567890 });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0].message).toBe(
          'El campo "inviteCode" debe ser una cadena de texto',
        );
      }
    });
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encryptApiKey, decryptApiKey, isEncrypted } from '../server/db/encryption';

describe('encryption (AES-GCM 256)', () => {
  const originalSecret = process.env.AI_KEY_ENCRYPTION_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.AI_KEY_ENCRYPTION_SECRET;
    else process.env.AI_KEY_ENCRYPTION_SECRET = originalSecret;
  });

  describe('com master key (hex 64 chars)', () => {
    beforeEach(() => {
      process.env.AI_KEY_ENCRYPTION_SECRET =
        'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
    });

    it('round-trip preserva texto original', () => {
      const original = 'sk-ant-api-very-secret-key-12345';
      const enc = encryptApiKey(original);
      const dec = decryptApiKey(enc);
      expect(dec).toBe(original);
    });

    it('produz payloads diferentes a cada chamada (IV aleatório)', () => {
      const enc1 = encryptApiKey('mesma chave');
      const enc2 = encryptApiKey('mesma chave');
      expect(enc1).not.toBe(enc2);
      expect(decryptApiKey(enc1)).toBe('mesma chave');
      expect(decryptApiKey(enc2)).toBe('mesma chave');
    });

    it('payload tem 3 partes (iv.cipher.tag) em base64', () => {
      const enc = encryptApiKey('teste');
      const parts = enc.split('.');
      expect(parts).toHaveLength(3);
      expect(() => Buffer.from(parts[0], 'base64')).not.toThrow();
    });

    it('lança erro com payload corrompido', () => {
      const enc = encryptApiKey('teste');
      const corrupted = enc.slice(0, -5) + 'xxxxx';
      expect(() => decryptApiKey(corrupted)).toThrow();
    });

    it('lança erro com formato inválido', () => {
      expect(() => decryptApiKey('apenas-uma-string-sem-formato')).toThrow();
    });
  });

  describe('com secret string qualquer (deriva via SHA-256)', () => {
    beforeEach(() => {
      process.env.AI_KEY_ENCRYPTION_SECRET = 'minha-frase-secreta-qualquer';
    });

    it('round-trip funciona com derivação SHA-256', () => {
      const original = 'sk-test-deriv';
      const enc = encryptApiKey(original);
      expect(decryptApiKey(enc)).toBe(original);
    });
  });

  describe('sem master key (modo dev)', () => {
    beforeEach(() => {
      delete process.env.AI_KEY_ENCRYPTION_SECRET;
    });

    it('usa prefixo dev: e base64 (não criptografa)', () => {
      const enc = encryptApiKey('chave-em-dev');
      expect(enc.startsWith('dev:')).toBe(true);
      expect(decryptApiKey(enc)).toBe('chave-em-dev');
    });

    it('lança ao tentar descriptografar payload AES sem master key', () => {
      // simulando payload criptografado vindo do DB sem ter a key
      expect(() => decryptApiKey('aGVsbG8=.d29ybGQ=.dGFn')).toThrow(
        /AI_KEY_ENCRYPTION_SECRET/,
      );
    });
  });

  describe('isEncrypted', () => {
    it('detecta payload AES-GCM', () => {
      process.env.AI_KEY_ENCRYPTION_SECRET =
        'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
      const enc = encryptApiKey('teste');
      expect(isEncrypted(enc)).toBe(true);
    });

    it('detecta payload dev:', () => {
      delete process.env.AI_KEY_ENCRYPTION_SECRET;
      const enc = encryptApiKey('teste');
      expect(isEncrypted(enc)).toBe(true);
    });

    it('rejeita texto puro', () => {
      expect(isEncrypted('texto qualquer')).toBe(false);
      expect(isEncrypted('')).toBe(false);
    });
  });

  it('texto vazio retorna vazio', () => {
    expect(encryptApiKey('')).toBe('');
    expect(decryptApiKey('')).toBe('');
  });
});

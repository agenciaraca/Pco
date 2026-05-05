import { describe, it, expect } from 'vitest';
import {
  generateSecret,
  generateBackupCodes,
  hashBackupCode,
  buildOtpauthUri,
  verifyTotp,
  generateCurrentCode,
} from '../server/auth/totp';

describe('TOTP (RFC 6238)', () => {
  it('generateSecret produz string base32 válida >= 16 chars', () => {
    const s = generateSecret();
    expect(s.length).toBeGreaterThanOrEqual(16);
    expect(/^[A-Z2-7]+$/.test(s)).toBe(true);
  });

  it('round-trip: gera código e verifica com sucesso', () => {
    const secret = generateSecret();
    const code = generateCurrentCode(secret);
    expect(code).toMatch(/^\d{6}$/);
    expect(verifyTotp(secret, code)).toBe(true);
  });

  it('aceita código com janela de tolerância (1 step)', () => {
    const secret = generateSecret();
    const now = 1_700_000_000_000;
    const PREV_STEP = now - 30 * 1000;
    const codePrev = generateCurrentCode(secret, PREV_STEP);
    expect(verifyTotp(secret, codePrev, now)).toBe(true);
  });

  it('rejeita código muito antigo (>1 step de drift)', () => {
    const secret = generateSecret();
    const now = 1_700_000_000_000;
    const codeOld = generateCurrentCode(secret, now - 90 * 1000);
    expect(verifyTotp(secret, codeOld, now)).toBe(false);
  });

  it('rejeita código com formato inválido', () => {
    const secret = generateSecret();
    expect(verifyTotp(secret, 'abc')).toBe(false);
    expect(verifyTotp(secret, '12345')).toBe(false);
    expect(verifyTotp(secret, '1234567')).toBe(false);
  });

  it('gera 10 backup codes únicos no formato XXXX-XXXX', () => {
    const codes = generateBackupCodes(10);
    expect(codes).toHaveLength(10);
    for (const c of codes) expect(c).toMatch(/^[A-Z2-7]{4}-[A-Z2-7]{4}$/);
    expect(new Set(codes).size).toBe(10);
  });

  it('hashBackupCode é determinístico e ignora case/espaços', () => {
    const a = hashBackupCode('ABCD-1234');
    const b = hashBackupCode(' abcd-1234 ');
    expect(a).toBe(b);
    expect(a).toHaveLength(64); // sha256 hex
  });

  it('buildOtpauthUri inclui issuer + secret + parâmetros', () => {
    const uri = buildOtpauthUri({
      secret: 'JBSWY3DPEHPK3PXP',
      accountName: 'aluno@example.com',
      issuer: 'AVA PCO',
    });
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain('secret=JBSWY3DPEHPK3PXP');
    expect(uri).toContain('issuer=AVA+PCO');
    expect(uri).toContain('digits=6');
    expect(uri).toContain('period=30');
  });
});

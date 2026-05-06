import { describe, it, expect, beforeEach } from 'vitest';
import {
  createResetToken,
  consumeResetToken,
  peekResetToken,
} from '../server/auth/password-reset';

describe('auth/password-reset', () => {
  beforeEach(() => {
    // o módulo usa Map em memória; criar token novo invalida do mesmo userId
  });

  it('createResetToken gera token base64url + expira em 30min', () => {
    const t = createResetToken('u1', 'a@b.com');
    expect(t.token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(t.expiresAt - t.createdAt).toBe(30 * 60 * 1000);
    expect(t.used).toBe(false);
    expect(t.userId).toBe('u1');
  });

  it('peekResetToken retorna sem marcar como used', () => {
    const t = createResetToken('u-peek', 'p@x.com');
    const p = peekResetToken(t.token);
    expect(p).not.toBeNull();
    expect(p!.used).toBe(false);
    // peek de novo continua válido
    expect(peekResetToken(t.token)).not.toBeNull();
  });

  it('consumeResetToken marca como used (single-use)', () => {
    const t = createResetToken('u-once', 'o@x.com');
    const first = consumeResetToken(t.token);
    expect(first).not.toBeNull();
    expect(first!.used).toBe(true);
    // segunda vez retorna null
    expect(consumeResetToken(t.token)).toBeNull();
  });

  it('consumeResetToken inexistente retorna null', () => {
    expect(consumeResetToken('nao-existe-token')).toBeNull();
  });

  it('novo token p/ mesmo user invalida o anterior', () => {
    const a = createResetToken('u-rotate', 'r@x.com');
    const b = createResetToken('u-rotate', 'r@x.com');
    expect(a.token).not.toBe(b.token);
    // antigo invalidado
    expect(peekResetToken(a.token)).toBeNull();
    expect(consumeResetToken(a.token)).toBeNull();
    // novo continua válido
    expect(peekResetToken(b.token)).not.toBeNull();
  });

  it('peek de token usado retorna null', () => {
    const t = createResetToken('u-used', 'u@x.com');
    consumeResetToken(t.token);
    expect(peekResetToken(t.token)).toBeNull();
  });

  it('tokens diferentes pra users diferentes coexistem', () => {
    const a = createResetToken('user-A', 'a@x.com');
    const b = createResetToken('user-B', 'b@x.com');
    expect(peekResetToken(a.token)).not.toBeNull();
    expect(peekResetToken(b.token)).not.toBeNull();
    expect(a.token).not.toBe(b.token);
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { __testInternals__ } from '../server/auth/api-token-middleware';

describe('api-token rate limit', () => {
  beforeEach(() => {
    __testInternals__.reset();
  });

  it('permite até max requests', () => {
    for (let i = 0; i < 5; i++) {
      const r = __testInternals__.check('token-1', 5);
      expect(r.allowed).toBe(true);
      expect(r.remaining).toBe(5 - (i + 1));
    }
  });

  it('bloqueia request acima do limite', () => {
    for (let i = 0; i < 3; i++) {
      __testInternals__.check('token-1', 3);
    }
    const blocked = __testInternals__.check('token-1', 3);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetMs).toBeGreaterThan(0);
  });

  it('isola buckets por tokenId', () => {
    for (let i = 0; i < 3; i++) {
      __testInternals__.check('token-A', 3);
    }
    // token-A bloqueado, token-B ainda livre
    expect(__testInternals__.check('token-A', 3).allowed).toBe(false);
    expect(__testInternals__.check('token-B', 3).allowed).toBe(true);
  });

  it('reset esvazia todos buckets', () => {
    __testInternals__.check('token-X', 3);
    __testInternals__.check('token-X', 3);
    __testInternals__.reset();
    const r = __testInternals__.check('token-X', 3);
    expect(r.remaining).toBe(2); // contador zerou
  });

  it('window é 60_000ms (60s)', () => {
    expect(__testInternals__.windowMs).toBe(60_000);
  });
});

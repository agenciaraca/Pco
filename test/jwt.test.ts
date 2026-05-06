import { describe, it, expect, beforeAll } from 'vitest';

let signToken: typeof import('../server/auth/jwt').signToken;
let verifyToken: typeof import('../server/auth/jwt').verifyToken;

beforeAll(async () => {
  process.env.JWT_SECRET = 'a'.repeat(48);
  process.env.NODE_ENV = 'test';
  const mod = await import('../server/auth/jwt');
  signToken = mod.signToken;
  verifyToken = mod.verifyToken;
});

describe('auth/jwt', () => {
  it('signToken produz JWT estruturado (3 segments)', async () => {
    const t = await signToken({
      sub: 'u1',
      email: 'a@b.com',
      role: 'admin',
      tv: 1,
    });
    expect(t.split('.')).toHaveLength(3);
  });

  it('verifyToken devolve payload original', async () => {
    const t = await signToken({
      sub: 'u-x',
      email: 'x@y.com',
      role: 'student',
      tv: 5,
    });
    const p = await verifyToken(t);
    expect(p).not.toBeNull();
    expect(p!.sub).toBe('u-x');
    expect(p!.email).toBe('x@y.com');
    expect(p!.role).toBe('student');
    expect(p!.tv).toBe(5);
    expect(p!.iat).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
    expect(p!.exp).toBeGreaterThan(p!.iat);
  });

  it('TTL default é 7 dias', async () => {
    const t = await signToken({
      sub: 'u',
      email: 'a@b.com',
      role: 'student',
      tv: 0,
    });
    const p = await verifyToken(t);
    expect(p!.exp - p!.iat).toBe(60 * 60 * 24 * 7);
  });

  it('TTL custom é respeitado', async () => {
    const t = await signToken(
      { sub: 'u', email: 'a@b.com', role: 'student', tv: 0 },
      120,
    );
    const p = await verifyToken(t);
    expect(p!.exp - p!.iat).toBe(120);
  });

  it('verifyToken rejeita token expirado', async () => {
    const t = await signToken(
      { sub: 'u', email: 'a@b.com', role: 'student', tv: 0 },
      -10, // emite já expirado
    );
    expect(await verifyToken(t)).toBeNull();
  });

  it('verifyToken rejeita assinatura adulterada', async () => {
    const t = await signToken({
      sub: 'u',
      email: 'a@b.com',
      role: 'student',
      tv: 0,
    });
    const tampered = t.slice(0, -3) + 'XXX';
    expect(await verifyToken(tampered)).toBeNull();
  });

  it('verifyToken rejeita lixo', async () => {
    expect(await verifyToken('nao.eh.jwt')).toBeNull();
    expect(await verifyToken('')).toBeNull();
    expect(await verifyToken('aaa')).toBeNull();
  });

  it('payload extra é preservado', async () => {
    const t = await signToken({
      sub: 'u',
      email: 'a@b.com',
      role: 'admin',
      tv: 0,
      extra: 'campo-x',
    });
    const p = (await verifyToken(t)) as unknown as Record<string, unknown>;
    expect(p!.extra).toBe('campo-x');
  });
});

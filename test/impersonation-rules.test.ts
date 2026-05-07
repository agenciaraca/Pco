import { describe, it, expect } from 'vitest';
import {
  canImpersonate,
  isActionBlockedDuringImpersonation,
  effectiveActorId,
  impersonationAuditMeta,
  BLOCKED_ACTIONS_DURING_IMPERSONATION,
} from '../server/auth/impersonation';
import type { JwtPayload } from '../server/auth/jwt';

describe('canImpersonate edge cases', () => {
  it('admin → admin é rejeitado (só student)', () => {
    const r = canImpersonate({ role: 'admin' }, { role: 'admin' }, false);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/aluno/i);
  });

  it('student → student rejeitado', () => {
    const r = canImpersonate({ role: 'student' }, { role: 'student' }, false);
    expect(r.ok).toBe(false);
  });

  it('superadmin → superadmin rejeitado', () => {
    const r = canImpersonate({ role: 'superadmin' }, { role: 'superadmin' }, false);
    expect(r.ok).toBe(false);
  });

  it('actor já impersonando bloqueia novo start', () => {
    const r = canImpersonate({ role: 'admin' }, { role: 'student' }, true);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/já está/i);
  });
});

describe('isActionBlockedDuringImpersonation', () => {
  it('reconhece todas as 10 ações bloqueadas', () => {
    for (const action of BLOCKED_ACTIONS_DURING_IMPERSONATION) {
      expect(isActionBlockedDuringImpersonation(action)).toBe(true);
    }
  });

  it('ações desconhecidas não bloqueiam', () => {
    expect(isActionBlockedDuringImpersonation('user.read')).toBe(false);
    expect(isActionBlockedDuringImpersonation('random.action')).toBe(false);
    expect(isActionBlockedDuringImpersonation('')).toBe(false);
  });

  it('case sensitive (must be exact match)', () => {
    expect(isActionBlockedDuringImpersonation('USER.DELETE')).toBe(false);
    expect(isActionBlockedDuringImpersonation('user.Delete')).toBe(false);
  });

  it('lista de ações bloqueadas tem itens esperados', () => {
    const set = new Set(BLOCKED_ACTIONS_DURING_IMPERSONATION as readonly string[]);
    expect(set.has('user.delete')).toBe(true);
    expect(set.has('user.password.change')).toBe(true);
    expect(set.has('order.refund')).toBe(true);
    expect(set.has('apiToken.create')).toBe(true);
    expect(set.has('lgpd.deletion.confirm')).toBe(true);
  });
});

describe('effectiveActorId', () => {
  function payload(act?: { sub: string; email: string; role: 'admin' | 'superadmin' }): JwtPayload {
    return {
      sub: 'student-target',
      email: 't@x.com',
      role: 'student',
      tv: 0,
      iat: 0,
      exp: 0,
      ...(act ? { act } : {}),
    };
  }

  it('sem act: retorna sub direto', () => {
    expect(effectiveActorId(payload())).toBe('student-target');
  });

  it('com act: retorna act.sub (admin original)', () => {
    expect(
      effectiveActorId(
        payload({ sub: 'admin-1', email: 'admin@x.com', role: 'admin' }),
      ),
    ).toBe('admin-1');
  });
});

describe('impersonationAuditMeta', () => {
  it('sem act: retorna undefined', () => {
    const m = impersonationAuditMeta({
      sub: 's',
      email: 'e',
      role: 'student',
      tv: 0,
      iat: 0,
      exp: 0,
    });
    expect(m).toBeUndefined();
  });

  it('com act: retorna meta com flag + alvo', () => {
    const m = impersonationAuditMeta({
      sub: 'student-1',
      email: 'student@x.com',
      role: 'student',
      tv: 0,
      iat: 0,
      exp: 0,
      act: { sub: 'admin-1', email: 'admin@x.com', role: 'admin' },
    });
    expect(m).toEqual({
      impersonating: true,
      impersonatedUserId: 'student-1',
      impersonatedEmail: 'student@x.com',
    });
  });
});

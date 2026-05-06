import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let imp: typeof import('../server/auth/impersonation');
let users: typeof import('../server/auth/users-store');
let jwt: typeof import('../server/auth/jwt');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-imp-'));
  process.env.DATA_DIR = tmpDir;
  process.env.JWT_SECRET = 'a'.repeat(48);
  process.env.AVA_ENCRYPTION_KEY = 'a'.repeat(64);
  process.env.INITIAL_SUPERADMIN_PASSWORD = 'sa-pwd';
  process.env.INITIAL_ADMIN_PASSWORD = 'a-pwd';
  process.env.INITIAL_STUDENT_PASSWORD = 's-pwd';

  imp = await import('../server/auth/impersonation');
  users = await import('../server/auth/users-store');
  jwt = await import('../server/auth/jwt');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

async function getUser(role: 'student' | 'admin' | 'superadmin') {
  const list = await users.listUsers();
  return list.find((u) => u.role === role)!;
}

describe('auth/impersonation', () => {
  describe('canImpersonate', () => {
    it('admin → student permitido', () => {
      const r = imp.canImpersonate({ role: 'admin' }, { role: 'student' }, false);
      expect(r.ok).toBe(true);
    });

    it('superadmin → student permitido', () => {
      const r = imp.canImpersonate(
        { role: 'superadmin' },
        { role: 'student' },
        false,
      );
      expect(r.ok).toBe(true);
    });

    it('student → student rejeitado', () => {
      const r = imp.canImpersonate({ role: 'student' }, { role: 'student' }, false);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toContain('admin');
    });

    it('admin → admin rejeitado', () => {
      const r = imp.canImpersonate({ role: 'admin' }, { role: 'admin' }, false);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toContain('aluno');
    });

    it('admin → superadmin rejeitado', () => {
      const r = imp.canImpersonate(
        { role: 'admin' },
        { role: 'superadmin' },
        false,
      );
      expect(r.ok).toBe(false);
    });

    it('actor já impersonando rejeita encadeamento', () => {
      const r = imp.canImpersonate({ role: 'admin' }, { role: 'student' }, true);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toContain('já está visualizando');
    });
  });

  describe('startImpersonation', () => {
    it('gera token com claim act + TTL curto', async () => {
      const admin = await getUser('admin');
      const student = await getUser('student');
      const r = await imp.startImpersonation(admin, student.id);
      expect(r).not.toBeNull();
      expect(r!.token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
      expect(r!.target.id).toBe(student.id);
      expect(r!.actor.id).toBe(admin.id);
      expect(r!.expiresInSeconds).toBe(imp.IMPERSONATION_TTL_SECONDS);

      const decoded = await jwt.verifyToken(r!.token);
      expect(decoded).not.toBeNull();
      expect(decoded!.sub).toBe(student.id);
      expect(decoded!.act).toBeDefined();
      expect(decoded!.act!.sub).toBe(admin.id);
      expect(decoded!.act!.role).toBe('admin');
      // TTL aproximado 30 min
      const ttl = decoded!.exp - decoded!.iat;
      expect(ttl).toBe(1800);
    });

    it('retorna null pra target inexistente', async () => {
      const admin = await getUser('admin');
      const r = await imp.startImpersonation(admin, 'nao-existe');
      expect(r).toBeNull();
    });

    it('retorna null pra target inactive', async () => {
      const admin = await getUser('admin');
      const u = await users.createUser({
        email: 'imp-inactive@x.com',
        name: 'Inact',
        role: 'student',
        password: 'p',
      });
      await users.updateUser(u.id, { active: false });
      const r = await imp.startImpersonation(admin, u.id);
      expect(r).toBeNull();
    });
  });

  describe('exitImpersonation', () => {
    it('gera token novo do actor original', async () => {
      const admin = await getUser('admin');
      const student = await getUser('student');
      const r = await imp.startImpersonation(admin, student.id);
      const decoded = await jwt.verifyToken(r!.token);
      const exitToken = await imp.exitImpersonation(decoded!);
      expect(exitToken).not.toBeNull();
      const exitDecoded = await jwt.verifyToken(exitToken!);
      expect(exitDecoded!.sub).toBe(admin.id);
      expect(exitDecoded!.role).toBe('admin');
      expect(exitDecoded!.act).toBeUndefined();
    });

    it('retorna null se payload não tem act', async () => {
      const admin = await getUser('admin');
      const tok = await jwt.signToken({
        sub: admin.id,
        email: admin.email,
        role: admin.role,
        tv: admin.tokenVersion,
      });
      const decoded = await jwt.verifyToken(tok);
      expect(await imp.exitImpersonation(decoded!)).toBeNull();
    });
  });

  describe('effectiveActorId', () => {
    it('sem impersonation, retorna sub', () => {
      const id = imp.effectiveActorId({
        sub: 'u-1',
        email: 'a@b.com',
        role: 'admin',
        tv: 0,
        iat: 0,
        exp: 0,
      });
      expect(id).toBe('u-1');
    });

    it('com impersonation, retorna act.sub', () => {
      const id = imp.effectiveActorId({
        sub: 'student-1',
        email: 'st@x.com',
        role: 'student',
        tv: 0,
        iat: 0,
        exp: 0,
        act: { sub: 'admin-1', email: 'admin@x.com', role: 'admin' },
      });
      expect(id).toBe('admin-1');
    });
  });

  describe('impersonationAuditMeta', () => {
    it('undefined sem impersonation', () => {
      expect(
        imp.impersonationAuditMeta({
          sub: 'u',
          email: 'a@b',
          role: 'admin',
          tv: 0,
          iat: 0,
          exp: 0,
        }),
      ).toBeUndefined();
    });

    it('com impersonation, retorna meta completa', () => {
      const meta = imp.impersonationAuditMeta({
        sub: 'student-1',
        email: 'st@x.com',
        role: 'student',
        tv: 0,
        iat: 0,
        exp: 0,
        act: { sub: 'admin-1', email: 'a@x.com', role: 'admin' },
      });
      expect(meta).toEqual({
        impersonating: true,
        impersonatedUserId: 'student-1',
        impersonatedEmail: 'st@x.com',
      });
    });
  });

  describe('isActionBlockedDuringImpersonation', () => {
    it('bloqueia ações sensíveis', () => {
      expect(imp.isActionBlockedDuringImpersonation('user.delete')).toBe(true);
      expect(imp.isActionBlockedDuringImpersonation('user.password.change')).toBe(
        true,
      );
      expect(imp.isActionBlockedDuringImpersonation('order.refund')).toBe(true);
      expect(imp.isActionBlockedDuringImpersonation('lgpd.deletion.confirm')).toBe(
        true,
      );
    });

    it('permite ações seguras', () => {
      expect(imp.isActionBlockedDuringImpersonation('lesson.complete')).toBe(false);
      expect(imp.isActionBlockedDuringImpersonation('progress.read')).toBe(false);
    });
  });
});

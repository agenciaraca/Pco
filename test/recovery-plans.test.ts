import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let store: typeof import('../server/repositories/recovery-plans');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-rplans-'));
  process.env.DATA_DIR = tmpDir;
  process.env.AI_KEY_ENCRYPTION_SECRET = 'c'.repeat(64);
  store = await import('../server/repositories/recovery-plans');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

beforeEach(async () => {
  await store._resetForTests();
});

const baseInput: import('../server/repositories/recovery-plans').GenerateInput = {
  studentId: 'stu-001',
  studentName: 'Maria Silva',
  riskScore: 72,
  riskReasons: ['Inatividade > 14 dias', 'Progresso estagnado'],
  realProgress: 25,
  expectedProgress: 60,
  tone: 'acolhedor',
  channel: 'email',
  intensity: 'media',
  goal: 'retomar_modulo',
};

describe('recovery-plans', () => {
  describe('generateWithAi', () => {
    it('gera plano com fallback (sem AI provider configurado)', async () => {
      const plan = await store.generateWithAi(baseInput);
      expect(plan.id).toMatch(/^rp-/);
      expect(plan.studentId).toBe('stu-001');
      expect(plan.studentName).toBe('Maria Silva');
      expect(plan.tone).toBe('acolhedor');
      expect(plan.channel).toBe('email');
      expect(plan.intensity).toBe('media');
      expect(plan.status).toBe('draft');
      expect(plan.diagnosis).toContain('72');
      expect(plan.message.length).toBeGreaterThan(10);
      expect(plan.weeklyGoalMinutes).toBe(120);
      expect(plan.aiProvider).toBeUndefined();
    });

    it('persiste plano no store', async () => {
      await store.generateWithAi(baseInput);
      const all = await store.listAll();
      expect(all.length).toBe(1);
    });
  });

  describe('listForStudent', () => {
    it('filtra por studentId', async () => {
      await store.generateWithAi(baseInput);
      await store.generateWithAi({ ...baseInput, studentId: 'stu-002', studentName: 'Outro' });
      const plans = await store.listForStudent('stu-001');
      expect(plans.length).toBe(1);
      expect(plans[0].studentId).toBe('stu-001');
    });
  });

  describe('updateStatus', () => {
    it('transiciona draft → sent', async () => {
      const plan = await store.generateWithAi(baseInput);
      const updated = await store.updateStatus(plan.id, 'sent');
      expect(updated).not.toBeNull();
      expect(updated!.status).toBe('sent');
      expect(updated!.updatedAt).not.toBe(plan.updatedAt);
    });

    it('transiciona sent → completed', async () => {
      const plan = await store.generateWithAi(baseInput);
      await store.updateStatus(plan.id, 'sent');
      const completed = await store.updateStatus(plan.id, 'completed');
      expect(completed!.status).toBe('completed');
    });

    it('retorna null pra ID inexistente', async () => {
      const result = await store.updateStatus('rp-nope', 'sent');
      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('encontra plano existente', async () => {
      const plan = await store.generateWithAi(baseInput);
      const found = await store.findById(plan.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(plan.id);
    });

    it('retorna null pra ID inexistente', async () => {
      const found = await store.findById('rp-nope');
      expect(found).toBeNull();
    });
  });

  describe('listAll', () => {
    it('ordena por createdAt descending', async () => {
      const p1 = await store.generateWithAi(baseInput);
      const p2 = await store.generateWithAi({ ...baseInput, tone: 'direto' });
      const all = await store.listAll();
      expect(all.length).toBe(2);
      expect(all[0].id).toBe(p2.id);
      expect(all[1].id).toBe(p1.id);
    });
  });
});

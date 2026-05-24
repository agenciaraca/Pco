import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let store: typeof import('../server/transcription/store');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-transc-'));
  process.env.DATA_DIR = tmpDir;
  process.env.AI_KEY_ENCRYPTION_SECRET = 'e'.repeat(64);
  store = await import('../server/transcription/store');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

beforeEach(async () => {
  await store._resetForTests();
});

describe('transcription store', () => {
  it('createProcessing cria com status processing', async () => {
    const t = await store.createProcessing('lv-123');
    expect(t.id).toMatch(/^tr-/);
    expect(t.sessionId).toBe('lv-123');
    expect(t.status).toBe('processing');
    expect(t.segments).toEqual([]);
    expect(t.fullText).toBe('');
  });

  it('markCompleted atualiza segmentos e status', async () => {
    const t = await store.createProcessing('lv-456');
    const updated = await store.markCompleted(t.id, {
      segments: [
        { start: 0, end: 5, text: 'Hoje vamos falar de transferência.' },
      ],
      fullText: 'Hoje vamos falar de transferência.',
      language: 'pt',
      durationSeconds: 3600,
      provider: 'whisper',
      model: 'whisper-1',
    });
    expect(updated).not.toBeNull();
    expect(updated!.status).toBe('completed');
    expect(updated!.segments).toHaveLength(1);
    expect(updated!.fullText).toContain('transferência');
    expect(updated!.durationSeconds).toBe(3600);
  });

  it('markFailed registra erro', async () => {
    const t = await store.createProcessing('lv-789');
    const failed = await store.markFailed(t.id, 'API timeout');
    expect(failed).not.toBeNull();
    expect(failed!.status).toBe('failed');
    expect(failed!.error).toBe('API timeout');
  });

  it('findBySessionId encontra por sessionId', async () => {
    await store.createProcessing('lv-abc');
    const found = await store.findBySessionId('lv-abc');
    expect(found).not.toBeNull();
    expect(found!.sessionId).toBe('lv-abc');
  });

  it('findBySessionId retorna null para inexistente', async () => {
    const found = await store.findBySessionId('lv-nope');
    expect(found).toBeNull();
  });

  it('setAiSummary adiciona resumo', async () => {
    const t = await store.createProcessing('lv-sum');
    await store.markCompleted(t.id, {
      segments: [],
      fullText: 'Aula sobre pulsão.',
      language: 'pt',
      durationSeconds: 600,
      provider: 'whisper',
      model: 'whisper-1',
    });
    const updated = await store.setAiSummary(t.id, 'Resumo: conceito de pulsão em Freud.');
    expect(updated).not.toBeNull();
    expect(updated!.aiSummary).toContain('pulsão');
  });

  it('listAll ordena por createdAt desc', async () => {
    const t1 = await store.createProcessing('lv-1');
    const t2 = await store.createProcessing('lv-2');
    const all = await store.listAll();
    expect(all[0].id).toBe(t2.id);
    expect(all[1].id).toBe(t1.id);
  });
});

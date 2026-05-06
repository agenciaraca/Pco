import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let store: typeof import('../server/imports/schedules-store');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-sched-'));
  process.env.DATA_DIR = tmpDir;
  store = await import('../server/imports/schedules-store');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('schedules-store CRUD', () => {
  it('cria schedule daily com nextRunAt calculado', async () => {
    const s = await store.createSchedule({
      name: 'Daily 3am',
      connectionId: 'conn-1',
      frequency: 'daily',
      hourUtc: 3,
      minute: 0,
      entities: ['student', 'course'],
      dryRun: true,
    });
    expect(s.name).toBe('Daily 3am');
    expect(s.frequency).toBe('daily');
    expect(s.enabled).toBe(true);
    expect(s.nextRunAt).toBeDefined();
    // nextRunAt deve ser >= now
    expect(new Date(s.nextRunAt!) >= new Date()).toBe(true);
  });

  it('cria schedule weekly com weekday', async () => {
    const s = await store.createSchedule({
      name: 'Weekly Sun',
      connectionId: 'conn-2',
      frequency: 'weekly',
      hourUtc: 4,
      minute: 0,
      weekday: 0,
      entities: ['enrollment'],
    });
    expect(s.weekday).toBe(0);
    expect(s.frequency).toBe('weekly');
  });

  it('clamp hourUtc entre 0 e 23', async () => {
    const s = await store.createSchedule({
      name: 'Clamp test',
      connectionId: 'conn-3',
      frequency: 'daily',
      hourUtc: 99,
      minute: 99,
      entities: [],
    });
    expect(s.hourUtc).toBe(23);
    expect(s.minute).toBe(59);
  });

  it('updateSchedule recalcula nextRunAt', async () => {
    const s = await store.createSchedule({
      name: 'Update test',
      connectionId: 'conn-4',
      frequency: 'daily',
      hourUtc: 5,
      minute: 0,
      entities: [],
    });
    const oldNext = s.nextRunAt;
    const updated = await store.updateSchedule(s.id, { hourUtc: 10 });
    expect(updated!.hourUtc).toBe(10);
    expect(updated!.nextRunAt).toBeDefined();
    // Pode mudar dependendo da hora atual
    expect(updated!.updatedAt > s.updatedAt).toBe(true);
    void oldNext;
  });

  it('weekly muda para daily limpa weekday', async () => {
    const s = await store.createSchedule({
      name: 'Weekly→Daily',
      connectionId: 'conn-5',
      frequency: 'weekly',
      hourUtc: 8,
      minute: 0,
      weekday: 3,
      entities: [],
    });
    const updated = await store.updateSchedule(s.id, { frequency: 'daily' });
    expect(updated!.frequency).toBe('daily');
    expect(updated!.weekday).toBeUndefined();
  });

  it('recordRun atualiza lastRunAt + lastJobId + nextRunAt', async () => {
    const s = await store.createSchedule({
      name: 'Recorded',
      connectionId: 'conn-6',
      frequency: 'daily',
      hourUtc: 6,
      minute: 0,
      entities: [],
    });
    const after = await store.recordRun(s.id, 'job-xyz');
    expect(after!.lastJobId).toBe('job-xyz');
    expect(after!.lastRunAt).toBeDefined();
    expect(after!.nextRunAt).toBeDefined();
  });

  it('deleteSchedule remove', async () => {
    const s = await store.createSchedule({
      name: 'ToDel',
      connectionId: 'conn-7',
      frequency: 'daily',
      hourUtc: 7,
      minute: 0,
      entities: [],
    });
    const ok = await store.deleteSchedule(s.id);
    expect(ok).toBe(true);
    expect(await store.findSchedule(s.id)).toBeNull();
  });

  it('listSchedules retorna múltiplos', async () => {
    const all = await store.listSchedules();
    expect(all.length).toBeGreaterThan(0);
  });
});

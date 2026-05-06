import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Mock do runner ANTES de importar schedules-worker — evita que job real
// rode em background e mantém o processo aberto.
const triggerSpy = vi.fn();
vi.mock('../server/imports/runner', () => ({
  triggerApiImport: (...args: unknown[]) => triggerSpy(...args),
}));

let tmpDir: string;
let worker: typeof import('../server/imports/schedules-worker');
let schedulesStore: typeof import('../server/imports/schedules-store');
let connectionsStore: typeof import('../server/imports/connections-store');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-sched-'));
  process.env.DATA_DIR = tmpDir;
  process.env.AI_KEY_ENCRYPTION_SECRET = 'a'.repeat(64);
  worker = await import('../server/imports/schedules-worker');
  schedulesStore = await import('../server/imports/schedules-store');
  connectionsStore = await import('../server/imports/connections-store');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

beforeEach(async () => {
  await schedulesStore._resetForTests?.();
  await connectionsStore._resetForTests?.();
  triggerSpy.mockReset();
  triggerSpy.mockResolvedValue({ jobId: 'job-mock', count: 0 });
});

const NOW = new Date('2026-05-06T12:00:00.000Z');

async function makeConnection(): Promise<string> {
  const conn = await connectionsStore.createConnection({
    name: 'Test WP',
    siteUrl: 'https://wp.test',
    wpUsername: 'admin',
    wpAppPassword: 'pwd',
  });
  return conn.id;
}

/** Cria schedule e força nextRunAt diretamente (bypassa computeNextRun). */
async function makeSchedule(opts: {
  connectionId: string;
  enabled?: boolean;
  nextRunAt?: string | null;
}) {
  const s = await schedulesStore.createSchedule({
    name: 'test',
    connectionId: opts.connectionId,
    enabled: opts.enabled ?? true,
    frequency: 'daily',
    hourUtc: 4,
    minute: 0,
    entities: ['student'],
    dryRun: true,
  });
  if (opts.nextRunAt !== undefined) {
    await schedulesStore._setNextRunAtForTests(s.id, opts.nextRunAt);
  }
  return (await schedulesStore.findSchedule(s.id))!;
}

describe('schedules-worker.tickWorker', () => {
  it('schedule disabled é ignorado', async () => {
    const connId = await makeConnection();
    await makeSchedule({
      connectionId: connId,
      enabled: false,
      nextRunAt: '2026-05-06T11:00:00.000Z',
    });
    const r = await worker.tickWorker(NOW);
    expect(r.dispatched).toBe(0);
    expect(r.errors).toBe(0);
    expect(triggerSpy).not.toHaveBeenCalled();
  });

  it('schedule sem nextRunAt é ignorado', async () => {
    const connId = await makeConnection();
    await makeSchedule({ connectionId: connId, nextRunAt: null });
    const r = await worker.tickWorker(NOW);
    expect(r.dispatched).toBe(0);
  });

  it('schedule futuro (nextRunAt > now) é ignorado', async () => {
    const connId = await makeConnection();
    await makeSchedule({
      connectionId: connId,
      nextRunAt: '2030-01-01T00:00:00.000Z',
    });
    const r = await worker.tickWorker(NOW);
    expect(r.dispatched).toBe(0);
  });

  it('schedule overdue dispara triggerApiImport', async () => {
    const connId = await makeConnection();
    await makeSchedule({
      connectionId: connId,
      nextRunAt: '2026-05-06T11:00:00.000Z', // 1h atrás
    });
    const r = await worker.tickWorker(NOW);
    expect(r.dispatched).toBe(1);
    expect(triggerSpy).toHaveBeenCalledOnce();
  });

  it('schedule cuja conexão sumiu é auto-desativado', async () => {
    const s = await makeSchedule({
      connectionId: 'conn-fantasma',
      nextRunAt: '2026-05-06T11:00:00.000Z',
    });
    const r = await worker.tickWorker(NOW);
    expect(r.dispatched).toBe(0);
    const after = await schedulesStore.findSchedule(s.id);
    expect(after?.enabled).toBe(false);
    expect(triggerSpy).not.toHaveBeenCalled();
  });

  it('triggerApiImport throw incrementa errors', async () => {
    triggerSpy.mockRejectedValueOnce(new Error('runner kaput'));
    const connId = await makeConnection();
    await makeSchedule({
      connectionId: connId,
      nextRunAt: '2026-05-06T10:00:00.000Z',
    });
    const r = await worker.tickWorker(NOW);
    expect(r.errors).toBe(1);
    expect(r.dispatched).toBe(0);
  });

  it('dois schedules overdue: ambos disparam', async () => {
    const connId = await makeConnection();
    await makeSchedule({
      connectionId: connId,
      nextRunAt: '2026-05-06T11:00:00.000Z',
    });
    await makeSchedule({
      connectionId: connId,
      nextRunAt: '2026-05-06T11:30:00.000Z',
    });
    const r = await worker.tickWorker(NOW);
    expect(r.dispatched).toBe(2);
    expect(triggerSpy).toHaveBeenCalledTimes(2);
  });
});

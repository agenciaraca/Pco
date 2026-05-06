import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let jobs: typeof import('../server/imports/job-store');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-jobs-'));
  process.env.DATA_DIR = tmpDir;
  jobs = await import('../server/imports/job-store');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('imports/job-store', () => {
  it('createJob inicializa stats zeradas', async () => {
    const j = await jobs.createJob({
      source: 'wordpress',
      mode: 'api',
      dryRun: true,
      entities: [],
      enrollment: {
        startRule: 'paid_date',
        expirationRule: 'start_plus_duration',
        wcStatusMap: {},
      },
      startedBy: 'admin',
      startedById: 'u1',
    });
    expect(j.id).toMatch(/^imp-/);
    expect(j.status).toBe('pending');
    expect(j.stats.totalRead).toBe(0);
    expect(j.notes).toEqual([]);
  });

  it('setStatus muda status sem finished por padrão', async () => {
    const j = await jobs.createJob({
      source: 'csv',
      mode: 'csv',
      dryRun: false,
      entities: [],
      enrollment: { startRule: 'paid_date', expirationRule: 'start_plus_duration', wcStatusMap: {} },
      startedBy: 'a',
      startedById: 'u',
    });
    await jobs.setStatus(j.id, 'running');
    const after = await jobs.findJob(j.id);
    expect(after!.status).toBe('running');
    expect(after!.finishedAt).toBeUndefined();
  });

  it('setStatus com finished=true seta finishedAt', async () => {
    const j = await jobs.createJob({
      source: 'csv',
      mode: 'csv',
      dryRun: false,
      entities: [],
      enrollment: { startRule: 'paid_date', expirationRule: 'start_plus_duration', wcStatusMap: {} },
      startedBy: 'a',
      startedById: 'u',
    });
    await jobs.setStatus(j.id, 'completed', true);
    const after = await jobs.findJob(j.id);
    expect(after!.status).toBe('completed');
    expect(after!.finishedAt).toBeDefined();
  });

  it('addNote adiciona ao log com level', async () => {
    const j = await jobs.createJob({
      source: 'wordpress',
      mode: 'api',
      dryRun: true,
      entities: [],
      enrollment: { startRule: 'paid_date', expirationRule: 'start_plus_duration', wcStatusMap: {} },
      startedBy: 'a',
      startedById: 'u',
    });
    await jobs.addNote(j.id, 'info', 'teste');
    await jobs.addNote(j.id, 'error', 'erro!');
    const after = await jobs.findJob(j.id);
    expect(after!.notes.length).toBe(2);
    expect(after!.notes[0]!.level).toBe('info');
    expect(after!.notes[1]!.level).toBe('error');
  });

  it('addError grava no errorsLog SEM tocar stats.errors (caller bumpa)', async () => {
    const j = await jobs.createJob({
      source: 'csv',
      mode: 'csv',
      dryRun: false,
      entities: [],
      enrollment: { startRule: 'paid_date', expirationRule: 'start_plus_duration', wcStatusMap: {} },
      startedBy: 'a',
      startedById: 'u',
    });
    const before = (await jobs.findJob(j.id))!.stats.errors;
    await jobs.addError(j.id, {
      entity: 'student',
      rowIndex: 5,
      message: 'invalid email',
    });
    const after = await jobs.findJob(j.id);
    expect(after!.errorsLog.length).toBe(1);
    expect(after!.errorsLog[0]!.message).toBe('invalid email');
    // stats.errors não muda — caller que bumpa via bumpEntityStat
    expect(after!.stats.errors).toBe(before);
  });

  it('bumpEntityStat soma em stats agregadas e perEntity', async () => {
    const j = await jobs.createJob({
      source: 'csv',
      mode: 'csv',
      dryRun: false,
      entities: [],
      enrollment: { startRule: 'paid_date', expirationRule: 'start_plus_duration', wcStatusMap: {} },
      startedBy: 'a',
      startedById: 'u',
    });
    await jobs.bumpEntityStat(j.id, 'student', 'created', 1);
    await jobs.bumpEntityStat(j.id, 'student', 'created', 1);
    await jobs.bumpEntityStat(j.id, 'course', 'updated', 1);
    const after = await jobs.findJob(j.id);
    expect(after!.stats.created).toBe(2);
    expect(after!.stats.updated).toBe(1);
    expect(after!.perEntity.student!.created).toBe(2);
    expect(after!.perEntity.course!.updated).toBe(1);
  });

  it('requestCancel + isCancelRequested + clearCancel', async () => {
    const id = 'job-cancel-test';
    expect(jobs.isCancelRequested(id)).toBe(false);
    jobs.requestCancel(id);
    expect(jobs.isCancelRequested(id)).toBe(true);
    jobs.clearCancel(id);
    expect(jobs.isCancelRequested(id)).toBe(false);
  });

  it('listJobs ordena desc por startedAt', async () => {
    const all = await jobs.listJobs();
    expect(all.length).toBeGreaterThan(0);
    for (let i = 1; i < all.length; i++) {
      expect(all[i - 1]!.startedAt >= all[i]!.startedAt).toBe(true);
    }
  });
});

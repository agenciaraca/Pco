import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let reports: typeof import('../server/imports/reports');
let jobs: typeof import('../server/imports/job-store');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-rep-'));
  process.env.DATA_DIR = tmpDir;
  reports = await import('../server/imports/reports');
  jobs = await import('../server/imports/job-store');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

async function makeJob() {
  return jobs.createJob({
    source: 'wordpress',
    mode: 'api',
    dryRun: false,
    entities: ['student'],
    enrollment: {
      startRule: 'paid_date',
      expirationRule: 'start_plus_duration',
      wcStatusMap: {},
    },
    startedBy: 'admin@x.com',
    startedById: 'u-1',
  });
}

describe('imports/reports', () => {
  it('exportJobAsJson lança em job inexistente', async () => {
    await expect(reports.exportJobAsJson('nada')).rejects.toThrow(
      /não encontrado/,
    );
  });

  it('exportJobAsJson inclui job + externalReferences', async () => {
    const job = await makeJob();
    const out = await reports.exportJobAsJson(job.id);
    const parsed = JSON.parse(out) as {
      job: { id: string };
      externalReferences: unknown[];
    };
    expect(parsed.job.id).toBe(job.id);
    expect(Array.isArray(parsed.externalReferences)).toBe(true);
  });

  it('exportJobAsCsv inicia com BOM UTF-8', async () => {
    const job = await makeJob();
    const csv = await reports.exportJobAsCsv(job.id);
    expect(csv.startsWith('﻿')).toBe(true);
  });

  it('exportJobAsCsv contém todas as seções', async () => {
    const job = await makeJob();
    const csv = await reports.exportJobAsCsv(job.id);
    expect(csv).toContain('# Resumo do job');
    expect(csv).toContain('# Por entidade');
    expect(csv).toContain('# Erros (primeiros 1000)');
    expect(csv).toContain('# Referências criadas');
    expect(csv).toContain(job.id);
  });

  it('exportJobAsCsv inclui errors no log', async () => {
    const job = await makeJob();
    await jobs.addError(job.id, {
      rowIndex: 5,
      entity: 'student',
      field: 'email',
      message: 'inválido',
    });
    const csv = await reports.exportJobAsCsv(job.id);
    expect(csv).toContain('inválido');
  });

  it('exportJobAsCsv lança em job inexistente', async () => {
    await expect(reports.exportJobAsCsv('nada')).rejects.toThrow(
      /não encontrado/,
    );
  });

  it('listJobsFiltered filtra por status', async () => {
    const j1 = await makeJob();
    const j2 = await makeJob();
    await jobs.setStatus(j1.id, 'completed', true);
    await jobs.setStatus(j2.id, 'failed', true);

    const completed = await reports.listJobsFiltered({ status: 'completed' });
    expect(completed.every((j) => j.status === 'completed')).toBe(true);
    expect(completed.some((j) => j.id === j1.id)).toBe(true);
    expect(completed.some((j) => j.id === j2.id)).toBe(false);
  });

  it('listJobsFiltered filtra por source/mode/dryRun', async () => {
    const all = await reports.listJobsFiltered({
      source: 'wordpress',
      mode: 'api',
      dryRun: false,
    });
    expect(
      all.every(
        (j) => j.source === 'wordpress' && j.mode === 'api' && j.dryRun === false,
      ),
    ).toBe(true);
  });

  it('listJobsFiltered q matcha id ou startedBy', async () => {
    const j = await makeJob();
    const r = await reports.listJobsFiltered({ q: 'admin' });
    expect(r.some((x) => x.id === j.id)).toBe(true);
  });

  it('listJobsFiltered filtra por dateFrom/dateTo', async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const r = await reports.listJobsFiltered({ dateFrom: future });
    expect(r).toEqual([]);
  });

  it('listJobsFiltered respeita limit', async () => {
    const r = await reports.listJobsFiltered({ limit: 1 });
    expect(r.length).toBeLessThanOrEqual(1);
  });
});

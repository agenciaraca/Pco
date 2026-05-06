import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let store: typeof import('../server/imports/refs-store');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-refs-'));
  process.env.DATA_DIR = tmpDir;
  store = await import('../server/imports/refs-store');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('refs-store', () => {
  it('upsert cria nova ref', async () => {
    const r = await store.upsert({
      sourceType: 'wordpress',
      externalEntityType: 'student',
      externalId: 'wp-101',
      internalEntityType: 'student',
      internalId: 'usr-abc',
      jobId: 'job-1',
    });
    expect(r.id).toMatch(/^xref-/);
    expect(r.externalId).toBe('wp-101');
    expect(r.internalId).toBe('usr-abc');
  });

  it('find retorna ref existente', async () => {
    const found = await store.find('wordpress', 'student', 'wp-101');
    expect(found).not.toBeNull();
    expect(found!.internalId).toBe('usr-abc');
  });

  it('upsert é idempotente — atualiza ao invés de duplicar', async () => {
    await store.upsert({
      sourceType: 'wordpress',
      externalEntityType: 'student',
      externalId: 'wp-101',
      internalEntityType: 'student',
      internalId: 'usr-NEW',
      jobId: 'job-2',
      metadata: { extra: 'foo' },
    });
    const found = await store.find('wordpress', 'student', 'wp-101');
    expect(found!.internalId).toBe('usr-NEW');
    expect(found!.metadata).toEqual({ extra: 'foo' });
    // upsert preserva jobId original (não muda); só uma entry total
    const job1 = await store.listByJob('job-1');
    expect(job1.length).toBe(1);
  });

  it('isola por sourceType', async () => {
    await store.upsert({
      sourceType: 'csv',
      externalEntityType: 'student',
      externalId: 'wp-101',
      internalEntityType: 'student',
      internalId: 'usr-csv',
      jobId: 'job-3',
    });
    const wp = await store.find('wordpress', 'student', 'wp-101');
    const csv = await store.find('csv', 'student', 'wp-101');
    expect(wp!.internalId).not.toBe(csv!.internalId);
  });

  it('isola por externalEntityType', async () => {
    await store.upsert({
      sourceType: 'wordpress',
      externalEntityType: 'course',
      externalId: 'wp-101',
      internalEntityType: 'course',
      internalId: 'crs-x',
      jobId: 'job-4',
    });
    const student = await store.find('wordpress', 'student', 'wp-101');
    const course = await store.find('wordpress', 'course', 'wp-101');
    expect(student!.internalId).toBe('usr-NEW');
    expect(course!.internalId).toBe('crs-x');
  });

  it('listByJob filtra por jobId', async () => {
    await store.upsert({
      sourceType: 'wordpress',
      externalEntityType: 'order',
      externalId: 'ord-1',
      internalEntityType: 'order',
      internalId: 'ord-1',
      jobId: 'job-5',
    });
    await store.upsert({
      sourceType: 'wordpress',
      externalEntityType: 'order',
      externalId: 'ord-2',
      internalEntityType: 'order',
      internalId: 'ord-2',
      jobId: 'job-5',
    });
    const list = await store.listByJob('job-5');
    expect(list.length).toBe(2);
  });

  it('listForInternal filtra por internalId', async () => {
    const list = await store.listForInternal('student', 'usr-NEW');
    expect(list.length).toBe(1);
    expect(list[0]!.externalId).toBe('wp-101');
  });

  it('find retorna null para ref inexistente', async () => {
    const r = await store.find('wordpress', 'student', 'nonexistent');
    expect(r).toBeNull();
  });
});

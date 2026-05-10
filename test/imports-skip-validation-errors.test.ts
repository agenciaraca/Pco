// Test do flag skipValidationErrors no service de import (runReal).

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let service: typeof import('../server/imports/service');
let jobs: typeof import('../server/imports/job-store');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-imp-'));
  process.env.DATA_DIR = tmpDir;
  service = await import('../server/imports/service');
  jobs = await import('../server/imports/job-store');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
  delete process.env.DATA_DIR;
});

const ENROLL = {
  startRule: 'paid_date' as const,
  expirationRule: 'start_plus_duration' as const,
  defaultAccessDurationDays: 365,
  wcStatusMap: {},
  userMatchKeys: ['email' as const],
  unmatchedUserPolicy: 'skip' as const,
  conflictStrategy: 'update' as const,
};

describe('runReal — skipValidationErrors flag', () => {
  beforeEach(async () => {
    // limpa jobs entre testes
    try {
      await fs.writeFile(path.join(tmpDir, 'import-jobs.json'), '[]');
    } catch {}
  });

  it('strict (default): order com email vazio NAO entra', async () => {
    const job = await jobs.createJob({
      source: 'wordpress',
      mode: 'api',
      dryRun: false,
      entities: [],
      enrollment: ENROLL,
      startedBy: 'test',
      startedById: 'test',
    });
    await service.runReal({
      jobId: job.id,
      source: 'wordpress',
      enrollmentRules: ENROLL,
      rowsByEntity: {
        order: [
          {
            external_order_id: 'ord-1',
            customer_email: '', // vazio — viola validateOrder
            order_date: '2026-01-01',
            order_status: 'completed',
            total: 100,
            currency: 'BRL',
          },
        ],
      },
    });
    const final = await jobs.findJob(job.id);
    expect(final?.perEntity.order?.invalid).toBe(1);
    expect(final?.perEntity.order?.created ?? 0).toBe(0);
  });

  it('skipValidationErrors=true: order com email vazio AINDA é tentado', async () => {
    const job = await jobs.createJob({
      source: 'wordpress',
      mode: 'api',
      dryRun: false,
      entities: [],
      enrollment: { ...ENROLL, skipValidationErrors: true },
      startedBy: 'test',
      startedById: 'test',
    });
    await service.runReal({
      jobId: job.id,
      source: 'wordpress',
      enrollmentRules: { ...ENROLL, skipValidationErrors: true },
      rowsByEntity: {
        order: [
          {
            external_order_id: 'ord-2',
            customer_email: '', // vazio
            order_date: '2026-01-01',
            order_status: 'completed',
            total: 100,
            currency: 'BRL',
          },
        ],
      },
    });
    const final = await jobs.findJob(job.id);
    // invalid foi contado mas o adapter foi chamado mesmo assim.
    // adapter ainda pode falhar (errors), criar (created), ou ignorar.
    expect(final?.perEntity.order?.invalid).toBe(1);
    const handled =
      (final?.perEntity.order?.created ?? 0) +
      (final?.perEntity.order?.updated ?? 0) +
      (final?.perEntity.order?.errors ?? 0) +
      (final?.perEntity.order?.ignored ?? 0);
    expect(handled).toBeGreaterThanOrEqual(1);
  });

  it('errorsLog marca [WARNING ignorado] quando skipValidationErrors=true', async () => {
    const job = await jobs.createJob({
      source: 'wordpress',
      mode: 'api',
      dryRun: false,
      entities: [],
      enrollment: { ...ENROLL, skipValidationErrors: true },
      startedBy: 'test',
      startedById: 'test',
    });
    await service.runReal({
      jobId: job.id,
      source: 'wordpress',
      enrollmentRules: { ...ENROLL, skipValidationErrors: true },
      rowsByEntity: {
        order: [
          {
            external_order_id: 'ord-3',
            customer_email: '',
            order_date: '2026-01-01',
            order_status: 'completed',
            total: 100,
            currency: 'BRL',
          },
        ],
      },
    });
    const final = await jobs.findJob(job.id);
    const errors = final?.errorsLog ?? [];
    const hasWarning = errors.some((e) =>
      (e.message ?? '').startsWith('[WARNING ignorado]'),
    );
    expect(hasWarning).toBe(true);
  });
});

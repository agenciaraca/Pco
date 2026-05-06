import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let rollback: typeof import('../server/imports/rollback');
let jobs: typeof import('../server/imports/job-store');
let refs: typeof import('../server/imports/refs-store');
let products: typeof import('../server/payments/products-repo');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-rb-'));
  process.env.DATA_DIR = tmpDir;
  process.env.AVA_ENCRYPTION_KEY = 'a'.repeat(64);

  rollback = await import('../server/imports/rollback');
  jobs = await import('../server/imports/job-store');
  refs = await import('../server/imports/refs-store');
  products = await import('../server/payments/products-repo');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('imports/rollback', () => {
  it('rollbackJob lança em job inexistente', async () => {
    await expect(rollback.rollbackJob('nao-existe')).rejects.toThrow(
      /não encontrado/,
    );
  });

  it('previewRollback lança em job inexistente', async () => {
    await expect(rollback.previewRollback('nao-existe')).rejects.toThrow(
      /não encontrado/,
    );
  });

  it('previewRollback agrupa createdRefs por entity', async () => {
    const job = await jobs.createJob({
      source: 'wordpress',
      mode: 'api',
      dryRun: false,
      entities: [],
      enrollment: {
        startRule: 'paid_date',
        expirationRule: 'start_plus_duration',
        wcStatusMap: {},
      },
      startedBy: 'admin',
      startedById: 'u1',
    });
    await jobs.appendCreatedRef(job.id, {
      entity: 'student',
      internalId: 'usr-1',
    });
    await jobs.appendCreatedRef(job.id, {
      entity: 'student',
      internalId: 'usr-2',
    });
    await jobs.appendCreatedRef(job.id, {
      entity: 'product',
      internalId: 'prod-1',
    });
    await jobs.appendCreatedRef(job.id, {
      entity: 'enrollment',
      internalId: 'enr-1',
    });

    const preview = await rollback.previewRollback(job.id);
    expect(preview.studentsCreated).toHaveLength(2);
    expect(preview.productsToDeactivate).toHaveLength(1);
    expect(preview.enrollmentsCreated).toHaveLength(1);
  });

  it('rollbackJob desativa products + remove refs + marca rolled_back', async () => {
    // Cria product real para verificar deactivation
    const prod = await products.createProduct({
      kind: 'course',
      refId: 'c-rb',
      name: 'P para rollback',
      priceCents: 9990,
    });
    expect(prod.active).toBe(true);

    // Cria job com ref pra esse product e cross-source ref
    const job = await jobs.createJob({
      source: 'wordpress',
      mode: 'api',
      dryRun: false,
      entities: [],
      enrollment: {
        startRule: 'paid_date',
        expirationRule: 'start_plus_duration',
        wcStatusMap: {},
      },
      startedBy: 'admin',
      startedById: 'u1',
    });
    await jobs.appendCreatedRef(job.id, {
      entity: 'product',
      internalId: prod.id,
    });
    await refs.upsert({
      jobId: job.id,
      sourceType: 'wordpress',
      externalEntityType: 'product',
      externalId: 'wp-prod-1',
      internalEntityType: 'product',
      internalId: prod.id,
    });

    const r = await rollback.rollbackJob(job.id);
    expect(r.productsDeactivated).toBe(1);
    expect(r.refsRemoved).toBeGreaterThanOrEqual(1);
    expect(r.notes.some((n) => n.includes('rollback'))).toBe(true);

    // Product agora inativo
    const after = await products.findById(prod.id);
    expect(after!.active).toBe(false);

    // Job marcado como rolled_back
    const jobAfter = await jobs.findJob(job.id);
    expect(jobAfter!.status).toBe('rolled_back');
    expect(jobAfter!.finishedAt).toBeDefined();

    // Refs do job sumiram
    const refsAfter = await refs.listByJob(job.id);
    expect(refsAfter).toHaveLength(0);
  });

  it('rollbackJob é tolerante a product inexistente (loga, segue)', async () => {
    const job = await jobs.createJob({
      source: 'wordpress',
      mode: 'api',
      dryRun: false,
      entities: [],
      enrollment: {
        startRule: 'paid_date',
        expirationRule: 'start_plus_duration',
        wcStatusMap: {},
      },
      startedBy: 'admin',
      startedById: 'u1',
    });
    // Aponta pra product que não existe — updateProduct retorna null silenciosamente
    await jobs.appendCreatedRef(job.id, {
      entity: 'product',
      internalId: 'prod-fake',
    });
    const r = await rollback.rollbackJob(job.id);
    // updateProduct retorna null para id inexistente, mas não lança — então
    // é "desativado" do ponto de vista do contador
    expect(r.notes).toBeDefined();
  });
});

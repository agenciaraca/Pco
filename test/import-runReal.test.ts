// Integração leve: roda service.runReal contra um DATA_DIR temporário
// e verifica que conflict strategies / match keys produzem os outcomes corretos.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let runReal: typeof import('../server/imports/service').runReal;
let jobs: typeof import('../server/imports/job-store');
let usersStore: typeof import('../server/auth/users-store');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-test-'));
  process.env.DATA_DIR = tmpDir;
  process.env.AVA_ENCRYPTION_KEY = 'a'.repeat(64); // 32 bytes hex
  process.env.JWT_SECRET = 'test-secret-jwt';
  // Importa DEPOIS de setar DATA_DIR para que JsonStore use o tmpdir
  const svc = await import('../server/imports/service');
  jobs = await import('../server/imports/job-store');
  usersStore = await import('../server/auth/users-store');
  runReal = svc.runReal;
});

afterAll(async () => {
  if (tmpDir) {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

describe('runReal — student upsert', () => {
  it('cria novo aluno quando email não existe', { timeout: 15_000 }, async () => {
    const job = await jobs.createJob({
      source: 'wordpress',
      mode: 'api',
      dryRun: false,
      entities: [],
      enrollment: {
        startRule: 'paid_date',
        expirationRule: 'start_plus_duration',
        wcStatusMap: {},
        conflictStrategy: 'update',
      },
      startedBy: 'test',
      startedById: 'test-user',
    });

    await runReal({
      rowsByEntity: {
        student: [
          {
            user_email: 'novo@test.com',
            first_name: 'Novo',
            last_name: 'Aluno',
            wp_user_id: '101',
          },
        ],
      },
      jobId: job.id,
      source: 'wordpress',
    });

    const final = await jobs.findJob(job.id);
    expect(final?.stats.created).toBe(1);
    expect(final?.stats.errors).toBe(0);

    const created = await usersStore.findUserByEmail('novo@test.com');
    expect(created).not.toBeNull();
    expect(created?.name).toContain('Novo');
  });

  it('ignora aluno existente com conflictStrategy=ignore', async () => {
    const job = await jobs.createJob({
      source: 'wordpress',
      mode: 'api',
      dryRun: false,
      entities: [],
      enrollment: {
        startRule: 'paid_date',
        expirationRule: 'start_plus_duration',
        wcStatusMap: {},
        conflictStrategy: 'ignore',
      },
      startedBy: 'test',
      startedById: 'test-user',
    });

    await runReal({
      rowsByEntity: {
        student: [
          {
            user_email: 'novo@test.com',
            first_name: 'OutroNome',
          },
        ],
      },
      jobId: job.id,
      source: 'wordpress',
      enrollmentRules: {
        startRule: 'paid_date',
        expirationRule: 'start_plus_duration',
        wcStatusMap: {},
        conflictStrategy: 'ignore',
      },
    });

    const final = await jobs.findJob(job.id);
    expect(final?.stats.ignored).toBe(1);
    expect(final?.stats.created).toBe(0);

    const u = await usersStore.findUserByEmail('novo@test.com');
    expect(u?.name).toContain('Novo'); // não foi sobrescrito
  });

  it('atualiza aluno existente com conflictStrategy=update', async () => {
    const job = await jobs.createJob({
      source: 'wordpress',
      mode: 'api',
      dryRun: false,
      entities: [],
      enrollment: {
        startRule: 'paid_date',
        expirationRule: 'start_plus_duration',
        wcStatusMap: {},
        conflictStrategy: 'update',
      },
      startedBy: 'test',
      startedById: 'test-user',
    });

    await runReal({
      rowsByEntity: {
        student: [
          {
            user_email: 'novo@test.com',
            first_name: 'Atualizado',
            last_name: 'Sobrenome',
          },
        ],
      },
      jobId: job.id,
      source: 'wordpress',
      enrollmentRules: {
        startRule: 'paid_date',
        expirationRule: 'start_plus_duration',
        wcStatusMap: {},
        conflictStrategy: 'update',
      },
    });

    const final = await jobs.findJob(job.id);
    expect(final?.stats.updated).toBe(1);

    const u = await usersStore.findUserByEmail('novo@test.com');
    expect(u?.name).toBe('Atualizado Sobrenome');
  });

  it('respeita conflictStrategy=error em duplicata', async () => {
    const job = await jobs.createJob({
      source: 'wordpress',
      mode: 'api',
      dryRun: false,
      entities: [],
      enrollment: {
        startRule: 'paid_date',
        expirationRule: 'start_plus_duration',
        wcStatusMap: {},
        conflictStrategy: 'error',
      },
      startedBy: 'test',
      startedById: 'test-user',
    });

    await runReal({
      rowsByEntity: {
        student: [
          { user_email: 'novo@test.com', first_name: 'X' },
        ],
      },
      jobId: job.id,
      source: 'wordpress',
      enrollmentRules: {
        startRule: 'paid_date',
        expirationRule: 'start_plus_duration',
        wcStatusMap: {},
        conflictStrategy: 'error',
      },
    });

    const final = await jobs.findJob(job.id);
    expect(final?.stats.errors).toBe(1);
    expect(final?.errorsLog[0]?.message).toContain('Estratégia=error');
  });
});

describe('runReal — cancellation', () => {
  it('para após primeira row se cancel for solicitado', async () => {
    const job = await jobs.createJob({
      source: 'wordpress',
      mode: 'api',
      dryRun: false,
      entities: [],
      enrollment: {
        startRule: 'paid_date',
        expirationRule: 'start_plus_duration',
        wcStatusMap: {},
        conflictStrategy: 'update',
      },
      startedBy: 'test',
      startedById: 'test-user',
    });

    // Simula cancel já pré-ativo — runReal pega na primeira iteração
    jobs.requestCancel(job.id);
    await runReal({
      rowsByEntity: {
        student: [
          { user_email: 'a@b.com', first_name: 'A' },
          { user_email: 'b@b.com', first_name: 'B' },
          { user_email: 'c@b.com', first_name: 'C' },
        ],
      },
      jobId: job.id,
      source: 'wordpress',
    });

    const final = await jobs.findJob(job.id);
    expect(final?.status).toBe('canceled');
    expect(final?.stats.created).toBe(0);
  });
});

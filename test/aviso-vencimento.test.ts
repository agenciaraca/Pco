import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * Aviso de vencimento de acesso.
 *
 * O worker existe por causa da armadilha do prazo retroativo: declarar
 * `accessMonths` num curso faz matrículas antigas vencerem na hora. O
 * comportamento é o desejado — o que não pode é o aluno descobrir pela porta
 * fechada. Estes testes cobrem a parte onde um erro manda o aviso errado para
 * gente de verdade.
 */

let tmpDir: string;
let worker: typeof import('../server/access/expiry-worker');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-venc-'));
  process.env.DATA_DIR = tmpDir;
  worker = await import('../server/access/expiry-worker');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('faixa de aviso', () => {
  it('acesso vitalício nunca cai em faixa nenhuma', () => {
    expect(worker.faixaPara(null)).toBeNull();
  });

  it('quem tem folga não é avisado', () => {
    expect(worker.faixaPara(365)).toBeNull();
    expect(worker.faixaPara(31)).toBeNull();
  });

  it('cai sempre na faixa mais apertada que ainda o contém', () => {
    // Com 5 dias restantes o aluno está na faixa de 7, não na de 30 — mandar
    // "faltam 30 dias" para quem tem 5 seria pior do que não mandar nada.
    expect(worker.faixaPara(30)).toBe(30);
    expect(worker.faixaPara(8)).toBe(30);
    expect(worker.faixaPara(7)).toBe(7);
    expect(worker.faixaPara(5)).toBe(7);
    expect(worker.faixaPara(1)).toBe(1);
    expect(worker.faixaPara(0)).toBe(1);
  });

  it('dias negativos caem na faixa do vencido', () => {
    expect(worker.faixaPara(-1)).toBe(worker.FAIXA_VENCIDO);
    expect(worker.faixaPara(-400)).toBe(worker.FAIXA_VENCIDO);
  });

  it('a faixa do vencido é 0 e não se confunde com "sem faixa"', () => {
    // 0 é falsy: quem testar `if (faixa)` some com o aviso de vencimento.
    expect(worker.FAIXA_VENCIDO).toBe(0);
    expect(worker.faixaPara(-1)).not.toBeNull();
  });
});

describe('varredura', () => {
  it('não envia nada enquanto nenhum curso declara prazo', async () => {
    await worker._resetParaTeste();
    const r = await worker.tickWorker({ dryRun: true });
    // Estado de 26/ago/2026: nenhum dos cursos declara accessMonths, então
    // ninguém tem prazo e ninguém pode ser avisado. Se este teste começar a
    // falhar, é porque algum curso passou a declarar — e aí vale conferir o
    // impacto antes (GET /admin/courses/:id/impacto-acesso).
    expect(r.comPrazo).toBe(0);
    expect(r.elegiveis).toBe(0);
    expect(r.enviados).toBe(0);
  });

  it('dry-run nunca envia nem registra', async () => {
    await worker._resetParaTeste();
    const r = await worker.tickWorker({ dryRun: true });
    expect(r.enviados).toBe(0);
    // E o status não registra a passada, para não fingir execução.
    expect(worker.getStatus().lastRunAt).toBeNull();
  });

  it('o status segue o padrão dos demais workers da casa', async () => {
    const s = worker.getStatus();
    expect(s.name).toBe('access-expiry');
    expect(s).toHaveProperty('enabled');
    expect(s).toHaveProperty('intervalMs');
    expect(s).toHaveProperty('lastRunAt');
    expect(s).toHaveProperty('totalTicks');
  });

  it('uma passada de verdade registra lastRunAt', async () => {
    await worker._resetParaTeste();
    expect(worker.getStatus().lastRunAt).toBeNull();
    await worker.tickWorker();
    expect(worker.getStatus().lastRunAt).not.toBeNull();
    expect(worker.getStatus().totalTicks).toBe(1);
  });
});

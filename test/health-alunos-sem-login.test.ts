import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { promises as fs } from 'node:fs';

// `json-store` congela DATA_DIR no import — apontar num beforeAll chega tarde e
// o teste passaria a escrever no `data/` real do projeto.
const TMP_DIR = vi.hoisted(() => {
  const base = process.env.TEMP ?? process.env.TMPDIR ?? '/tmp';
  const dir = `${base}/ava-pco-health-${process.pid}-${Date.now()}`;
  process.env.DATA_DIR = dir;
  return dir;
});

import { buildSnapshot } from '../server/health/dashboard';

// Credencial e aluno moram em lugares diferentes: a senha no store de usuários,
// a pessoa como aluno no Postgres. Quem entra por um caminho que escreve só no
// banco aparece no admin com matrícula e não consegue entrar — em 17/ago/2026
// eram 63 pessoas, e nada denunciava. O check existe para denunciar.

describe('painel de saúde — alunos sem credencial', () => {
  afterAll(async () => {
    await fs.rm(TMP_DIR, { recursive: true, force: true });
  });

  it('sem banco, o check nem aparece — não há como comparar os dois lados', async () => {
    const snap = await buildSnapshot();
    expect(snap.checks.find((c) => c.id === 'alunos-sem-login')).toBeUndefined();
  });

  it('o snapshot continua íntegro e agrega o pior estado dos checks', async () => {
    const snap = await buildSnapshot();
    expect(snap.checks.length).toBeGreaterThan(0);
    expect(['ok', 'warn', 'error', 'na']).toContain(snap.overall);
    const pior = snap.checks.some((c) => c.status === 'error')
      ? 'error'
      : snap.checks.some((c) => c.status === 'warn')
        ? 'warn'
        : 'ok';
    expect(snap.overall).toBe(pior);
  });

  it('todo check declara id, rótulo e mensagem — o painel não mostra caixa muda', async () => {
    const snap = await buildSnapshot();
    for (const c of snap.checks) {
      expect(c.id, 'check sem id').toBeTruthy();
      expect(c.label, `check ${c.id} sem rótulo`).toBeTruthy();
      expect(c.message, `check ${c.id} sem mensagem`).toBeTruthy();
    }
  });

  it('ids de check não se repetem — dois iguais somem um atrás do outro na tela', async () => {
    const snap = await buildSnapshot();
    const ids = snap.checks.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

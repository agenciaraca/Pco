import { describe, it, expect, afterAll, vi } from 'vitest';
import { promises as fs } from 'node:fs';

// `json-store` congela DATA_DIR no import — apontar num beforeAll chega tarde e
// o teste passaria a escrever no `data/` real do projeto.
const TMP_DIR = vi.hoisted(() => {
  const base = process.env.TEMP ?? process.env.TMPDIR ?? '/tmp';
  const dir = `${base}/ava-pco-saude-workers-${process.pid}-${Date.now()}`;
  process.env.DATA_DIR = dir;
  return dir;
});

import { buildSnapshot } from '../server/health/dashboard';

/**
 * O painel de saúde não perguntava pelos workers.
 *
 * Ele tinha dezesseis verificações — gateways, e-mail, webhooks, IA, erros
 * recentes, disco, checkout — e nenhuma sobre os treze processos que rodam
 * sozinhos. É a primeira tela que alguém abre quando desconfia de alguma
 * coisa, e ela não olhava para onde o silêncio custa mais: até 7/set/2026 nove
 * workers não guardavam nada sobre o próprio ciclo, e um que falhasse todo dia
 * aparecia verde para sempre.
 *
 * Agora que eles reportam, a verificação existe — e as escolhas dela são
 * deliberadas:
 *
 * - **o estado sai só de `saudavel === false`**, que é falha medida. `enabled`
 *   ficou de fora porque em Vercel Functions worker nenhum roda, e tratar isso
 *   como problema encheria o painel de alarme falso onde não há o que alarmar;
 * - **`na` quando nada rodou ainda** — não `ok`. Verde sem medição é a mesma
 *   mentira das telas de métrica;
 * - **o nome de quem falhou vai na mensagem**, para o alerta não obrigar
 *   ninguém a abrir outra tela para descobrir o que ele já sabe.
 */
describe('painel de saúde — os workers', () => {
  afterAll(async () => {
    await fs.rm(TMP_DIR, { recursive: true, force: true }).catch(() => {});
  });

  it('a verificação existe', async () => {
    const snap = await buildSnapshot();
    const w = snap.checks.find((c) => c.id === 'workers');
    expect(w, 'o painel de saúde voltou a não perguntar pelos workers').toBeDefined();
    expect(w!.label).toBe('Workers');
  });

  it('sem nenhum ciclo completo, responde `na` — nunca `ok`', async () => {
    // Nenhum worker foi iniciado nesta suíte: a resposta honesta é "não medi".
    const snap = await buildSnapshot();
    const w = snap.checks.find((c) => c.id === 'workers')!;
    expect(w.status).toBe('na');
    expect(w.message).toMatch(/nenhum ciclo/i);
  });

  it('a métrica diz quantos já rodaram, sobre o total', async () => {
    const snap = await buildSnapshot();
    const w = snap.checks.find((c) => c.id === 'workers')!;
    // O denominador é o que dá sentido ao numerador — mesma regra do
    // "58% de 10.205 matrículas" que denunciou o número inventado.
    expect(String(w.metric)).toMatch(/^\d+\/13$/);
  });

  it('worker falhando derruba a verificação e é NOMEADO na mensagem', async () => {
    const inventario = await import('../server/jobs/inventario');
    const original = inventario.listarJobs;
    const espiao = vi.spyOn(inventario, 'listarJobs').mockImplementation(() => {
      const jobs = original();
      return jobs.map((j) =>
        j.name === 'access-expiry' ? { ...j, saudavel: false as const } : j,
      );
    });

    const snap = await buildSnapshot();
    const w = snap.checks.find((c) => c.id === 'workers')!;
    expect(w.status).toBe('error');
    // "algum worker falhou" não serve; o operador precisa saber qual.
    expect(w.message).toMatch(/vencimento|acesso/i);
    // E o pior estado tem de subir para o agregado, senão a tela abre verde.
    expect(snap.overall).toBe('error');

    espiao.mockRestore();
  });

  it('worker saudável não vira alarme', async () => {
    const inventario = await import('../server/jobs/inventario');
    const original = inventario.listarJobs;
    const espiao = vi
      .spyOn(inventario, 'listarJobs')
      .mockImplementation(() => original().map((j) => ({ ...j, saudavel: true as const })));

    const snap = await buildSnapshot();
    const w = snap.checks.find((c) => c.id === 'workers')!;
    expect(w.status).toBe('ok');
    expect(w.metric).toBe('13/13');

    espiao.mockRestore();
  });
});

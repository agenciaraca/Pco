/**
 * O rotador de log não pode reportar saúde vigiando um arquivo que não existe.
 *
 * Ele existe por um motivo específico: o disco cheio não derruba só o log,
 * derruba a aplicação. E `rotateIfNeeded` devolvia `false` em dois casos
 * diferentes — "não precisou rotacionar" e "o arquivo nem existe". Achatados,
 * o segundo passava por saúde: o worker rodava, contava e reportava sucesso
 * sobre o nada. É a assinatura de defeito deste projeto, e desta vez no worker
 * que serve de última defesa do disco.
 *
 * **Medido em produção em 9/set/2026**, e por isso não é hipótese: o alvo é
 * `~/ava-pco/app.log`, parado desde 24/jul, enquanto o log vivo da aplicação é
 * `~/.pm2/logs/ava-pco-out.log` — que cresce e não tem rotação nenhuma, porque
 * o `pm2-logrotate` não está instalado. Desde que o PM2 assumiu o processo,
 * este worker olha para o arquivo errado.
 *
 * O conserto **não** é apontar para o log do PM2: rotacionar por baixo de um
 * processo que mantém o descritor aberto é troca de um problema por outro. O
 * conserto é o worker dizer que não está vigiando nada, e o painel mostrar.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
const ENV_ORIGINAL = process.env.APP_LOG_PATH;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-log-'));
  vi.resetModules();
});

afterEach(async () => {
  if (ENV_ORIGINAL === undefined) delete process.env.APP_LOG_PATH;
  else process.env.APP_LOG_PATH = ENV_ORIGINAL;
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
  vi.resetModules();
});

/** Carrega o worker com o alvo apontado para `arquivo`. */
async function carregar(arquivo: string) {
  process.env.APP_LOG_PATH = arquivo;
  vi.resetModules();
  return await import('../server/services/log-rotator');
}

describe('rotador de log', () => {
  it('antes do primeiro ciclo, não afirma nada', async () => {
    const m = await carregar(path.join(tmpDir, 'existe.log'));
    m._resetParaTeste();
    expect(
      m.getStatus().alvoExiste,
      '`null` é "ainda não olhei" — o primeiro ciclo só acontece 5 min após o boot',
    ).toBeNull();
  });

  it('alvo ausente é reportado como ausente, não como "nada a fazer"', async () => {
    // Este é o caso que estava achatado: sem arquivo, o ciclo devolvia `false`
    // igualzinho a "olhei e ainda não passou de 10MB".
    const alvo = path.join(tmpDir, 'nao-existe.log');
    const m = await carregar(alvo);
    m._resetParaTeste();
    m.startWorker(1);
    await new Promise((r) => setTimeout(r, 30));
    m.stopWorker();
    expect(m.getStatus().alvoExiste).toBe(false);
    // E continua sem ter rotacionado nada — as duas coisas são verdade ao
    // mesmo tempo, e é por isso que precisam de campos diferentes.
    expect(m.getStatus().totalRotations).toBe(0);
  });

  it('alvo presente é reportado como presente', async () => {
    const alvo = path.join(tmpDir, 'existe.log');
    await fs.writeFile(alvo, 'linha\n', 'utf8');
    const m = await carregar(alvo);
    m._resetParaTeste();
    m.startWorker(1);
    await new Promise((r) => setTimeout(r, 30));
    m.stopWorker();
    expect(m.getStatus().alvoExiste).toBe(true);
    // E não rotacionou: o arquivo é pequeno. Os dois estados convivem, que é
    // justamente o que estava achatado.
    expect(m.getStatus().totalRotations).toBe(0);
  });

  it('o painel avisa quando o rotador vigia um caminho que não existe', async () => {
    const alvo = path.join(tmpDir, 'sumiu.log');
    const m = await carregar(alvo);
    m._resetParaTeste();
    m.startWorker(1);
    await new Promise((r) => setTimeout(r, 30));
    m.stopWorker();

    const { buildSnapshot } = await import('../server/health/dashboard');
    const snap = await buildSnapshot();
    const check = snap.checks.find((c) => c.id === 'log-rotator');
    expect(check, 'o painel não avisa que o rotador está sem alvo').toBeTruthy();
    expect(check!.status).toBe('warn');
    // O caminho vai na mensagem: é ele que diz o que consertar.
    expect(check!.message).toContain(alvo);
  });

  it('com alvo válido o painel não põe aviso nenhum', async () => {
    const alvo = path.join(tmpDir, 'ok.log');
    await fs.writeFile(alvo, 'linha\n', 'utf8');
    const m = await carregar(alvo);
    m._resetParaTeste();
    m.startWorker(1);
    await new Promise((r) => setTimeout(r, 30));
    m.stopWorker();

    const { buildSnapshot } = await import('../server/health/dashboard');
    const snap = await buildSnapshot();
    expect(snap.checks.find((c) => c.id === 'log-rotator')).toBeUndefined();
  });
});

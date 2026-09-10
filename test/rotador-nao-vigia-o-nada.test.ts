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

  it('alvo que existe mas está PARADO também é vigiar o nada', async () => {
    // Este é o caso real de produção, e o que a primeira versão da correção
    // não pegava: o arquivo existe (918 kB), tem cara de log, e não recebe uma
    // linha desde 24/jul — porque desde que o PM2 assumiu, a aplicação escreve
    // em outro lugar. Ausente é fácil de ver; morto não é.
    const alvo = path.join(tmpDir, 'parado.log');
    await fs.writeFile(alvo, 'linha antiga\n', 'utf8');
    const antigo = new Date(Date.now() - 47 * 86_400_000);
    await fs.utimes(alvo, antigo, antigo);

    const m = await carregar(alvo);
    m._resetParaTeste();
    m.startWorker(1);
    await new Promise((r) => setTimeout(r, 30));
    m.stopWorker();
    expect(m.getStatus().alvoExiste, 'o arquivo existe — não é o caso de ausente').toBe(true);

    const { buildSnapshot } = await import('../server/health/dashboard');
    const check = (await buildSnapshot()).checks.find((c) => c.id === 'log-rotator');
    expect(check, 'log morto passou por saudável').toBeTruthy();
    expect(check!.status).toBe('warn');
    expect(check!.message).toMatch(/não recebe uma linha há \d+ dias/);
    expect(check!.metric).toBeGreaterThanOrEqual(47);
  });

  /*
    Sob PM2 o aviso passou a ser MENTIRA, e nunca mais se apagaria sozinho.

    Em 10/set/2026 o `pm2-logrotate` foi instalado no servidor. A partir dali a
    frase do painel — "esse outro lugar não tem rotação" — ficou falsa; e o
    arquivo vigiado continua parado para sempre, por desenho, porque o stdout
    da aplicação vai para `~/.pm2/logs`.

    Um alarme que descreve o estado permanente e correto do sistema não é
    alarme: é o ruído que faz alguém ignorar a tela inteira. E trocá-lo por
    "ok" seria a mentira oposta — de dentro do processo não dá para afirmar
    que o módulo do PM2 está instalado, porque essa informação não mora aqui.

    Daí `na` com o comando que responde. É a mesma regra das telas de métrica:
    ausência de medição não vira verde nem vermelho.
  */
  describe('sob PM2, a rotação é do gerenciador do processo', () => {
    afterEach(() => {
      delete process.env.pm_id;
    });

    it('alvo morto deixa de ser aviso e vira "não medi"', async () => {
      const alvo = path.join(tmpDir, 'sob-pm2.log');
      await fs.writeFile(alvo, 'linha antiga\n', 'utf8');
      const antigo = new Date(Date.now() - 47 * 86_400_000);
      await fs.utimes(alvo, antigo, antigo);

      const m = await carregar(alvo);
      m._resetParaTeste();
      m.startWorker(1);
      await new Promise((r) => setTimeout(r, 30));
      m.stopWorker();

      process.env.pm_id = '0';
      const { buildSnapshot } = await import('../server/health/dashboard');
      const check = (await buildSnapshot()).checks.find((c) => c.id === 'log-rotator');
      expect(check, 'o painel deixou de dizer qualquer coisa sobre rotação').toBeTruthy();
      expect(check!.status).toBe('na');
    });

    it('e não afirma que existe rotação — diz onde conferir', async () => {
      const alvo = path.join(tmpDir, 'sob-pm2-2.log');
      const m = await carregar(alvo);
      m._resetParaTeste();
      m.startWorker(1);
      await new Promise((r) => setTimeout(r, 30));
      m.stopWorker();

      process.env.pm_id = '0';
      const { buildSnapshot } = await import('../server/health/dashboard');
      const check = (await buildSnapshot()).checks.find((c) => c.id === 'log-rotator');
      // Afirmar que está rotacionando seria tão errado quanto afirmar que não
      // está: o painel entrega o comando e sai da frente.
      expect(check!.message).toContain('pm2 conf pm2-logrotate');
      expect(check!.message).toMatch(/~\/\.pm2\/logs/);
    });

    it('fora do PM2 o aviso continua valendo — o caso não desapareceu', async () => {
      const alvo = path.join(tmpDir, 'fora-do-pm2.log');
      const m = await carregar(alvo);
      m._resetParaTeste();
      m.startWorker(1);
      await new Promise((r) => setTimeout(r, 30));
      m.stopWorker();

      delete process.env.pm_id;
      const { buildSnapshot } = await import('../server/health/dashboard');
      const check = (await buildSnapshot()).checks.find((c) => c.id === 'log-rotator');
      expect(check!.status).toBe('warn');
    });
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

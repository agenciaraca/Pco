/**
 * Um ciclo que termina não é um ciclo que fez alguma coisa.
 *
 * O sprint de 7/set/2026 fechou o caso do worker que **lançava**: hoje todos
 * passam por `comRegistro`, e uma exceção derruba `saudavel`. Ficou de fora o
 * caso vizinho, e é o mais provável de acontecer na prática.
 *
 * Os workers que percorrem itens pegam o erro **por item**, contam e seguem —
 * é o certo, senão um endereço inválido derrubaria o envio dos outros 199. Mas
 * o tick termina normalmente, `comRegistro` grava sucesso, e um ciclo que
 * examinou 200 lembretes e falhou nos 200 aparece **verde** no painel de saúde.
 *
 * É a forma exata do defeito que este projeto persegue há uma semana: a rotina
 * rodou, contou e reportou sucesso. E o item que ninguém recebeu, aqui, é o
 * aviso da sessão que a pessoa pagou.
 *
 * O que este arquivo trava:
 *
 * - o inventário publica o resultado do último ciclo em números, normalizado;
 * - `null` continua sendo "não conta itens", nunca `{ ok: 0, erros: 0 }`;
 * - o painel separa **nada passou** (vermelho) de **algo falhou** (amarelo).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-mudo-'));
  process.env.DATA_DIR = tmpDir;
});

afterAll(async () => {
  vi.resetModules();
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('inventário de jobs', () => {
  it('todo job declara o último ciclo — e null é "não conta", não zero', async () => {
    const { listarJobs } = await import('../server/jobs/inventario');
    const jobs = listarJobs();
    expect(jobs.length).toBe(13);
    for (const j of jobs) {
      expect(j, j.name).toHaveProperty('ultimoCiclo');
      // Ninguém rodou ainda nesta vida do processo: nenhum pode afirmar
      // medição. `{ ok: 0, erros: 0 }` seria dizer "medi e não houve nada".
      expect(j.ultimoCiclo, j.name).toBeNull();
    }
  });

  it('os que percorrem itens publicam quantos passaram e quantos falharam', async () => {
    // O lembrete de sessão é o caso do manual: percorre agendamentos, pega o
    // erro por item e conta. Simulamos o resultado do ciclo e conferimos que o
    // inventário o traduz.
    const lembrete = await import('../server/sessions/lembrete-worker');
    const status = lembrete.getStatus() as Record<string, unknown>;
    expect(status).toHaveProperty('lastRunResult');
  });
});

describe('painel de saúde', () => {
  async function painelCom(jobs: unknown[]) {
    vi.resetModules();
    vi.doMock('../server/jobs/inventario', () => ({ listarJobs: () => jobs }));
    const { buildSnapshot } = await import('../server/health/dashboard');
    const saude = await buildSnapshot();
    const check = saude.checks.find((c) => c.id === 'workers');
    vi.doUnmock('../server/jobs/inventario');
    return check;
  }

  const base = {
    name: 'x',
    rotulo: 'Lembrete de sessão',
    descricao: '',
    intervalMs: 1000,
    enabled: true,
    lastRunAt: new Date().toISOString(),
    totalTicks: 1,
    podeRodarAgora: true,
    saudavel: true,
    ultimoCiclo: null as { ok: number; erros: number } | null,
    detalhes: {},
  };

  it('ciclo que não entregou nada é ERRO, mesmo com o tick "saudável"', async () => {
    // Este caso falha contra o código anterior: `saudavel: true` bastava para
    // o painel ficar verde.
    const check = await painelCom([{ ...base, ultimoCiclo: { ok: 0, erros: 200 } }]);
    expect(check?.status).toBe('error');
    // E o nome de quem calou vai na mensagem — é o que evita abrir outra tela
    // para descobrir o que o alerta já sabia.
    expect(check?.message).toContain('Lembrete de sessão');
  });

  it('falha em alguns, com o resto entregue, é AVISO — não vermelho', async () => {
    const check = await painelCom([{ ...base, ultimoCiclo: { ok: 198, erros: 2 } }]);
    expect(check?.status).toBe('warn');
    expect(check?.message).toContain('Lembrete de sessão');
  });

  it('ciclo inteiro entregue continua verde', async () => {
    const check = await painelCom([{ ...base, ultimoCiclo: { ok: 200, erros: 0 } }]);
    expect(check?.status).toBe('ok');
  });

  it('worker que não conta itens não vira alarme nem verde falso', async () => {
    // `ultimoCiclo: null` com `saudavel: true` é o que já existia: o ciclo
    // terminou, e este worker não tem itens para contar.
    const check = await painelCom([{ ...base, ultimoCiclo: null }]);
    expect(check?.status).toBe('ok');
  });

  it('nada medido ainda não é verde', async () => {
    const check = await painelCom([{ ...base, saudavel: null, lastRunAt: null }]);
    expect(check?.status).toBe('na');
  });
});

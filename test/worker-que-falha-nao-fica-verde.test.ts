/**
 * Um worker que falha todo ciclo aparecia verde no painel.
 *
 * Os treze seguem o mesmo molde: `setInterval` chamando um tick assíncrono,
 * com o erro engolido para que um ciclo ruim não derrube o processo. A parte
 * engolida está certa. O que estava errado é o que sobrava depois: o tick
 * gravava `lastRunAt`/`lastRunResult` **no fim**, então uma exceção pulava a
 * gravação e o `.catch(() => {})` apagava o rastro. O status ficava com o
 * último resultado BEM-SUCEDIDO, `enabled` seguia `true`, e `/admin/jobs`
 * mostrava um worker saudável com um carimbo de hora velho. Ninguém vigia
 * carimbo de hora.
 *
 * Nove dos treze estavam assim, e `server/jobs/inventario.ts` os declarava
 * `saudavel: null` — literal fixo no código, não leitura do worker. Entre eles:
 * o que avisa o aluno que o acesso vence, o que lembra da sessão paga, e os
 * dois que mandam e-mail para aluno.
 *
 * É a mesma classe do `catch` vazio da sondagem da Sandra, que fez pagamento
 * real deixar de virar matrícula em silêncio.
 *
 * **E o dispatcher de webhooks era pior:** as duas chamadas do `startWorker`
 * eram `void tickWorker()` sem `catch` nenhum. Rejeição não tratada derruba o
 * processo por padrão no Node desde a v15 — a falha não era só invisível, era
 * capaz de matar a aplicação.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  novoRegistro,
  comRegistro,
  zerarRegistro,
  type RegistroDeTick,
} from '../server/jobs/registro-de-tick';
import { listarJobs } from '../server/jobs/inventario';

describe('registro de tick', () => {
  let reg: RegistroDeTick;
  beforeEach(() => {
    reg = novoRegistro();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('nasce sem medição — `null` não é "ok"', () => {
    expect(reg.saudavel).toBeNull();
    expect(reg.falhasSeguidas).toBe(0);
    expect(reg.ultimaFalha).toBeNull();
  });

  it('nunca lança: o setInterval continua vivo, como antes', async () => {
    await expect(
      comRegistro(reg, async () => {
        throw new Error('store fora do ar');
      }, 'teste'),
    ).resolves.toBeUndefined();
  });

  it('a falha passa a EXISTIR no status, em vez de sumir', async () => {
    await comRegistro(reg, async () => {
      throw new Error('store fora do ar');
    }, 'teste');
    expect(reg.saudavel).toBe(false);
    expect(reg.falhasSeguidas).toBe(1);
    expect(reg.ultimaFalha).toBe('store fora do ar');
    expect(reg.ultimaFalhaEm).toBeTruthy();
  });

  it('falhas seguidas contam — é o que separa soluço de worker quebrado', async () => {
    for (let i = 0; i < 3; i++) {
      await comRegistro(reg, async () => {
        throw new Error('x');
      }, 'teste');
    }
    expect(reg.falhasSeguidas).toBe(3);
  });

  it('um sucesso zera a contagem e devolve a saúde', async () => {
    await comRegistro(reg, async () => {
      throw new Error('x');
    }, 'teste');
    await comRegistro(reg, async () => undefined, 'teste');
    expect(reg.saudavel).toBe(true);
    expect(reg.falhasSeguidas).toBe(0);
    // A última falha CONTINUA registrada: ela aconteceu, e apagá-la ao primeiro
    // sucesso esconderia um worker que alterna entre falhar e funcionar.
    expect(reg.ultimaFalha).toBe('x');
  });

  it('zerar devolve ao estado de "ainda não rodou"', async () => {
    await comRegistro(reg, async () => {
      throw new Error('x');
    }, 'teste');
    zerarRegistro(reg);
    expect(reg.saudavel).toBeNull();
    expect(reg.ultimaFalha).toBeNull();
  });
});

describe('todo worker sabe dizer se falhou', () => {
  it('os treze expõem `saudavel` no status', () => {
    const jobs = listarJobs();
    expect(jobs.length).toBe(13);
    const mudos = jobs.filter((j) => !('saudavel' in j.detalhes));
    expect(
      mudos.map((j) => j.name),
      'estes workers não têm como reportar que um ciclo falhou:\n  ' +
        mudos.map((j) => j.name).join('\n  '),
    ).toEqual([]);
  });

  it('e nenhum deles nasce verde sem ter rodado', () => {
    // Nada rodou nesta vida do processo: `null` é a resposta certa. Verde aqui
    // seria afirmar saúde sem medição — a mesma regra das telas de métrica.
    for (const j of listarJobs()) {
      expect(j.saudavel, `${j.name} nasceu afirmando saúde`).not.toBe(true);
    }
  });

  it('o inventário não fixa `saudavel: null` no código', async () => {
    // Era assim que nove workers ficavam mudos sem que ninguém percebesse: a
    // ausência de medição estava escrita no painel, não no worker. Worker novo
    // que chegue com o literal fixo falha aqui.
    const fonte = await fs.readFile(
      path.join(process.cwd(), 'server', 'jobs', 'inventario.ts'),
      'utf8',
    );
    const bloco = fonte.slice(fonte.indexOf('export function listarJobs'));
    expect(bloco).not.toMatch(/saudavel:\s*null,/);
  });
});

describe('nenhum tick de worker é chamado sem registro', () => {
  const WORKERS = [
    'server/webhooks/dispatcher.ts',
    'server/imports/schedules-worker.ts',
    'server/sessions/lembrete-worker.ts',
    'server/notifications/admin-digest.ts',
    'server/notifications/weekly-report.ts',
    'server/notifications/student-progress-email.ts',
    'server/services/log-rotator.ts',
    'server/services/retention-worker.ts',
    'server/reengagement/worker.ts',
    'server/access/expiry-worker.ts',
  ];

  it('o `startWorker` de cada um passa por `comRegistro`', async () => {
    const semRegistro: string[] = [];
    for (const rel of WORKERS) {
      const fonte = await fs.readFile(path.join(process.cwd(), rel), 'utf8');
      const i = fonte.indexOf('export function startWorker');
      const bloco = fonte.slice(i, fonte.indexOf('\n}', i));
      if (!bloco.includes('comRegistro')) semRegistro.push(rel);
    }
    expect(
      semRegistro,
      'o tick destes volta a sumir quando lançar:\n  ' + semRegistro.join('\n  '),
    ).toEqual([]);
  });
});

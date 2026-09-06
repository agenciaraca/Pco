import { describe, it, expect } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { listarJobs } from '../server/jobs/inventario';

/**
 * Worker que o servidor inicia e a tela não mostra é worker que ninguém vigia.
 *
 * `/admin/jobs` montava **cinco** `getStatus()` escritos à mão dentro da rota,
 * enquanto `server/dev.ts` inicia **doze**. Os sete de fora não apareciam em
 * lugar nenhum do produto:
 *
 * - o **backup**, que é a última linha de defesa da base inteira;
 * - a **rotação de log**, cuja falha enche o disco do servidor;
 * - o **recálculo de risco**, que alimenta a tela de evasão;
 * - e o **sondador da Sandra**, que é o *único* confirmador de pagamento
 *   daquele gateway — o `charge.paid` não existe do lado dela. Worker parado
 *   ali é pagamento real que não vira matrícula, em silêncio.
 *
 * O `CLAUDE.md` teve o mesmo defeito (listava cinco de doze) e foi corrigido em
 * 3/set/2026. A tela ficou para trás — documentação e produto discordando sobre
 * um fato que dá para verificar lendo o arquivo de boot. É o que este teste faz.
 */

/** Os `startWorker(...)` que o servidor de verdade chama no boot. */
async function workersDoBoot(): Promise<string[]> {
  const fonte = await fs.readFile(path.join(process.cwd(), 'server', 'dev.ts'), 'utf8');
  const modulos: string[] = [];
  // `[^)]*` nao serve: `.then((m) => m.startWorker` tem um `)` no meio.
  for (const m of fonte.matchAll(/import\(['"]\.\/([^'"]+)['"]\)[\s\S]{0,120}?startWorker/g)) {
    modulos.push(m[1]!);
  }
  return modulos.sort();
}

/** O módulo de cada job, para casar com o que o boot importa. */
const MODULO_POR_JOB: Record<string, string> = {
  webhooks: 'webhooks/dispatcher',
  reengagement: 'reengagement/worker',
  'imports-scheduler': 'imports/schedules-worker',
  'admin-digest': 'notifications/admin-digest',
  'weekly-report': 'notifications/weekly-report',
  'student-progress-email': 'notifications/student-progress-email',
  backup: 'db/backup-worker',
  'retention-recompute': 'services/retention-worker',
  'access-expiry': 'access/expiry-worker',
  'session-reminders': 'sessions/lembrete-worker',
  'sandra-poll': 'payments/sandra-poll-worker',
  'log-rotator': 'services/log-rotator',
  'checkout-alerta': 'payments/alerta-checkout-worker',
};

describe('todo worker que o servidor inicia aparece em /admin/jobs', () => {
  it('a lista da tela cobre exatamente os `startWorker` do boot', async () => {
    const doBoot = await workersDoBoot();
    const naTela = listarJobs()
      .map((j) => MODULO_POR_JOB[j.name])
      .filter((m): m is string => Boolean(m))
      .sort();

    const invisiveis = doBoot.filter((m) => !naTela.includes(m));
    expect(
      invisiveis,
      'estes workers rodam no servidor e NÃO aparecem em /admin/jobs:\n  ' +
        invisiveis.join('\n  '),
    ).toEqual([]);

    const fantasmas = naTela.filter((m) => !doBoot.includes(m));
    expect(
      fantasmas,
      'estes jobs aparecem na tela e NÃO são iniciados pelo servidor:\n  ' + fantasmas.join('\n  '),
    ).toEqual([]);
  });

  it('e o boot inicia mais de dez — senão o caso acima passaria por acidente', async () => {
    // Guarda contra o próprio teste: se o regex parar de casar, `doBoot` fica
    // vazio, nada é "invisível" e a comparação vira decoração.
    expect((await workersDoBoot()).length).toBeGreaterThan(10);
  });

  it('todo job tem nome, rótulo e intervalo — nada de "NaN dia(s)"', () => {
    // O card sem nome que apareceu em produção: a rota espalhava o status da
    // Sandra, que devolve `nome` e não `name`, sem `intervalMs` e sem
    // `totalTicks`. A tela mostrava título vazio, "NaN dia(s)" e "undefined".
    for (const j of listarJobs()) {
      expect(j.name, 'job sem identificador').toBeTruthy();
      expect(j.rotulo, `job ${j.name} sem rótulo`).toBeTruthy();
      expect(j.descricao.length, `job ${j.name} sem descrição`).toBeGreaterThan(20);
      expect(Number.isFinite(j.intervalMs), `job ${j.name} com intervalo inválido`).toBe(true);
      expect(j.intervalMs, `job ${j.name} com intervalo zero`).toBeGreaterThan(0);
    }
  });

  it('identificador é único e serve para o "rodar agora"', () => {
    const nomes = listarJobs().map((j) => j.name);
    expect(new Set(nomes).size).toBe(nomes.length);
  });

  it('saúde `null` quer dizer "não medido", e é o padrão de quem não sabe', () => {
    // Zero e travessão são coisas diferentes — a mesma regra das telas de
    // métrica. Um job que não sabe dizer da própria saúde não pode aparecer
    // como saudável.
    const semMedicao = listarJobs().filter((j) => j.saudavel === null);
    expect(semMedicao.length).toBeGreaterThan(0);
    for (const j of listarJobs()) {
      expect([true, false, null], `job ${j.name} com saúde inválida`).toContain(j.saudavel);
    }
  });
});

// Os workers que rodam dentro do servidor, e o que cada um sabe dizer de si.
//
// ## Por que este arquivo existe
//
// `/admin/jobs` montava a resposta com **cinco** `getStatus()` escritos à mão
// dentro da rota. São **doze** workers. Os sete de fora não apareciam em tela
// nenhuma: quem olhava o painel para decidir o que acontece num restart
// subestimava a superfície por mais da metade — e entre os invisíveis estavam
// o backup, a rotação de log, a retenção e, pior, o **sondador da Sandra**, que
// é o único confirmador de pagamento daquele gateway.
//
// O `CLAUDE.md` teve exatamente este defeito e foi corrigido em 3/set/2026. A
// tela ficou para trás — documentação e produto discordando sobre um fato
// verificável.
//
// ## Por que adaptador por worker, e não um normalizador esperto
//
// Os doze `getStatus()` não concordam entre si: uns dizem `name`, o da Sandra
// diz `nome`; uns têm `lastRunAt`, outros `lastTickAt`, `lastRotatedAt` ou
// `ultimaExecucao`; uns contam `totalTicks`, outros `totalRotations`, outros
// não contam. Um normalizador que adivinha campo por heurística esconde essa
// divergência e quebra em silêncio quando alguém renomear um campo.
//
// Aqui cada adaptador é uma linha explícita. Se um worker mudar de forma, o
// TypeScript reclama **neste arquivo**, que é onde alguém está olhando.
//
// Foi o que produziu o card sem nome em produção: a rota espalhava
// `sandraPoll.getStatus()`, que devolve `nome` e não `name`, sem `intervalMs`
// e sem `totalTicks` — a tela mostrava título vazio, "NaN dia(s)" e
// "undefined".

import * as webhooksDispatcher from '../webhooks/dispatcher';
import * as reengagementWorker from '../reengagement/worker';
import * as expiryWorker from '../access/expiry-worker';
import * as lembreteWorker from '../sessions/lembrete-worker';
import * as sandraPoll from '../payments/sandra-poll-worker';
import * as schedulesWorker from '../imports/schedules-worker';
import * as adminDigest from '../notifications/admin-digest';
import * as weeklyReport from '../notifications/weekly-report';
import * as progressEmail from '../notifications/student-progress-email';
import * as backupWorker from '../db/backup-worker';
import * as retentionWorker from '../services/retention-worker';
import * as logRotator from '../services/log-rotator';

const MIN = 60_000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;

export interface JobStatus {
  /** Identificador estável. É o que `/admin/jobs/:name/run` recebe. */
  name: string;
  /** Como a pessoa chama isto. */
  rotulo: string;
  /** O que ele faz, em uma frase — a tela não deve exigir ler código. */
  descricao: string;
  /** De quanto em quanto tempo o tick dispara. */
  intervalMs: number;
  /** O worker está de pé neste processo? */
  enabled: boolean;
  /** Última vez que rodou. `null` = ainda não rodou nesta vida do processo. */
  lastRunAt: string | null;
  /** Quantos ticks já deu. `null` = este worker não conta. */
  totalTicks: number | null;
  /** Dá para disparar à mão pela tela? */
  podeRodarAgora: boolean;
  /**
   * Saúde, quando o worker sabe dizer. `null` é **"não medido"**, não "ok" —
   * a mesma regra das telas de métrica.
   */
  saudavel: boolean | null;
  /** O status cru do worker, para a tela mostrar o que for específico dele. */
  detalhes: Record<string, unknown>;
}

function texto(v: unknown): string | null {
  return typeof v === 'string' && v ? v : null;
}
function numero(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Os doze, na ordem em que `server/dev.ts` os inicia.
 *
 * `test/jobs-inventario.test.ts` compara esta lista com os `startWorker` do
 * `dev.ts` e falha se divergirem — foi assim que sete deles ficaram invisíveis
 * por meses sem ninguém notar.
 */
export function listarJobs(): JobStatus[] {
  const jobs: JobStatus[] = [];

  {
    const s = webhooksDispatcher.getStatus();
    jobs.push({
      name: 'webhooks',
      rotulo: 'Webhooks de saída',
      descricao: 'Entrega os eventos na fila para os endpoints configurados.',
      intervalMs: numero(s.intervalMs) ?? 30_000,
      enabled: s.enabled,
      lastRunAt: texto(s.lastRunAt),
      totalTicks: numero(s.totalTicks),
      podeRodarAgora: true,
      saudavel: s.falhasAoEnfileirar > 0 ? false : true,
      detalhes: { ...s },
    });
  }

  {
    const s = sandraPoll.getStatus();
    jobs.push({
      name: 'sandra-poll',
      rotulo: 'Sondagem da Sandra',
      // A frase é longa de propósito: é o único worker cuja parada custa
      // dinheiro em silêncio, e quem olha a tela precisa saber disso ali.
      descricao:
        'Confirma pagamento no gateway da Sandra. É o ÚNICO confirmador dela — o gateway ainda não emite aviso.',
      intervalMs: 5 * MIN,
      enabled: true,
      lastRunAt: texto(s.ultimaExecucao),
      totalTicks: null,
      podeRodarAgora: true,
      saudavel: s.saudavel ?? null,
      detalhes: { ...s },
    });
  }

  {
    const s = schedulesWorker.getStatus();
    jobs.push({
      name: 'imports-scheduler',
      rotulo: 'Importações agendadas',
      descricao: 'Dispara as importações programadas quando chega a hora delas.',
      intervalMs: MIN,
      enabled: s.enabled,
      lastRunAt: texto(s.lastTickAt),
      totalTicks: numero(s.totalTicks),
      podeRodarAgora: false,
      saudavel: null,
      detalhes: { ...s },
    });
  }

  {
    const s = lembreteWorker.getStatus();
    jobs.push({
      name: 'session-reminders',
      rotulo: 'Lembrete de sessão',
      descricao: 'Avisa aluno e profissional das sessões que estão para acontecer.',
      intervalMs: numero(s.intervalMs) ?? 15 * MIN,
      enabled: s.enabled,
      lastRunAt: texto(s.lastRunAt),
      totalTicks: numero(s.totalTicks),
      podeRodarAgora: true,
      saudavel: null,
      detalhes: { ...s },
    });
  }

  {
    const s = adminDigest.getStatus();
    jobs.push({
      name: 'admin-digest',
      rotulo: 'Resumo para a administração',
      descricao: 'Manda o resumo diário para quem administra, na hora configurada.',
      intervalMs: 30 * MIN,
      enabled: s.enabled,
      lastRunAt: texto(s.lastRunAt),
      totalTicks: null,
      podeRodarAgora: false,
      saudavel: null,
      detalhes: { ...s },
    });
  }

  {
    const s = weeklyReport.getStatus();
    jobs.push({
      name: 'weekly-report',
      rotulo: 'Relatório semanal',
      descricao: 'Envia o relatório da semana para a administração.',
      intervalMs: HORA,
      enabled: s.enabled,
      lastRunAt: texto(s.lastRunAt),
      totalTicks: null,
      podeRodarAgora: false,
      saudavel: null,
      detalhes: { ...s },
    });
  }

  {
    const s = progressEmail.getStatus();
    jobs.push({
      name: 'student-progress-email',
      rotulo: 'Progresso do aluno por e-mail',
      descricao: 'Manda ao aluno o resumo do que ele avançou.',
      intervalMs: HORA,
      enabled: true,
      lastRunAt: texto(s.lastRunAt),
      totalTicks: null,
      podeRodarAgora: false,
      saudavel: null,
      detalhes: { ...s },
    });
  }

  {
    const s = backupWorker.getStatus();
    jobs.push({
      name: 'backup',
      rotulo: 'Backup',
      descricao: 'Copia os arquivos do DATA_DIR e despeja as tabelas do Postgres.',
      intervalMs: HORA,
      enabled: s.enabled,
      lastRunAt: texto(s.lastRunAt),
      totalTicks: null,
      podeRodarAgora: true,
      saudavel: s.saudavel,
      detalhes: { ...s },
    });
  }

  {
    const s = logRotator.getStatus();
    jobs.push({
      name: 'log-rotator',
      rotulo: 'Rotação de log',
      descricao: 'Corta o arquivo de log antes que ele encha o disco.',
      intervalMs: HORA,
      enabled: s.enabled,
      lastRunAt: texto(s.lastRotatedAt),
      totalTicks: numero(s.totalRotations),
      podeRodarAgora: false,
      saudavel: null,
      detalhes: { ...s },
    });
  }

  {
    const s = retentionWorker.getStatus();
    jobs.push({
      name: 'retention-recompute',
      rotulo: 'Recálculo de risco',
      descricao: 'Recalcula o risco de evasão de cada aluno.',
      intervalMs: 6 * HORA,
      enabled: s.enabled,
      lastRunAt: texto(s.lastTickAt),
      totalTicks: numero(s.totalTicks),
      podeRodarAgora: false,
      saudavel: null,
      detalhes: { ...s },
    });
  }

  {
    const s = reengagementWorker.getStatus();
    jobs.push({
      name: 'reengagement',
      rotulo: 'Reengajamento',
      descricao: 'Escreve para quem parou de estudar.',
      intervalMs: numero(s.intervalMs) ?? DIA,
      enabled: s.enabled,
      lastRunAt: texto(s.lastRunAt),
      totalTicks: numero(s.totalTicks),
      podeRodarAgora: true,
      saudavel: null,
      detalhes: { ...s },
    });
  }

  {
    const s = expiryWorker.getStatus();
    jobs.push({
      name: 'access-expiry',
      rotulo: 'Aviso de vencimento de acesso',
      descricao: 'Avisa quem está para perder o acesso — 30, 7 e 1 dia antes.',
      intervalMs: numero(s.intervalMs) ?? DIA,
      enabled: s.enabled,
      lastRunAt: texto(s.lastRunAt),
      totalTicks: numero(s.totalTicks),
      podeRodarAgora: true,
      saudavel: null,
      detalhes: { ...s },
    });
  }

  return jobs;
}

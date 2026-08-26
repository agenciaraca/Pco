/**
 * Lembrete de sessão — "sua sessão é amanhã".
 *
 * Os avisos de `avisos.ts` reagem a mudanças: reservou, confirmou, cancelou,
 * remarcou. Nenhum deles fala quando **nada** muda, que é justamente o caso da
 * sessão marcada semanas antes e esquecida. Falta a alguém é o custo mais caro
 * de uma agenda de atendimento: a hora do profissional já foi reservada.
 *
 * Duas faixas, um lembrete cada: 24 horas antes e 1 hora antes. Como no worker
 * de vencimento, um ledger guarda (agendamento, faixa) para que o tick horário
 * não vire vinte e-mails.
 *
 * Só lembra sessão que está de pé — `confirmed` ou `scheduled`. Sessão
 * aguardando pagamento não recebe lembrete de comparecer a uma hora que ainda
 * não está garantida; cancelada, muito menos.
 */

import { JsonStore } from '../db/json-store';
import * as bookingsRepo from './bookings-repo';
import * as notificationsRepo from '../repositories/notifications';
import { sendSafe } from '../notifications/sender';
import * as usersStore from '../auth/users-store';

/** Faixas de lembrete, em horas antes do início. */
export const FAIXAS_HORAS = [24, 1] as const;
export type FaixaLembrete = (typeof FAIXAS_HORAS)[number];

/** Estados em que faz sentido lembrar: a sessão está de pé. */
export const LEMBRAVEIS = ['confirmed', 'scheduled'] as const;

interface LembreteEnviado {
  bookingId: string;
  faixa: FaixaLembrete;
  sentAt: string;
}

const ledger = new JsonStore<LembreteEnviado>('session-reminders.json', () => []);

export interface RunResult {
  examinados: number;
  /** De pé e no futuro. */
  candidatos: number;
  elegiveis: number;
  enviados: number;
  jaLembrados: number;
  erros: number;
  detalhes: string[];
}

/**
 * Todas as faixas já alcançadas, da **mais urgente para a mais folgada**.
 *
 * Faltando 20 horas, só a de 24h foi alcançada. Faltando 30 minutos, as duas
 * foram — e é por isso que esta função devolve lista e não um valor: quem
 * agenda com meia hora de antecedência não pode receber "sua sessão é amanhã".
 * O worker manda a mais urgente que ainda não saiu e **queima as demais**, para
 * que a de 24h não dispare depois da de 1h.
 *
 * Sessão que já começou não recebe lembrete nenhum: chegou tarde.
 */
export function faixasDevidas(horasAte: number): FaixaLembrete[] {
  if (horasAte < 0) return [];
  return FAIXAS_HORAS.filter((f) => horasAte <= f).sort((a, b) => a - b);
}

/** A faixa mais urgente já alcançada, ou `null`. */
export function faixaPara(horasAte: number): FaixaLembrete | null {
  return faixasDevidas(horasAte)[0] ?? null;
}

function chave(bookingId: string, faixa: FaixaLembrete): string {
  return `${bookingId}|${faixa}`;
}

function escapar(t: string): string {
  return t.replace(
    /[&<>"']/g,
    (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m] as string,
  );
}

export function textoLembrete(
  faixa: FaixaLembrete,
  b: bookingsRepo.SessionBooking,
): { assunto: string; titulo: string; corpo: string } {
  const quando = new Date(b.scheduledFor).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  });
  const prazo = faixa === 24 ? 'amanhã' : 'em uma hora';
  const com = `${b.serviceName} com ${b.professionalName}`;
  return {
    assunto: `Lembrete: sua sessão é ${prazo} — ${com}`,
    titulo: `Sessão ${prazo}`,
    corpo: `Sua sessão de ${com} é ${prazo}, às ${quando}.${
      b.meetingLink ? ` Link da reunião: ${b.meetingLink}` : ' O link da reunião chega antes.'
    }`,
  };
}

async function tickInterno(opts: { dryRun?: boolean } = {}): Promise<RunResult> {
  const r: RunResult = {
    examinados: 0,
    candidatos: 0,
    elegiveis: 0,
    enviados: 0,
    jaLembrados: 0,
    erros: 0,
    detalhes: [],
  };

  const todos = await bookingsRepo.listAll();
  const enviados = new Set((await ledger.getAll()).map((l) => chave(l.bookingId, l.faixa)));
  const agora = Date.now();

  for (const b of todos) {
    r.examinados++;
    if (!(LEMBRAVEIS as readonly string[]).includes(b.status)) continue;
    const inicio = new Date(b.scheduledFor).getTime();
    if (Number.isNaN(inicio) || inicio <= agora) continue;
    r.candidatos++;

    const horasAte = (inicio - agora) / 3_600_000;
    const devidas = faixasDevidas(horasAte);
    if (devidas.length === 0) continue;
    r.elegiveis++;

    // A mais urgente que ainda não saiu.
    const faixa = devidas.find((f) => !enviados.has(chave(b.id, f)));
    if (faixa === undefined) {
      r.jaLembrados++;
      continue;
    }

    const { assunto, titulo, corpo } = textoLembrete(faixa, b);
    if (opts.dryRun) {
      r.detalhes.push(`lembraria [${faixa}h] ${b.userEmail} — ${b.serviceName}`);
      continue;
    }

    try {
      await notificationsRepo.createOne({
        userId: b.userId,
        title: titulo,
        body: corpo,
        category: 'info',
        link: '/analise-supervisao',
        authorEmail: 'sistema',
      });
      const user = await usersStore.findUserById(b.userId);
      const email = user?.email ?? b.userEmail;
      if (email) {
        const base = process.env.PUBLIC_ORIGIN ?? 'https://ava.psicanaliseclinica.online';
        await sendSafe({
          to: { email, name: user?.name ?? '' },
          subject: assunto,
          html: [
            `<p>Olá${user?.name ? `, ${escapar(user.name)}` : ''}.</p>`,
            `<p>${escapar(corpo)}</p>`,
            `<p><a href="${escapar(base + '/analise-supervisao')}">Ver minhas sessões</a></p>`,
          ].join('\n'),
          tag: `session-reminder-${faixa}h`,
        });
      }
      // Queima TODAS as faixas alcançadas, não só a enviada: sem isto, quem
      // agenda com meia hora de antecedência receberia o lembrete de 1h agora
      // e o de "amanhã" no tick seguinte.
      const ts = new Date().toISOString();
      for (const f of devidas) {
        if (enviados.has(chave(b.id, f))) continue;
        await ledger.add({ bookingId: b.id, faixa: f, sentAt: ts });
        enviados.add(chave(b.id, f));
      }
      r.enviados++;
    } catch (err) {
      r.erros++;
      r.detalhes.push(`erro ${b.id}: ${err instanceof Error ? err.message : 'desconhecido'}`);
    }
  }

  return r;
}

let interval: NodeJS.Timeout | null = null;
let lastRunAt: string | null = null;
let lastRunResult: RunResult | null = null;
let totalTicks = 0;
let intervalMsCfg = 15 * 60_000;

export async function tickWorker(opts: { dryRun?: boolean } = {}): Promise<RunResult> {
  const r = await tickInterno(opts);
  if (!opts.dryRun) {
    lastRunAt = new Date().toISOString();
    lastRunResult = r;
    totalTicks++;
  }
  return r;
}

/**
 * Tick de 15 minutos, e não diário: a faixa de 1 hora precisa de resolução
 * melhor que um dia para existir de verdade.
 */
export function startWorker(intervalMs = 15 * 60_000): void {
  if (interval) return;
  intervalMsCfg = intervalMs;
  interval = setInterval(() => {
    void tickWorker().catch(() => {
      /* engolido: o status guarda o último resultado */
    });
  }, intervalMs);
}

export function stopWorker(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}

export function getStatus() {
  return {
    name: 'session-reminders',
    enabled: interval !== null,
    intervalMs: intervalMsCfg,
    lastRunAt,
    lastRunResult,
    totalTicks,
  };
}

/** Só para os testes. */
export async function _resetParaTeste(): Promise<void> {
  await ledger.setAll([]);
  lastRunAt = null;
  lastRunResult = null;
  totalTicks = 0;
}

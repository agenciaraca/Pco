/**
 * Aviso de vencimento de acesso.
 *
 * Existe por causa de uma armadilha documentada em `docs/prazo-de-acesso.md`:
 * declarar `accessMonths` num curso é **retroativo**. Matrícula sem prazo
 * gravado passa a valer `enrolledAt + accessMonths` no instante em que o curso
 * declara o prazo — e com datas reais de 2021 a 2026, declarar "6 meses" tranca
 * centenas de alunos de uma vez. Esse comportamento é o desejado; o que não
 * pode é o aluno descobrir pela porta fechada.
 *
 * Então este worker roda **antes** de qualquer prazo ser declarado, avisa quem
 * está perto do fim e registra o que já avisou. Hoje, com nenhum dos cursos
 * declarando prazo, ele varre e não encontra ninguém — que é exatamente o
 * estado correto para estrear.
 *
 * Duas decisões que valem explicação:
 *
 * 1. **Um aviso por faixa, não por dia.** O ledger guarda (aluno, curso, faixa)
 *    para que o aluno receba "faltam 30 dias" uma vez, "faltam 7" uma vez e
 *    "venceu" uma vez — em vez de trinta e-mails iguais.
 * 2. **Avisar não muda acesso.** Nada aqui escreve em matrícula. Quem decide
 *    quem estuda continua sendo `courseAccessFor`, e este módulo só conta o
 *    que já é verdade.
 */

import { JsonStore } from '../db/json-store';
import * as studentsRepo from '../repositories/students';
import * as coursesRepo from '../repositories/courses';
import * as usersStore from '../auth/users-store';
import * as notificationsRepo from '../repositories/notifications';
import { sendSafe } from '../notifications/sender';
import { accessFor } from './course-access';
import { avisaVencimento } from './situacao-matricula';
import { origemPublica } from '../origem-publica';

/**
 * Interruptor de envio. `AVISO_VENCIMENTO=off` faz o worker varrer e contar,
 * mas não mandar e-mail nem criar notificação.
 *
 * Existe por causa de 1º/set/2026: declarar o prazo é retroativo, e o primeiro
 * cálculo deixou 616 matrículas vencidas de uma vez, para 485 pessoas. O ledger
 * estava zerado, então a primeira passada mandaria 616 e-mails — acima da cota
 * diária do provedor, e todos no mesmo minuto. O dono decidiu segurar os avisos
 * e manter o prazo valendo. Tirar a variável (ou pôr `on`) volta ao normal, e
 * os avisos saem na passada seguinte, sem repetir quem já foi avisado.
 *
 * O prazo NÃO depende deste interruptor: quem venceu está sem acesso de
 * qualquer forma. Isto governa apenas o aviso.
 */
export function avisosLigados(): boolean {
  return String(process.env.AVISO_VENCIMENTO ?? 'on').toLowerCase() !== 'off';
}

/** Faixas de aviso, em dias restantes. A ordem importa: da mais folgada à mais apertada. */
export const FAIXAS_AVISO = [30, 7, 1] as const;
export type FaixaAviso = (typeof FAIXAS_AVISO)[number] | 0;

/** `0` é a faixa do "já venceu" — aviso único, depois do fato. */
export const FAIXA_VENCIDO: FaixaAviso = 0;

interface AvisoEnviado {
  userId: string;
  courseId: string;
  faixa: FaixaAviso;
  sentAt: string;
  email: string;
}

const ledger = new JsonStore<AvisoEnviado>('access-expiry-notices.json', () => []);

export interface RunResult {
  /** Pares aluno×curso examinados. */
  scanned: number;
  /** Quantos têm prazo de fato (curso declarou meses ou matrícula tem data). */
  comPrazo: number;
  /** Quantos caíram em alguma faixa de aviso nesta passada. */
  elegiveis: number;
  enviados: number;
  /** Segurados pelo interruptor `AVISO_VENCIMENTO=off` — nada foi enviado. */
  segurados?: number;
  /** Pulados por situação (suspensa/cancelada) — não é caso de vencimento. */
  foraDeSituacao?: number;
  /** Já avisados naquela faixa antes — não recebem de novo. */
  jaAvisados: number;
  erros: number;
  detalhes: string[];
}

/**
 * A faixa em que este acesso se encaixa agora, ou `null` quando não há nada a
 * dizer. Vitalício nunca cai em faixa nenhuma.
 */
export function faixaPara(daysLeft: number | null): FaixaAviso | null {
  if (daysLeft === null) return null;
  if (daysLeft < 0) return FAIXA_VENCIDO;
  // A faixa mais apertada que ainda contém o aluno: com 5 dias restantes ele
  // está na faixa de 7, não na de 30 — senão receberia o aviso errado.
  const candidatas = FAIXAS_AVISO.filter((f) => daysLeft <= f);
  if (candidatas.length === 0) return null;
  return candidatas[candidatas.length - 1]!;
}

function chave(a: Pick<AvisoEnviado, 'userId' | 'courseId' | 'faixa'>): string {
  return `${a.userId}|${a.courseId}|${a.faixa}`;
}

function textoAviso(
  faixa: FaixaAviso,
  cursoNome: string,
  ate: string | null,
): { assunto: string; titulo: string; corpo: string } {
  const quando = ate ? new Date(ate).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : null;
  if (faixa === FAIXA_VENCIDO) {
    return {
      assunto: `Seu acesso a ${cursoNome} terminou`,
      titulo: 'Acesso encerrado',
      corpo: `Seu prazo de acesso ao curso ${cursoNome} terminou${
        quando ? ` em ${quando}` : ''
      }. Seu progresso continua guardado — para voltar a estudar, fale com a coordenação sobre a renovação.`,
    };
  }
  const dias = faixa === 1 ? 'amanhã' : `em ${faixa} dias`;
  return {
    assunto: `Seu acesso a ${cursoNome} termina ${dias}`,
    titulo: 'Acesso perto do fim',
    corpo: `Seu acesso ao curso ${cursoNome} termina ${dias}${
      quando ? ` (${quando})` : ''
    }. Se ainda tem aulas para ver, este é o momento — e, se precisar de mais tempo, fale com a coordenação.`,
  };
}

function corpoHtml(nome: string, corpo: string, url: string): string {
  const escapar = (t: string) =>
    t.replace(
      /[&<>"']/g,
      (m) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m] as string,
    );
  return [
    `<p>Olá, ${escapar(nome)}.</p>`,
    `<p>${escapar(corpo)}</p>`,
    `<p><a href="${escapar(url)}">Entrar no ambiente</a></p>`,
  ].join('\n');
}

async function tickInterno(opts: { dryRun?: boolean } = {}): Promise<RunResult> {
  const r: RunResult = {
    scanned: 0,
    comPrazo: 0,
    elegiveis: 0,
    enviados: 0,
    segurados: 0,
    foraDeSituacao: 0,
    jaAvisados: 0,
    erros: 0,
    detalhes: [],
  };

  const students = await studentsRepo.listAdminStudents({ limit: 100_000 } as never);
  const cursos = await coursesRepo.listCourses();
  const mesesPorCurso = new Map<string, number | null>();
  const nomePorCurso = new Map<string, string>();
  for (const c of cursos) {
    const meta = c as unknown as { id: string; title?: string; accessMonths?: number | null };
    mesesPorCurso.set(meta.id, meta.accessMonths ?? null);
    nomePorCurso.set(meta.id, meta.title ?? meta.id);
  }

  const enviados = new Set((await ledger.getAll()).map(chave));
  const agora = new Date();
  const base = origemPublica();

  for (const s of students) {
    for (const courseId of s.enrolledCourseIds ?? []) {
      r.scanned++;
      const info = accessFor(
        {
          enrolledAt: s.enrollmentDates?.[courseId] ?? s.createdAt ?? null,
          storedExpiresAt: s.accessExpiresByCourse?.[courseId] ?? null,
          accessMonths: mesesPorCurso.get(courseId) ?? null,
        },
        agora,
      );
      // Matrícula suspensa ou cancelada não recebe aviso de vencimento. Quem
      // teve o pedido estornado lendo "seu acesso expirou" é pior que silêncio:
      // a mensagem manda renovar o que foi desfeito, e o aviso vira cobrança
      // de quem já pediu o dinheiro de volta. Ver access/situacao-matricula.ts.
      if (!avisaVencimento(s.enrollmentStatusByCourse?.[courseId])) {
        r.foraDeSituacao = (r.foraDeSituacao ?? 0) + 1;
        continue;
      }

      if (info.expiresAt === null) continue; // vitalício: nada a avisar
      r.comPrazo++;

      const faixa = faixaPara(info.daysLeft);
      if (faixa === null) continue;
      r.elegiveis++;

      const k = chave({ userId: s.id, courseId, faixa });
      if (enviados.has(k)) {
        r.jaAvisados++;
        continue;
      }

      const user = await usersStore.findUserById(s.id);
      if (!user?.email) {
        r.erros++;
        r.detalhes.push(`sem e-mail: ${s.id}`);
        continue;
      }

      const cursoNome = nomePorCurso.get(courseId) ?? courseId;
      const { assunto, titulo, corpo } = textoAviso(faixa, cursoNome, info.expiresAt);

      if (opts.dryRun) {
        r.detalhes.push(`enviaria [${faixa}d] ${user.email} — ${cursoNome}`);
        continue;
      }

      // Segurado: não envia e NÃO grava no ledger — assim, quando o dono
      // religar, esta pessoa ainda recebe o aviso que lhe é devido.
      if (!avisosLigados()) {
        r.segurados = (r.segurados ?? 0) + 1;
        continue;
      }

      const envio = await sendSafe({
        to: { email: user.email, name: user.name },
        subject: assunto,
        html: corpoHtml(user.name, corpo, `${base}/login`),
        tag: 'access-expiry',
      });
      if (!envio.ok) {
        r.erros++;
        r.detalhes.push(`erro ${user.email}: ${envio.error}`);
        continue;
      }

      // O e-mail pode não chegar; a notificação no ambiente fica de qualquer
      // forma, para quem entrar e não tiver visto a caixa de entrada.
      await notificationsRepo.createOne({
        userId: s.id,
        title: titulo,
        body: corpo,
        category: faixa === FAIXA_VENCIDO ? 'warning' : 'info',
        link: `/curso/${courseId}`,
        authorEmail: 'sistema',
      });

      await ledger.add({
        userId: s.id,
        courseId,
        faixa,
        sentAt: new Date().toISOString(),
        email: user.email,
      });
      enviados.add(k);
      r.enviados++;
    }
  }

  return r;
}

let interval: NodeJS.Timeout | null = null;
let lastRunAt: string | null = null;
let lastRunResult: RunResult | null = null;
let totalTicks = 0;
let intervalMsCfg = 24 * 60 * 60_000;

export async function tickWorker(opts: { dryRun?: boolean } = {}): Promise<RunResult> {
  const r = await tickInterno(opts);
  if (!opts.dryRun) {
    lastRunAt = new Date().toISOString();
    lastRunResult = r;
    totalTicks++;
  }
  return r;
}

/** Loop diário, como os demais workers da casa. */
export function startWorker(intervalMs = 24 * 60 * 60_000): void {
  if (interval) return;
  intervalMsCfg = intervalMs;
  interval = setInterval(() => {
    void tickWorker().catch(() => {
      /* engolido de propósito: o status guarda o último resultado */
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
    name: 'access-expiry',
    enabled: interval !== null,
    avisosLigados: avisosLigados(),
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

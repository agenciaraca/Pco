/**
 * Retenção pedagógica — medida, não ilustrada.
 *
 * Até 27/ago/2026 a tela `/admin/retencao` era inteiramente fabricada: os
 * quatro KPIs eram strings fixas, a curva de coorte era um array escrito à mão
 * com três cursos inventados, e o gráfico de conclusão por curso fazia a pior
 * coisa possível — pegava o **nome real** do curso e colava em cima um número
 * de uma lista `[64, 52, 71]`. Rótulo verdadeiro com valor inventado é mais
 * perigoso do que ficção assumida, porque passa por conferência.
 *
 * Tudo aqui sai de registros que já existem: `admin-students` (matrícula,
 * progresso, último acesso, risco), `watch-time` e o histórico de envios do
 * reengajamento.
 *
 * ## A regra do denominador
 *
 * Nenhum percentual sai daqui sozinho: cada um vem acompanhado da base sobre a
 * qual foi calculado. É o que permite quem olha desconfiar do número — se a
 * tela disser "58% de conclusão sobre 10.205 matrículas" num sistema com 785
 * alunos, o próprio denominador denuncia o problema de dados da migração
 * (`docs/migration-wp-ld.md`), em vez de escondê-lo atrás de uma porcentagem
 * redonda.
 *
 * ## Censura à direita
 *
 * A curva de coorte só conta, na semana N, quem se matriculou **há pelo menos
 * N semanas**. Sem isso, quem entrou ontem apareceria como "abandonou na
 * semana 12" e a curva despencaria por artefato de cálculo.
 */

import * as studentsRepo from '../repositories/students';
import * as coursesRepo from './../repositories/courses';
import * as watchTime from '../repositories/watch-time';
import * as reengajamento from '../reengagement/config-store';

const SEMANA_MS = 7 * 24 * 60 * 60_000;

/** Semanas em que a curva de sobrevivência é amostrada. */
export const SEMANAS_DA_COORTE = [1, 2, 4, 8, 12, 16, 20, 26, 52];

/** Progresso a partir do qual a matrícula conta como concluída. */
const PCT_CONCLUSAO = 100;

/** Um percentual nunca viaja sozinho: sempre com a base que o gerou. */
export interface Medida {
  /** `null` quando não há base para calcular — não é zero. */
  pct: number | null;
  base: number;
}

export interface CursoRetencao {
  id: string;
  nome: string;
  matriculados: number;
  /** % de matrículas em 100%. */
  conclusao: Medida;
  /** % de matriculados marcados em risco pelo cálculo de risco. */
  emRisco: Medida;
  /** Progresso médio das matrículas, 0-100. */
  progressoMedio: number | null;
}

export interface PontoDaCoorte {
  semana: number;
  /** Por curso: % ainda ativo. `null` quando ninguém tem idade suficiente. */
  porCurso: Record<string, number | null>;
  /** Quantos alunos entraram no cálculo desta semana, por curso. */
  basePorCurso: Record<string, number>;
}

export interface SemanaReengajamento {
  /** Segunda-feira da semana, YYYY-MM-DD. */
  semana: string;
  enviados: number;
  retomados: number;
}

export interface RelatorioRetencao {
  geradoEm: string;
  base: { alunos: number; matriculas: number; cursos: number };
  kpis: {
    /** % ativo nos últimos 30 dias, entre quem se matriculou há 90 dias ou mais. */
    ativosRecentes: Medida;
    /** % de matrículas concluídas. */
    conclusaoGeral: Medida;
    /** Horas assistidas acumuladas e quantos alunos as produziram. */
    horasAssistidas: { horas: number; alunos: number };
    /** % dos envios de reengajamento seguidos de retorno. */
    impactoReengajamento: Medida;
  };
  cursos: CursoRetencao[];
  coorte: PontoDaCoorte[];
  reengajamento: SemanaReengajamento[];
  naoMedido: Array<{ o_que: string; depende_de: string }>;
}

function medida(numerador: number, base: number): Medida {
  return { pct: base > 0 ? Number(((numerador / base) * 100).toFixed(1)) : null, base };
}

function ms(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

/** Segunda-feira da semana de uma data, em YYYY-MM-DD. */
function segundaDa(d: Date): string {
  const copia = new Date(d);
  const diaDaSemana = (copia.getDay() + 6) % 7; // 0 = segunda
  copia.setDate(copia.getDate() - diaDaSemana);
  const off = copia.getTimezoneOffset() * 60_000;
  return new Date(copia.getTime() - off).toISOString().slice(0, 10);
}

/**
 * Quando o aluno entrou neste curso. `enrollmentDates` é a fonte boa; sem ela,
 * a criação da ficha é a melhor aproximação disponível — e é a mesma que o
 * cálculo de prazo de acesso usa (`resolveExpiry`), então ao menos as duas
 * telas erram junto em vez de discordarem.
 */
function matriculadoEm(
  aluno: { enrollmentDates?: Record<string, string>; createdAt: string },
  courseId: string,
): number | null {
  return ms(aluno.enrollmentDates?.[courseId]) ?? ms(aluno.createdAt);
}

export async function montaRetencao(agora = new Date()): Promise<RelatorioRetencao> {
  const [alunos, cursos] = await Promise.all([
    studentsRepo.listAdminStudents({ limit: 100_000 } as never),
    coursesRepo.listCourses(),
  ]);

  const nomeDoCurso = new Map(cursos.map((c) => [c.id, c.shortTitle || c.title]));

  // ---------- Por curso: conclusão, risco e progresso ----------
  const porCurso = new Map<
    string,
    { matriculados: number; concluidos: number; emRisco: number; somaProgresso: number }
  >();
  let matriculas = 0;

  for (const a of alunos) {
    for (const cursoId of a.enrolledCourseIds ?? []) {
      matriculas += 1;
      const atual = porCurso.get(cursoId) ?? {
        matriculados: 0,
        concluidos: 0,
        emRisco: 0,
        somaProgresso: 0,
      };
      const progresso = a.progressByCourse?.[cursoId] ?? 0;
      atual.matriculados += 1;
      atual.somaProgresso += progresso;
      if (progresso >= PCT_CONCLUSAO) atual.concluidos += 1;
      if (a.status === 'em_risco') atual.emRisco += 1;
      porCurso.set(cursoId, atual);
    }
  }

  const cursosRetencao: CursoRetencao[] = Array.from(porCurso.entries())
    .map(([id, v]) => ({
      id,
      nome: nomeDoCurso.get(id) ?? id,
      matriculados: v.matriculados,
      conclusao: medida(v.concluidos, v.matriculados),
      emRisco: medida(v.emRisco, v.matriculados),
      progressoMedio:
        v.matriculados > 0 ? Number((v.somaProgresso / v.matriculados).toFixed(1)) : null,
    }))
    .sort((a, b) => b.matriculados - a.matriculados);

  // ---------- Curva de coorte, com censura à direita ----------
  //
  // As datas de cada matrícula são resolvidas UMA vez, não uma por semana: em
  // produção são 13 cursos × ~2000 alunos × 9 semanas, e refazer o `includes`
  // e o `Date.parse` dentro do laço transformaria esta tela num timeout.
  const agoraMs = agora.getTime();
  const janelasPorCurso = new Map<string, Array<{ idade: number; sobreviveu: number }>>();
  for (const a of alunos) {
    const ultimo = ms(a.lastAccessAt);
    for (const cursoId of a.enrolledCourseIds ?? []) {
      const entrada = matriculadoEm(a, cursoId);
      if (entrada === null) continue;
      const lista = janelasPorCurso.get(cursoId) ?? [];
      lista.push({
        // Há quanto tempo esta matrícula existe.
        idade: agoraMs - entrada,
        // Quanto tempo o aluno permaneceu por perto depois de se matricular.
        sobreviveu: ultimo === null ? -1 : ultimo - entrada,
      });
      janelasPorCurso.set(cursoId, lista);
    }
  }

  const coorte: PontoDaCoorte[] = SEMANAS_DA_COORTE.map((semana) => {
    const porCursoPct: Record<string, number | null> = {};
    const basePorCurso: Record<string, number> = {};
    const corte = semana * SEMANA_MS;

    for (const curso of cursosRetencao) {
      let elegiveis = 0;
      let ativos = 0;
      for (const j of janelasPorCurso.get(curso.id) ?? []) {
        // Só entra quem já teve tempo de chegar até esta semana.
        if (j.idade < corte) continue;
        elegiveis += 1;
        if (j.sobreviveu >= corte) ativos += 1;
      }
      basePorCurso[curso.id] = elegiveis;
      porCursoPct[curso.id] =
        elegiveis > 0 ? Number(((ativos / elegiveis) * 100).toFixed(1)) : null;
    }
    return { semana, porCurso: porCursoPct, basePorCurso };
  });

  // ---------- KPIs ----------
  const TRINTA = 30 * 24 * 60 * 60_000;
  const NOVENTA = 90 * 24 * 60 * 60_000;
  let maduros = 0;
  let maduosAtivos = 0;
  for (const a of alunos) {
    const criado = ms(a.createdAt);
    if (criado === null || agoraMs - criado < NOVENTA) continue;
    maduros += 1;
    const ultimo = ms(a.lastAccessAt);
    if (ultimo !== null && agoraMs - ultimo <= TRINTA) maduosAtivos += 1;
  }

  const concluidas = cursosRetencao.reduce(
    (s, c) => s + Math.round(((c.conclusao.pct ?? 0) / 100) * c.matriculados),
    0,
  );

  // ---------- Reengajamento: envio seguido de retorno ----------
  const envios = await reengajamento.listRecentSends(1000);
  const ultimoAcessoPorAluno = new Map(alunos.map((a) => [a.id, ms(a.lastAccessAt)]));
  // Envios do mesmo aluno em ordem: um envio "funcionou" se houve acesso
  // depois dele e antes do envio seguinte — senão o crédito do retorno iria
  // para todos os envios anteriores de uma vez.
  const porAluno = new Map<string, string[]>();
  for (const e of envios) {
    const lista = porAluno.get(e.userId) ?? [];
    lista.push(e.ts);
    porAluno.set(e.userId, lista);
  }
  for (const lista of porAluno.values()) lista.sort();

  const semanas = new Map<string, { enviados: number; retomados: number }>();
  let totalEnviados = 0;
  let totalRetomados = 0;
  for (const [userId, tss] of porAluno) {
    const ultimoAcesso = ultimoAcessoPorAluno.get(userId) ?? null;
    tss.forEach((ts, i) => {
      const enviadoEm = ms(ts);
      if (enviadoEm === null) return;
      const proximoEnvio = i + 1 < tss.length ? ms(tss[i + 1]!) : null;
      const semana = segundaDa(new Date(enviadoEm));
      const atual = semanas.get(semana) ?? { enviados: 0, retomados: 0 };
      atual.enviados += 1;
      totalEnviados += 1;
      const retomou =
        ultimoAcesso !== null &&
        ultimoAcesso > enviadoEm &&
        (proximoEnvio === null || ultimoAcesso < proximoEnvio);
      if (retomou) {
        atual.retomados += 1;
        totalRetomados += 1;
      }
      semanas.set(semana, atual);
    });
  }

  const reengajamentoSerie: SemanaReengajamento[] = Array.from(semanas.entries())
    .map(([semana, v]) => ({ semana, ...v }))
    .sort((a, b) => (a.semana < b.semana ? -1 : 1))
    .slice(-12);

  // ---------- Horas assistidas ----------
  const todasEntradas = await Promise.all(
    cursosRetencao.map((c) => watchTime.listForCourse(c.id)),
  );
  const entradas = todasEntradas.flat();
  const segundos = entradas.reduce((s, e) => s + e.totalSeconds, 0);
  const alunosComTempo = new Set(entradas.map((e) => e.userId)).size;

  return {
    geradoEm: agora.toISOString(),
    base: { alunos: alunos.length, matriculas, cursos: cursosRetencao.length },
    kpis: {
      ativosRecentes: medida(maduosAtivos, maduros),
      conclusaoGeral: medida(concluidas, matriculas),
      horasAssistidas: { horas: Number((segundos / 3600).toFixed(1)), alunos: alunosComTempo },
      impactoReengajamento: medida(totalRetomados, totalEnviados),
    },
    cursos: cursosRetencao,
    coorte,
    reengajamento: reengajamentoSerie,
    naoMedido: [
      {
        o_que: 'Ritmo de estudo em horas por semana',
        depende_de:
          'watch-time guarda só o total acumulado por aula, sem série temporal — não dá para recortar por semana',
      },
      {
        o_que: 'Coorte por curso com precisão de acesso',
        depende_de:
          'o último acesso é do aluno, não por curso; quem estuda dois cursos aparece ativo nos dois',
      },
    ],
  };
}

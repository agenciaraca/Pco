/**
 * "Se eu declarar N meses de acesso neste curso, o que acontece com quem já
 * está matriculado?"
 *
 * A pergunta existe porque a resposta surpreende. `resolveExpiry` só respeita o
 * prazo gravado na matrícula; matrícula sem prazo gravado — que é o caso de
 * todas as que vieram da importação — passa a valer `enrolledAt + accessMonths`
 * no instante em que o curso declara o prazo. Como as datas de matrícula
 * verdadeiras vão de 2021 a 2026, declarar "6 meses" num curso antigo tranca
 * centenas de pessoas para fora no mesmo segundo, sem aviso e sem erro.
 *
 * Isso pode ser exatamente o desejado — é a política do negócio. O que não pode
 * é ser descoberto depois. Este módulo só conta: não grava nada.
 */

import { getDb, schema } from '../db/client';
import { eq, and } from 'drizzle-orm';
import { accessFor, type AccessState } from './course-access';
import * as studentsRepo from '../repositories/students';

export interface ImpactoAcesso {
  /** Meses simulados. 0 ou null = sem prazo. */
  meses: number | null;
  /** Matrículas neste curso. */
  total: number;
  /** Quantas ficariam vencidas agora. */
  expirados: number;
  /** Quantas venceriam nos próximos 30 dias. */
  vencendo: number;
  /** Quantas seguiriam com folga. */
  ativos: number;
  /** Quantas não são afetadas por já terem prazo próprio gravado. */
  comPrazoProprio: number;
  /** As matrículas mais antigas — as que mais sofrem. */
  exemplos: Array<{ nome: string; email: string; desde: string; ate: string | null }>;
}

export interface LinhaMatricula {
  studentId: string;
  enrolledAt: string;
  expiresAt: string | null;
  nome: string;
  email: string;
}

async function linhasDoCurso(courseId: string): Promise<LinhaMatricula[]> {
  const db = getDb();
  if (db) {
    const rows = await db
      .select({
        studentId: schema.enrollments.studentId,
        enrolledAt: schema.enrollments.enrolledAt,
        expiresAt: schema.enrollments.expiresAt,
        nome: schema.users.name,
        email: schema.users.email,
      })
      .from(schema.enrollments)
      .leftJoin(schema.students, eq(schema.students.id, schema.enrollments.studentId))
      .leftJoin(schema.users, eq(schema.users.id, schema.students.userId))
      .where(eq(schema.enrollments.courseId, courseId));

    if (rows.length > 0) {
      return rows.map((r) => ({
        studentId: r.studentId,
        enrolledAt: r.enrolledAt.toISOString(),
        expiresAt: r.expiresAt?.toISOString() ?? null,
        nome: r.nome ?? r.studentId,
        email: r.email ?? '',
      }));
    }
  }

  const lista = await studentsRepo.listAdminStudents({ courseId });
  return lista.map((s) => ({
    studentId: s.id,
    enrolledAt: s.enrollmentDates?.[courseId] ?? s.createdAt,
    expiresAt: s.accessExpiresByCourse?.[courseId] ?? null,
    nome: s.name,
    email: s.email,
  }));
}

/**
 * Conta o efeito de um prazo hipotético. Não grava nada, não depende do que o
 * curso tem declarado hoje — é a simulação de um valor que o admin ainda está
 * digitando.
 */
export async function simularPrazoDoCurso(
  courseId: string,
  meses: number | null,
  agora: Date = new Date(),
): Promise<ImpactoAcesso> {
  return contarImpacto(await linhasDoCurso(courseId), meses, agora);
}

/**
 * A conta em si, separada da busca: é o que precisa estar certo, e é o que dá
 * para testar sem banco.
 */
export function contarImpacto(
  linhas: LinhaMatricula[],
  meses: number | null,
  agora: Date = new Date(),
): ImpactoAcesso {
  const contagem: Record<AccessState, number> = {
    lifetime: 0,
    active: 0,
    expiring: 0,
    expired: 0,
  };
  let comPrazoProprio = 0;
  const afetadas: Array<LinhaMatricula & { ate: string | null }> = [];

  for (const l of linhas) {
    if (l.expiresAt) comPrazoProprio++;
    const info = accessFor(
      { enrolledAt: l.enrolledAt, storedExpiresAt: l.expiresAt, accessMonths: meses },
      agora,
    );
    contagem[info.state]++;
    if (info.state === 'expired') afetadas.push({ ...l, ate: info.expiresAt });
  }

  // Os mais antigos primeiro: são os que perdem mais tempo de acesso, e os que
  // vão reclamar primeiro se o prazo entrar sem aviso.
  afetadas.sort((a, b) => a.enrolledAt.localeCompare(b.enrolledAt));

  return {
    meses: meses && meses > 0 ? meses : null,
    total: linhas.length,
    expirados: contagem.expired,
    vencendo: contagem.expiring,
    ativos: contagem.active + contagem.lifetime,
    comPrazoProprio,
    exemplos: afetadas.slice(0, 8).map((a) => ({
      nome: a.nome,
      email: a.email,
      desde: a.enrolledAt,
      ate: a.ate,
    })),
  };
}

/**
 * Dá um prazo comum a quem ficaria vencido pela política do curso.
 *
 * Existe porque a extensão individual, que já havia, é o instrumento errado na
 * escala em questão: declarar seis meses no curso maior deixa 471 pessoas
 * vencidas de uma vez, e renovar uma a uma não é trabalho que alguém faça. Sem
 * isto, a política que o dono pediu só existe na forma de um muro.
 *
 * Grava `expiresAt` na matrícula — o valor gravado tem precedência sobre a
 * política do curso, então esta carência sobrevive a mudanças posteriores em
 * `accessMonths`. Não toca em quem já tem prazo próprio.
 */
export async function darCarencia(
  courseId: string,
  meses: number,
  ate: string,
  agora: Date = new Date(),
): Promise<{ afetados: number }> {
  const alvo = new Date(ate);
  if (Number.isNaN(alvo.getTime())) throw new RangeError(`data inválida: ${ate}`);

  const linhas = await linhasDoCurso(courseId);
  const vencidos = linhas.filter((l) => {
    if (l.expiresAt) return false; // prazo próprio manda; não mexemos
    return !accessFor(
      { enrolledAt: l.enrolledAt, storedExpiresAt: null, accessMonths: meses },
      agora,
    ).canStudy;
  });

  const db = getDb();
  if (db) {
    for (const l of vencidos) {
      await db
        .update(schema.enrollments)
        .set({ expiresAt: alvo })
        .where(
          and(
            eq(schema.enrollments.studentId, l.studentId),
            eq(schema.enrollments.courseId, courseId),
          ),
        );
    }
    return { afetados: vencidos.length };
  }

  for (const l of vencidos) {
    await studentsRepo.extendCourseAccess(l.studentId, courseId, { until: alvo.toISOString() });
  }
  return { afetados: vencidos.length };
}

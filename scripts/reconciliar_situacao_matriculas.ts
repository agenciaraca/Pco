/**
 * Acerta a situação das matrículas com o que os pedidos dizem.
 *
 * Existe por causa de um bug que ficou meses em produção sem fazer barulho:
 * `unenrollFromCourse` só escrevia no JSON de semente. Com `DATABASE_URL` — o
 * caso de produção desde 19/ago/2026 — ela devolvia `void` sem tocar em nada.
 * Então **todo estorno e todo cancelamento deixou o acesso de pé**, e o e-mail
 * de reembolso ainda dizia "o acesso ao conteúdo foi removido".
 *
 * O código já foi corrigido (`aplicarSituacaoDoPedido`, 1º/set/2026). Isto aqui
 * é o passivo: as matrículas que ficaram ativas quando não deviam.
 *
 * O método é o mesmo do runtime, de propósito — a regra mora em
 * `server/access/situacao-matricula.ts` e é ela que decide aqui também. Para
 * cada aluno, para cada curso, a situação é a **mais forte** entre todos os
 * pedidos dele para aquele curso: quem comprou, foi estornado e comprou de
 * novo continua com acesso.
 *
 * Nunca cria matrícula. Só mexe na situação de matrícula que já existe —
 * inventar acesso a partir de um pedido é decisão de gente.
 *
 * Uso:
 *   npx tsx scripts/reconciliar_situacao_matriculas.ts             # ensaio
 *   npx tsx scripts/reconciliar_situacao_matriculas.ts --commit    # aplica
 *
 * Confira a linha `[db] conectado ao Postgres` antes de confiar no número:
 * script de manutenção sem `dotenv/config` já mirou o seed duas vezes neste
 * projeto no mesmo dia.
 */

import 'dotenv/config';
import { getDb, schema } from '../server/db/client';
import * as ordersRepo from '../server/payments/orders-repo';
import {
  situacaoDoStatus,
  situacaoDeVarios,
  type SituacaoMatricula,
} from '../server/access/situacao-matricula';
import type { Order } from '../server/payments/types';
import { eq, and } from 'drizzle-orm';

/**
 * Igual ao runtime: `canceled`/`failed` de pedido que chegou a ser pago cancela.
 *
 * A prova de que foi pago é um evento `paid` no histórico, e NÃO o `paidAt`: a
 * importação da loja preencheu `paidAt` em todo pedido, inclusive nos boletos
 * cancelados. Foi assim que a primeira versão deste script quis cancelar cinco
 * matrículas legítimas.
 */
function situacaoDoPedido(o: Order): SituacaoMatricula {
  const s = situacaoDoStatus(o.status);
  if (s !== 'nenhuma') return s;
  return o.events.some((e) => e.status === 'paid') ? 'cancelada' : 'nenhuma';
}

async function cursosDoPedido(o: Order): Promise<string[]> {
  if (o.productSnapshot.kind === 'course' && o.productSnapshot.refId) {
    return [o.productSnapshot.refId];
  }
  // Bundle: os cursos vêm do produto. Sem banco de produtos aqui, o pedido de
  // bundle é reportado e não tocado — é caso raro e merece olho humano.
  return [];
}

async function main() {
  const commit = process.argv.includes('--commit');
  const db = getDb();
  if (!db) {
    console.error('sem DATABASE_URL — este script é para o banco. Nada feito.');
    process.exit(1);
  }

  const pedidos = await ordersRepo.listAll();
  console.log(`pedidos lidos: ${pedidos.length}`);

  // aluno → curso → situações implicadas por cada pedido
  const mapa = new Map<string, Map<string, SituacaoMatricula[]>>();
  let bundles = 0;
  for (const o of pedidos) {
    if (!o.userId) continue;
    if (o.productSnapshot.kind === 'bundle') {
      bundles++;
      continue;
    }
    const cursos = await cursosDoPedido(o);
    if (cursos.length === 0) continue;
    const s = situacaoDoPedido(o);
    let porCurso = mapa.get(o.userId);
    if (!porCurso) {
      porCurso = new Map();
      mapa.set(o.userId, porCurso);
    }
    for (const c of cursos) {
      porCurso.set(c, [...(porCurso.get(c) ?? []), s]);
    }
  }

  const matriculas = await db
    .select({
      studentId: schema.enrollments.studentId,
      courseId: schema.enrollments.courseId,
      status: schema.enrollments.status,
    })
    .from(schema.enrollments);
  console.log(`matrículas no banco: ${matriculas.length}`);

  const divergentes: {
    studentId: string;
    courseId: string;
    de: string;
    para: SituacaoMatricula;
  }[] = [];

  for (const m of matriculas) {
    const situacoes = mapa.get(m.studentId)?.get(m.courseId);
    // Sem pedido nenhum: matrícula de importação ou cortesia. Não é assunto
    // deste script — silêncio não é ordem para cancelar.
    if (!situacoes || situacoes.length === 0) continue;
    const devia = situacaoDeVarios(situacoes);
    if (devia === 'nenhuma') continue;
    if (devia !== m.status) {
      divergentes.push({ studentId: m.studentId, courseId: m.courseId, de: m.status, para: devia });
    }
  }

  const porTipo = new Map<string, number>();
  for (const d of divergentes) {
    const k = `${d.de} → ${d.para}`;
    porTipo.set(k, (porTipo.get(k) ?? 0) + 1);
  }

  console.log(`\npedidos de bundle ignorados (olho humano): ${bundles}`);
  console.log(`divergências: ${divergentes.length}`);
  for (const [k, n] of [...porTipo.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${n}`);
  }
  for (const d of divergentes.slice(0, 20)) {
    console.log(`  - ${d.studentId} / ${d.courseId}: ${d.de} → ${d.para}`);
  }
  if (divergentes.length > 20) console.log(`  ... e mais ${divergentes.length - 20}`);

  if (!commit) {
    console.log('\nensaio. nada gravado. rode de novo com --commit para aplicar.');
    return;
  }

  let aplicadas = 0;
  for (const d of divergentes) {
    await db
      .update(schema.enrollments)
      .set({ status: d.para })
      .where(
        and(
          eq(schema.enrollments.studentId, d.studentId),
          eq(schema.enrollments.courseId, d.courseId),
        ),
      );
    aplicadas++;
  }
  console.log(`\naplicadas: ${aplicadas}`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);

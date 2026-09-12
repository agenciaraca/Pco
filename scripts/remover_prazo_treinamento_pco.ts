// Remove `accessMonths` do "Treinamento PCO" (id 14958).
//
// ## Por que isto é um bug, não política comercial
//
// `accessMonths` existe para cursos VENDIDOS: a escola cobra, dá acesso por N
// meses, e quem quiser continuar compra de novo (`server/access/impacto.ts`,
// "Prazo de acesso — declarar os meses é RETROATIVO"). Treinamento PCO é
// treinamento interno de operador/atendente — `publicListed: false`, sem
// produto de venda, sem checkout — e herdou `accessMonths: 6` do mesmo molde
// dos cursos de aluno, provavelmente por copiar o `meta` padrão na importação.
//
// Medido em 12/set/2026, mesmo dia da remoção do drip semanal deste curso:
// **14 das 16 matrículas já estão com `ACCESS_EXPIRED`**, confirmado ao vivo
// contra `GET /me/courses/14958/lessons/:id/content` (403, "Seu acesso a
// este curso terminou em 17/10/2025..."). Não há como esse funcionário
// "renovar" — não existe produto para comprar de novo. É a mesma classe de
// decisão do drip removido no mesmo dia: gatilho de curso pago aplicado sem
// querer a treinamento interno, com o mesmo efeito de travar quem devia
// estar sempre com acesso.
//
// Ensaio por padrão; --commit para gravar.
import 'dotenv/config';
import { getDb, schema } from '../server/db/client';
import { eq } from 'drizzle-orm';

const CURSO_ID = '14958';

async function main() {
  const commit = process.argv.includes('--commit');
  const db = getDb();
  if (!db) {
    console.error('Sem DATABASE_URL — nada a reverter.');
    process.exit(1);
  }

  const curso = await db.select().from(schema.courses).where(eq(schema.courses.id, CURSO_ID)).limit(1);
  if (!curso[0]) {
    console.error('Curso não encontrado.');
    process.exit(1);
  }
  const meta = { ...(curso[0].meta as Record<string, unknown>) };
  console.log('accessMonths atual:', meta.accessMonths);

  const enrolls = await db.select().from(schema.enrollments).where(eq(schema.enrollments.courseId, CURSO_ID));
  const agora = Date.now();
  const mesesAtual = typeof meta.accessMonths === 'number' ? meta.accessMonths : null;
  let vencidosHoje = 0;
  if (mesesAtual !== null) {
    for (const e of enrolls) {
      const limite = new Date(e.enrolledAt).getTime() + mesesAtual * 30 * 86_400_000;
      if (agora > limite) vencidosHoje++;
    }
  }
  console.log(`${vencidosHoje} de ${enrolls.length} matrículas voltariam a ter acesso.`);

  if (!commit) {
    console.log('\nEnsaio — nada gravado. Rode com --commit para aplicar.');
    process.exit(0);
  }

  delete meta.accessMonths;
  await db.update(schema.courses).set({ meta }).where(eq(schema.courses.id, CURSO_ID));
  console.log('\naccessMonths removido — acesso volta a ser vitalício para este curso.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

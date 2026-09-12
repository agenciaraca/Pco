// Remove `accessMonths` de "Como ser um Super Aluno Online" (id 8887).
//
// ## Por que isto é um bug, não política comercial
//
// Achado no mesmo dia e pela mesma auditoria que corrigiu o Treinamento PCO
// (12/set/2026): `accessMonths` existe para cursos VENDIDOS, onde quem vence
// pode comprar de novo. Este curso é `publicListed: false` (não aparece na
// vitrine) e — medido antes de mexer — **não tem produto de venda nenhum**,
// nem como item avulso (`payment_products.refId`) nem dentro de um bundle
// (`payment_products.metadata.courseIds`). Já era documentado como tendo
// "655 alunos legítimos" (ver `/api/courses é público`, acima) — ou seja,
// não é conteúdo de teste: é um curso de verdade, com gente de verdade
// matriculada, só que sem porta de compra própria.
//
// Sem produto para comprar, `accessMonths: 6` não pode significar "renove
// comprando de novo" — só pode significar "essa pessoa perde acesso e não
// há nada que ela possa fazer". Medido: **535 das 652 matrículas (82%) já
// estavam vencidas** antes deste conserto, silenciosamente — o 403 só
// aparece pra quem tenta abrir a aula, e cada aluno lê isso como "problema
// comigo", não como bug do sistema.
//
// Ensaio por padrão; --commit para gravar.
import 'dotenv/config';
import { getDb, schema } from '../server/db/client';
import { eq } from 'drizzle-orm';

const CURSO_ID = '8887';

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
  console.log('Curso:', curso[0].title, '| accessMonths atual:', meta.accessMonths);

  const enrolls = await db.select().from(schema.enrollments).where(eq(schema.enrollments.courseId, CURSO_ID));
  const agora = Date.now();
  const mesesAtual = typeof meta.accessMonths === 'number' ? meta.accessMonths : null;
  let vencidos = 0;
  let comExpiresAtProprio = 0;
  for (const e of enrolls) {
    if (e.expiresAt) {
      comExpiresAtProprio++;
      continue;
    }
    if (mesesAtual !== null) {
      const limite = new Date(e.enrolledAt).getTime() + mesesAtual * 30 * 86_400_000;
      if (agora > limite) vencidos++;
    }
  }
  console.log(`${enrolls.length} matrículas totais, ${comExpiresAtProprio} com prazo próprio (não afetadas).`);
  console.log(`${vencidos} de ${enrolls.length - comExpiresAtProprio} voltariam a ter acesso.`);

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

// Reverte o drip semanal especificamente do "Treinamento PCO" (id 14958).
//
// ## Por que este curso é diferente dos outros três
//
// `configurar_drip_semanal.ts` (11/set/2026) ligou 1 módulo por semana em
// TODOS os cursos ativos, sem distinguir curso de aluno de curso interno. O
// Treinamento PCO é o único dos quatro que não é vendido — é treinamento de
// operador/atendente (títulos dos módulos: "Psicologia do Cliente", "CRM e
// Gestão do Relacionamento", "Técnicas de Venda"), publicListed: false,
// 16 matrículas, a mais antiga de 2021.
//
// Não há razão pedagógica ou comercial para pausar o ONBOARDING de um
// funcionário por 7 semanas — o drip existe para dosar o ritmo de estudo de
// quem PAGOU por uma formação, não para atrasar quem precisa estar produtivo
// o quanto antes. Decisão registrada em 12/set/2026: este curso sai do
// drip; os outros três (cursos de aluno pagante) continuam na grade semanal.
//
// Ensaio por padrão; --commit para gravar.
import 'dotenv/config';
import { getDb, schema } from '../server/db/client';
import { asc, eq } from 'drizzle-orm';

const CURSO_ID = '14958';

async function main() {
  const commit = process.argv.includes('--commit');
  const db = getDb();
  if (!db) {
    console.error('Sem DATABASE_URL — nada a reverter (modo JSON não tem esta tabela).');
    process.exit(1);
  }

  const modulos = await db
    .select({
      id: schema.modules.id,
      title: schema.modules.title,
      order: schema.modules.order,
      releaseAfterEnrollmentDays: schema.modules.releaseAfterEnrollmentDays,
    })
    .from(schema.modules)
    .where(eq(schema.modules.courseId, CURSO_ID))
    .orderBy(asc(schema.modules.order));

  const paraReverter = modulos.filter((m) => m.releaseAfterEnrollmentDays !== null);
  console.log(`Treinamento PCO: ${modulos.length} módulos, ${paraReverter.length} com trava a remover.\n`);
  for (const m of paraReverter) {
    console.log(`  módulo ${m.order} "${m.title.slice(0, 50)}" -> remove trava (${m.releaseAfterEnrollmentDays} dias)`);
  }

  if (!commit) {
    console.log('\nEnsaio — nada gravado. Rode com --commit para aplicar.');
    process.exit(0);
  }

  for (const m of paraReverter) {
    await db.update(schema.modules).set({ releaseAfterEnrollmentDays: null }).where(eq(schema.modules.id, m.id));
  }
  console.log(`\n${paraReverter.length} módulo(s) liberado(s) — acesso imediato para toda a equipe.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

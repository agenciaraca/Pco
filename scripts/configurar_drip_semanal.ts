// Liga o drip relativo (releaseAfterEnrollmentDays) nos cursos ativos, no
// padrão pedido pelo dono em 11/set/2026: 1 módulo libera a cada 7 dias.
//
// Módulo 1 (o primeiro na ordem) fica SEM trava — sempre acessível assim que
// a matrícula existe. Módulo N (N>=2) libera N dias após o dia 7*(N-1) da
// matrícula: módulo 2 aos 7 dias, módulo 3 aos 14, e assim por diante.
//
// ## Por que isto é RETROATIVO, e por que foi medido antes de gravar
//
// `releaseAfterEnrollmentDays` conta a partir de `enrollments.enrolled_at`,
// que já existe para toda matrícula — inclusive as antigas. Ligar isto agora
// não afeta quem entrou há meses (o prazo já passou de sobra), mas pode
// afetar quem entrou recentemente e já adiantou o estudo além do que o
// calendário semanal permitiria.
//
// Medido em produção antes de escrever este script: nenhuma matrícula ativa
// dos últimos 90 dias tem progresso incompatível com o calendário semanal —
// o caso mais apertado tinha 46 dias corridos contra 42 exigidos (4 dias de
// folga). Ainda assim, ENSAIO é o padrão; rode com --commit para gravar.
import 'dotenv/config';
import { getDb, schema } from '../server/db/client';
import { asc, eq } from 'drizzle-orm';

const DIAS_POR_MODULO = 7;

async function main() {
  const commit = process.argv.includes('--commit');
  const db = getDb();
  if (!db) {
    console.error('Sem DATABASE_URL — nada a configurar (modo JSON não tem esta tabela).');
    process.exit(1);
  }

  const cursos = await db
    .select({ id: schema.courses.id, title: schema.courses.title, active: schema.courses.active })
    .from(schema.courses);

  const ativos = cursos.filter((c) => c.active !== false);
  console.log(`${cursos.length} cursos, ${ativos.length} ativos.\n`);

  type Mudanca = {
    moduloId: string;
    curso: string;
    titulo: string;
    ordem: number;
    dias: number | null;
  };
  const mudancas: Mudanca[] = [];

  for (const curso of ativos) {
    const modulos = await db
      .select({
        id: schema.modules.id,
        title: schema.modules.title,
        order: schema.modules.order,
        releaseAfterEnrollmentDays: schema.modules.releaseAfterEnrollmentDays,
        releaseAt: schema.modules.releaseAt,
      })
      .from(schema.modules)
      .where(eq(schema.modules.courseId, curso.id))
      .orderBy(asc(schema.modules.order));

    modulos.forEach((m, i) => {
      // Drip absoluto (releaseAt) não é deste script — se alguém já configurou
      // uma data fixa, não mexe: os dois se combinam pelo MAIS TARDE, e
      // sobrescrever o relativo por cima não muda a intenção de quem gravou o
      // absoluto.
      const dias = i === 0 ? null : i * DIAS_POR_MODULO;
      if (m.releaseAfterEnrollmentDays === dias) return; // já está assim
      mudancas.push({ moduloId: m.id, curso: curso.title, titulo: m.title, ordem: i + 1, dias });
    });
  }

  console.log(`${mudancas.length} módulo(s) para configurar:\n`);
  for (const m of mudancas) {
    console.log(
      `  [${m.curso}] módulo ${m.ordem} "${m.titulo.slice(0, 50)}" -> ${
        m.dias === null ? 'sem trava (imediato)' : `libera em ${m.dias} dias`
      }`,
    );
  }

  if (!commit) {
    console.log('\nEnsaio — nada gravado. Rode com --commit para aplicar.');
    process.exit(0);
  }

  for (const m of mudancas) {
    await db
      .update(schema.modules)
      .set({ releaseAfterEnrollmentDays: m.dias })
      .where(eq(schema.modules.id, m.moduloId));
  }
  console.log(`\n${mudancas.length} módulo(s) gravado(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

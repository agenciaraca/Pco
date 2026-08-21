/**
 * Smoke da carência em massa: dar prazo a quem a política deixaria vencido.
 *
 * É uma escrita em muitas linhas de uma vez, disparada por um clique. Os dois
 * modos de falhar são caros e opostos: gravar em quem não devia (encurtar o
 * acesso de alguém que tinha prazo próprio) ou não gravar em quem devia (o
 * dono acha que salvou a turma e não salvou).
 *
 * Trabalha num curso descartável, criado e apagado aqui. Não encosta em
 * matrícula de aluno de verdade.
 *
 * Uso (no VPS, dentro de ~/ava-pco):
 *   DATABASE_URL=... AUTH_STORE=db npx tsx scripts/smoke_carencia.ts
 */

import { getDb, schema } from '../server/db/client';
import { eq, and, inArray } from 'drizzle-orm';
import { darCarencia, simularPrazoDoCurso } from '../server/access/impacto';

const log = (m: string) => console.log(`[smoke-carencia] ${m}`);
const CURSO = 'curso-smoke-carencia';
const ALUNOS = ['smk-antigo', 'smk-recente', 'smk-proprio'];

let falhas = 0;
function checa(cond: boolean, desc: string): void {
  if (cond) log(`  ok    ${desc}`);
  else {
    falhas++;
    log(`  FALHA ${desc}`);
  }
}

async function limpar(): Promise<void> {
  const db = getDb()!;
  await db.delete(schema.enrollments).where(eq(schema.enrollments.courseId, CURSO));
  await db.delete(schema.students).where(inArray(schema.students.id, ALUNOS));
  await db.delete(schema.users).where(inArray(schema.users.id, ALUNOS));
  await db.delete(schema.courses).where(eq(schema.courses.id, CURSO));
}

async function main(): Promise<void> {
  const db = getDb();
  if (!db) {
    log('sem DATABASE_URL — este smoke é para produção.');
    process.exitCode = 1;
    return;
  }

  await limpar();

  await db.insert(schema.courses).values({
    id: CURSO,
    slug: CURSO,
    title: 'Curso descartável (smoke de carência)',
    shortTitle: 'Smoke',
    description: 'Criado e apagado pelo smoke.',
    coverColor: 'from-pco-blue to-pco-cyan',
    totalHours: 1,
    active: false,
  } as never);

  const agora = new Date();
  const anosAtras = new Date(agora.getTime() - 1000 * 60 * 60 * 24 * 365 * 3);
  const mesPassado = new Date(agora.getTime() - 1000 * 60 * 60 * 24 * 30);
  const proprio = new Date(agora.getTime() + 1000 * 60 * 60 * 24 * 900);

  const casos = [
    { id: 'smk-antigo', entrou: anosAtras, expira: null, nota: 'entrou há 3 anos, sem prazo' },
    { id: 'smk-recente', entrou: mesPassado, expira: null, nota: 'entrou mês passado' },
    { id: 'smk-proprio', entrou: anosAtras, expira: proprio, nota: 'antigo, mas com prazo próprio' },
  ];

  for (const c of casos) {
    await db.insert(schema.users).values({
      id: c.id,
      email: `${c.id}@smoke.local`,
      name: c.id,
      role: 'student',
    } as never);
    await db.insert(schema.students).values({ id: c.id, userId: c.id } as never);
    await db.insert(schema.enrollments).values({
      id: `enr-${c.id}`,
      studentId: c.id,
      courseId: CURSO,
      progress: 0,
      enrolledAt: c.entrou,
      expiresAt: c.expira,
    } as never);
    log(`  ${c.id}: ${c.nota}`);
  }

  const antes = await simularPrazoDoCurso(CURSO, 6);
  checa(antes.total === 3, 'a simulação vê as três matrículas');
  checa(antes.expirados === 1, `só o antigo sem prazo vence com 6 meses (viu ${antes.expirados})`);
  checa(antes.comPrazoProprio === 1, 'reconhece quem tem prazo próprio');

  const ate = new Date(agora.getTime() + 1000 * 60 * 60 * 24 * 90);
  const r = await darCarencia(CURSO, 6, ate.toISOString());
  checa(r.afetados === 1, `gravou em uma matrícula só (gravou em ${r.afetados})`);

  const linhas = await db
    .select()
    .from(schema.enrollments)
    .where(eq(schema.enrollments.courseId, CURSO));
  const porId = new Map(linhas.map((l) => [l.studentId, l]));

  checa(
    porId.get('smk-antigo')?.expiresAt?.toISOString().slice(0, 10) === ate.toISOString().slice(0, 10),
    'o vencido ganhou a data da carência',
  );
  checa(porId.get('smk-recente')?.expiresAt === null, 'quem não vencia ficou intocado');
  checa(
    porId.get('smk-proprio')?.expiresAt?.toISOString().slice(0, 10) ===
      proprio.toISOString().slice(0, 10),
    'quem tinha prazo próprio não teve o prazo encurtado',
  );

  const depois = await simularPrazoDoCurso(CURSO, 6);
  checa(depois.expirados === 0, 'depois da carência ninguém está vencido');

  await limpar();
  log('curso descartável removido');

  log('');
  if (falhas === 0) log('TUDO OK — a carência acerta o alvo e só o alvo.');
  else {
    log(`${falhas} FALHA(S).`);
    process.exitCode = 1;
  }
}

void main().catch(async (e) => {
  console.error(e);
  try {
    await limpar();
  } catch {
    /* já era */
  }
  process.exitCode = 1;
});

/**
 * Prepara (e limpa) uma jornada de convidado de ponta a ponta, para ser
 * percorrida no navegador como um aluno de verdade.
 *
 * Cria uma conta com matrícula num curso real, gera o link de convite e imprime
 * a URL. O resto — abrir o link, definir a senha, entrar e ver o curso — é feito
 * no navegador, porque é exatamente aí que moram os problemas que nenhum teste
 * de servidor pega: a tela que não explica o que fazer, o botão que não aparece,
 * o curso que some depois do login.
 *
 * Uso (no VPS, dentro de ~/ava-pco):
 *   npx tsx scripts/jornada_convidado.ts --preparar
 *   npx tsx scripts/jornada_convidado.ts --limpar
 */

import { getDb, schema } from '../server/db/client';
import { eq, and } from 'drizzle-orm';
import * as store from '../server/auth/users-store';
import { createResetToken } from '../server/auth/password-reset';

const PREPARAR = process.argv.includes('--preparar');
const LIMPAR = process.argv.includes('--limpar');
const EMAIL = 'jornada.convidado@pco.local';
const BASE = process.env.PUBLIC_ORIGIN ?? 'https://ava.psicanaliseclinica.online';
const log = (m: string) => console.log(`[jornada] ${m}`);

async function limpar(): Promise<void> {
  const db = getDb();
  await store.loadUsers();
  const u = await store.findUserByEmail(EMAIL);
  if (db && u) {
    await db.delete(schema.enrollments).where(eq(schema.enrollments.studentId, u.id));
    await db.delete(schema.students).where(eq(schema.students.id, u.id));
    await db.delete(schema.passwordResetTokens).where(eq(schema.passwordResetTokens.userId, u.id));
  }
  if (u) await store.deleteUser(u.id);
  log(u ? 'conta de jornada removida' : 'nada a remover');
}

async function main(): Promise<void> {
  const db = getDb();
  if (!db) {
    log('sem DATABASE_URL — este script é para produção.');
    process.exitCode = 1;
    return;
  }

  if (LIMPAR) {
    await limpar();
    return;
  }
  if (!PREPARAR) {
    log('informe --preparar ou --limpar');
    process.exitCode = 1;
    return;
  }

  await limpar();

  // Curso real, com aulas, para a jornada terminar em algo de verdade.
  const cursos = (await db
    .select({ id: schema.courses.id, title: schema.courses.title })
    .from(schema.courses)
    .where(eq(schema.courses.active, true))) as Array<{ id: string; title: string }>;
  const comAulas: Array<{ id: string; title: string; aulas: number }> = [];
  for (const c of cursos) {
    const aulas = await db
      .select({ id: schema.lessons.id })
      .from(schema.lessons)
      .where(eq(schema.lessons.courseId, c.id));
    comAulas.push({ ...c, aulas: aulas.length });
  }
  comAulas.sort((a, b) => b.aulas - a.aulas);
  const curso = comAulas[0];
  if (!curso || curso.aulas === 0) {
    log('nenhum curso ativo com aulas — a jornada não teria o que mostrar');
    process.exitCode = 1;
    return;
  }

  await store.loadUsers();
  const criada = await store.createUser({
    email: EMAIL,
    name: 'Jornada do Convidado',
    role: 'student',
    password: store.generatePassword(24),
  });

  await db.insert(schema.students).values({
    id: criada.id,
    userId: criada.id,
    weeklyGoalMinutes: 180,
    totalStudyMinutes: 0,
    riskScore: 0,
    status: 'ativo',
  });
  await db.insert(schema.enrollments).values({
    id: `enr-${criada.id}-${curso.id}`,
    studentId: criada.id,
    courseId: curso.id,
    progress: 0,
    enrolledAt: new Date(),
    expiresAt: null,
  });

  const antes = process.env.RESET_TOKEN_TTL_MINUTES;
  process.env.RESET_TOKEN_TTL_MINUTES = String(7 * 24 * 60);
  const t = await createResetToken(criada.id, EMAIL);
  if (antes === undefined) delete process.env.RESET_TOKEN_TTL_MINUTES;
  else process.env.RESET_TOKEN_TTL_MINUTES = antes;

  log(`conta: ${criada.id}`);
  log(`curso: ${curso.title} (${curso.aulas} aulas)`);
  log(`LINK ${BASE}/redefinir-senha?token=${encodeURIComponent(t.token)}`);
  log('percorra no navegador; depois rode com --limpar');
}

void main();

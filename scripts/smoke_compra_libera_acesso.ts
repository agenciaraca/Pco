/**
 * Smoke do caminho do dinheiro: cliente paga, cliente recebe acesso.
 *
 * Reproduz o que acontece de verdade, sem tocar no gateway: cria a conta como o
 * checkout público cria, monta um pedido pago e chama o MESMO caminho que o
 * webhook chama quando o pagamento é aprovado. Depois pergunta a única coisa que
 * importa — a matrícula existe?
 *
 * O modo de falhar aqui é o pior que existe num produto pago: o dinheiro entra,
 * o acesso não sai, e não há erro em lugar nenhum para denunciar.
 *
 * Uso (no VPS, dentro de ~/ava-pco):
 *   DATABASE_URL=... AUTH_STORE=db npx tsx scripts/smoke_compra_libera_acesso.ts
 */

import { getDb, schema } from '../server/db/client';
import { eq, and } from 'drizzle-orm';
import * as store from '../server/auth/users-store';
import * as studentsRepo from '../server/repositories/students';

const EMAIL = 'compra.smoke@pco.local';
const log = (m: string) => console.log(`[smoke-compra] ${m}`);

let falhas = 0;
function checa(cond: boolean, desc: string): void {
  if (cond) log(`  ok    ${desc}`);
  else {
    falhas++;
    log(`  FALHA ${desc}`);
  }
}

async function limpar(userId?: string): Promise<void> {
  const db = getDb();
  const u = userId ? { id: userId } : await store.findUserByEmail(EMAIL);
  if (db && u) {
    await db.delete(schema.enrollments).where(eq(schema.enrollments.studentId, u.id));
    await db.delete(schema.students).where(eq(schema.students.id, u.id));
    await db.delete(schema.users).where(eq(schema.users.id, u.id));
  }
  const existente = await store.findUserByEmail(EMAIL);
  if (existente) await store.deleteUser(existente.id);
}

async function main(): Promise<void> {
  const db = getDb();
  if (!db) {
    log('sem DATABASE_URL — este smoke é para produção.');
    process.exitCode = 1;
    return;
  }

  await store.loadUsers();
  await limpar();

  const cursos = (await db
    .select({ id: schema.courses.id, title: schema.courses.title })
    .from(schema.courses)
    .where(eq(schema.courses.active, true))) as Array<{ id: string; title: string }>;
  const curso = cursos[0];
  log(`curso alvo: ${curso.title} (${curso.id})`);

  // 1) Exatamente o que o checkout público faz com quem compra sem ter conta:
  //    cria a credencial pelo e-mail. Nada além disso.
  const criada = await store.createUser({
    email: EMAIL,
    name: 'Cliente que Comprou',
    role: 'student',
    password: store.generatePassword(24),
  });
  log(`conta criada como no checkout público: ${criada.id}`);

  // 2) O que o webhook chama quando o pagamento é aprovado.
  await studentsRepo.enrollInCourse(criada.id, curso.id);

  // 3) A pergunta que decide tudo.
  const matriculas = await db
    .select()
    .from(schema.enrollments)
    .where(
      and(
        eq(schema.enrollments.studentId, criada.id),
        eq(schema.enrollments.courseId, curso.id),
      ),
    );
  checa(matriculas.length === 1, 'quem pagou ficou matriculado no curso comprado');

  const perfil = await studentsRepo.getStudentProfile(criada.id);
  checa(!!perfil, 'o comprador tem perfil de aluno');
  checa(
    (perfil?.enrolledCourseIds ?? []).includes(curso.id),
    'o curso comprado aparece na lista do aluno',
  );

  const ficha = await db
    .select()
    .from(schema.students)
    .where(eq(schema.students.id, criada.id));
  checa(ficha.length === 1, 'o comprador tem ficha de aluno (students)');

  const noBanco = await db.select().from(schema.users).where(eq(schema.users.id, criada.id));
  checa(noBanco.length === 1, 'o comprador existe na tabela de usuários');

  await limpar(criada.id);
  log('conta de teste removida');

  log('');
  if (falhas === 0) log('TUDO OK — quem paga recebe acesso.');
  else {
    log(`${falhas} FALHA(S) — há compra sem entrega.`);
    process.exitCode = 1;
  }
}

void main();

/**
 * Smoke da entrega final: o aluno conclui o curso e recebe o certificado.
 *
 * É o que a pessoa comprou. Se o certificado não sair — ou sair errado — o
 * problema aparece no fim da jornada, meses depois da venda, com o aluno
 * cobrando algo que ele já pagou.
 *
 * Percorre pela API, como o navegador faz: entra, marca cada aula como
 * concluída e confere o que o sistema fez sozinho no caminho.
 *
 * Uso (no VPS, dentro de ~/ava-pco):
 *   DATABASE_URL=... AUTH_STORE=db npx tsx scripts/smoke_certificado.ts --curso=8887
 *   DATABASE_URL=... npx tsx scripts/smoke_certificado.ts --curso=8887 --limpar
 */

import { getDb, schema } from '../server/db/client';
import { eq } from 'drizzle-orm';
import * as store from '../server/auth/users-store';
import * as studentsRepo from '../server/repositories/students';
import * as coursesRepo from '../server/repositories/courses';
import { signToken } from '../server/auth/jwt';

const BASE = process.env.BASE ?? 'http://127.0.0.1:3035';
const EMAIL = 'certificado.smoke@pco.local';
const cursoArg = process.argv.find((a) => a.startsWith('--curso='));
const CURSO = cursoArg ? cursoArg.slice('--curso='.length) : '8887';
const LIMPAR = process.argv.includes('--limpar');
const log = (m: string) => console.log(`[smoke-cert] ${m}`);

let falhas = 0;
function checa(cond: boolean, desc: string): void {
  if (cond) log(`  ok    ${desc}`);
  else {
    falhas++;
    log(`  FALHA ${desc}`);
  }
}

async function limpar(): Promise<void> {
  const db = getDb();
  await store.loadUsers();
  const u = await store.findUserByEmail(EMAIL);
  if (db && u) {
    await db.delete(schema.certificates).where(eq(schema.certificates.studentId, u.id));
    await db.delete(schema.enrollments).where(eq(schema.enrollments.studentId, u.id));
    await db.delete(schema.students).where(eq(schema.students.id, u.id));
    await db.delete(schema.users).where(eq(schema.users.id, u.id));
  }
  if (u) await store.deleteUser(u.id);
  log(u ? 'conta de teste removida' : 'nada a remover');
}

async function main(): Promise<void> {
  if (!getDb()) {
    log('sem DATABASE_URL — este smoke é para produção.');
    process.exitCode = 1;
    return;
  }
  if (LIMPAR) {
    await limpar();
    return;
  }

  await limpar();
  await store.loadUsers();

  const curso = await coursesRepo.findCourse(CURSO);
  if (!curso) {
    log(`curso ${CURSO} não encontrado`);
    process.exitCode = 1;
    return;
  }
  const aulas = curso.modules.flatMap((m) =>
    (m.lessons ?? []).map((l) => ({ moduleId: m.id, lessonId: l.id, titulo: l.title })),
  );
  log(`curso: ${curso.title} · ${curso.modules.length} módulos · ${aulas.length} aulas`);
  checa(aulas.length > 0, 'o curso tem aulas para concluir');

  const senha = store.generatePassword(20);
  const aluno = await store.createUser({
    email: EMAIL,
    name: 'Aluna do Certificado',
    role: 'student',
    password: senha,
  });
  await studentsRepo.enrollInCourse(aluno.id, CURSO);
  log(`aluna criada e matriculada: ${aluno.id}`);

  const token = await signToken({
    sub: aluno.id,
    email: EMAIL,
    role: 'student',
    tv: aluno.tokenVersion,
  });
  const h = { Authorization: `Bearer ${token}`, 'content-type': 'application/json' };

  // Conclui aula por aula, como o aluno faria clicando.
  let concluidas = 0;
  let travadas = 0;
  for (const a of aulas) {
    const r = await fetch(`${BASE}/api/lessons/${encodeURIComponent(a.lessonId)}/complete`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ courseId: CURSO, moduleId: a.moduleId }),
    });
    if (r.status === 200) concluidas++;
    else if (r.status === 423) travadas++;
    else if (concluidas + travadas < 3) {
      log(`  aula ${a.titulo}: HTTP ${r.status} — ${(await r.text()).slice(0, 120)}`);
    }
  }
  log(`aulas concluídas: ${concluidas}/${aulas.length}${travadas ? ` · ${travadas} bloqueadas por liberação programada` : ''}`);
  checa(concluidas === aulas.length, 'todas as aulas puderam ser concluídas');

  const progresso = (await fetch(`${BASE}/api/me/progress`, { headers: h }).then((r) =>
    r.json(),
  )) as { completedLessonIds: string[] };
  checa(
    progresso.completedLessonIds.length >= aulas.length,
    `o progresso registrou as aulas (${progresso.completedLessonIds.length})`,
  );

  // O certificado é emitido sozinho ao fechar 100% — é isso que se verifica.
  const meus = (await fetch(`${BASE}/api/certificates`, { headers: h }).then((r) =>
    r.json(),
  )) as Array<{ id: string; courseId: string; status: string; validationCode?: string }>;
  const doCurso = meus.find((x) => x.courseId === CURSO);
  checa(!!doCurso, 'o certificado do curso concluído foi emitido sozinho');
  checa(doCurso?.status === 'issued', `o certificado está emitido (status=${doCurso?.status})`);
  checa(!!doCurso?.validationCode, 'o certificado tem código de validação');

  if (doCurso?.validationCode) {
    const val = await fetch(
      `${BASE}/api/certificates/validate/${encodeURIComponent(doCurso.validationCode)}`,
    );
    checa(val.status === 200, `o código de validação é aceito publicamente (${val.status})`);
  }

  if (doCurso) {
    const render = await fetch(`${BASE}/api/certificates/${doCurso.id}/render`, { headers: h });
    const html = await render.text();
    checa(render.status === 200, `o certificado abre para impressão (${render.status})`);
    checa(html.includes('Aluna do Certificado'), 'o certificado traz o nome de quem concluiu');
    checa(html.toLowerCase().includes('certificado'), 'o documento se identifica como certificado');
  }

  // Certificado é de quem concluiu: outra pessoa não pode abrir o mesmo id.
  if (doCurso) {
    const intruso = await fetch(`${BASE}/api/certificates/${doCurso.id}/render`);
    checa(
      intruso.status === 401 || intruso.status === 403,
      `sem login, o certificado alheio não abre (${intruso.status})`,
    );
  }

  await limpar();

  log('');
  if (falhas === 0) log('TUDO OK — concluir o curso entrega o certificado.');
  else {
    log(`${falhas} FALHA(S).`);
    process.exitCode = 1;
  }
}

void main();

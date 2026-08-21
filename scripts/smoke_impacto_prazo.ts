/**
 * Smoke da simulação de prazo: o número que aparece ao lado do campo confere
 * com o que o banco diz?
 *
 * A conta importa porque decide uma ação de efeito amplo e silencioso. Se ela
 * mentir para menos, o admin salva achando que tranca dez e tranca setecentos.
 *
 * Só lê. Nenhum curso é alterado.
 *
 * Uso (no VPS, dentro de ~/ava-pco):
 *   DATABASE_URL=... AUTH_STORE=db JWT_SECRET=... npx tsx scripts/smoke_impacto_prazo.ts
 */

import { signToken } from '../server/auth/jwt';
import * as store from '../server/auth/users-store';
import { getDb, schema } from '../server/db/client';
import { eq, and, isNull, lt, sql } from 'drizzle-orm';

const BASE = process.env.BASE ?? 'http://127.0.0.1:3035';
const log = (m: string) => console.log(`[smoke-impacto] ${m}`);

let falhas = 0;
function checa(cond: boolean, desc: string): void {
  if (cond) log(`  ok    ${desc}`);
  else {
    falhas++;
    log(`  FALHA ${desc}`);
  }
}

async function main(): Promise<void> {
  const db = getDb();
  if (!db) {
    log('sem DATABASE_URL — este smoke é para produção.');
    process.exitCode = 1;
    return;
  }

  await store.loadUsers();
  const todos = await store.listUsers();
  const admin = todos.find((u) => u.role === 'superadmin') ?? todos.find((u) => u.role === 'admin');
  if (!admin) {
    log('nenhum admin encontrado');
    process.exitCode = 1;
    return;
  }
  const token = await signToken({
    sub: admin.id,
    email: admin.email,
    role: admin.role,
    tv: admin.tokenVersion,
  });
  const h = { Authorization: `Bearer ${token}` };

  // Curso com mais matrículas: é onde um engano custa mais caro.
  const [alvo] = (await db
    .select({ id: schema.enrollments.courseId, n: sql<number>`count(*)::int` })
    .from(schema.enrollments)
    .groupBy(schema.enrollments.courseId)
    .orderBy(sql`count(*) desc`)
    .limit(1)) as Array<{ id: string; n: number }>;
  log(`curso alvo: ${alvo.id} · ${alvo.n} matrículas`);

  for (const meses of [6, 16]) {
    const r = (await fetch(
      `${BASE}/api/admin/courses/${encodeURIComponent(alvo.id)}/impacto-acesso?meses=${meses}`,
      { headers: h },
    ).then((x) => x.json())) as {
      total: number;
      expirados: number;
      vencendo: number;
      exemplos: Array<{ nome: string; desde: string }>;
    };

    // A mesma pergunta, feita ao banco direto.
    const [{ n: esperado }] = (await db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.enrollments)
      .where(
        and(
          eq(schema.enrollments.courseId, alvo.id),
          isNull(schema.enrollments.expiresAt),
          lt(schema.enrollments.enrolledAt, sql`now() - (${meses} || ' months')::interval`),
        ),
      )) as Array<{ n: number }>;

    log(`${meses} meses: API diz ${r.expirados} expirados de ${r.total}; banco diz ${esperado}`);
    checa(r.total === alvo.n, `${meses}m: o total bate com as matrículas do curso`);
    // Tolerância de 1: a API conta em meses de calendário (fim de mês ancorado),
    // o SQL em intervalo — divergem só para quem entrou exatamente na virada.
    checa(
      Math.abs(r.expirados - esperado) <= 1,
      `${meses}m: a conta de expirados confere com o banco`,
    );
    checa(r.exemplos.length > 0, `${meses}m: mostra quem sai primeiro`);
  }

  // Sem prazo não pode trancar ninguém.
  const semPrazo = (await fetch(
    `${BASE}/api/admin/courses/${encodeURIComponent(alvo.id)}/impacto-acesso`,
    { headers: h },
  ).then((x) => x.json())) as { expirados: number; meses: number | null };
  checa(semPrazo.expirados === 0, 'sem prazo declarado, ninguém perde acesso');
  checa(semPrazo.meses === null, 'sem prazo, a resposta diz null');

  const semLogin = await fetch(
    `${BASE}/api/admin/courses/${encodeURIComponent(alvo.id)}/impacto-acesso?meses=6`,
  );
  checa(semLogin.status === 401 || semLogin.status === 403, 'a rota exige login de admin');

  log('');
  if (falhas === 0) log('TUDO OK — a simulação confere com o banco.');
  else {
    log(`${falhas} FALHA(S).`);
    process.exitCode = 1;
  }
}

void main();

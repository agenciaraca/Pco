/**
 * Carga cirúrgica dos dados v3 recuperados (data/*.json) para o Postgres de
 * produção (DivZ), corrigindo a base quebrada da v2.
 *
 * ESCOPO (só o que está errado em prod): users(role=student) + students +
 * enrollments. NÃO toca em courses/modules/lessons (prod tem conteúdo mais
 * rico) nem em contas admin/superadmin.
 *
 * Estratégia = RECONCILIAÇÃO por e-mail, dentro de UMA transação:
 *   1. UPSERT users(student)  — preserva o ID que produção já usa
 *   2. UPSERT students        — último acesso nunca envelhece
 *   3. UPSERT enrollments     — data real de matrícula + vencimento; progresso nunca regride
 *   4. Ausentes na fonte      — marcados como inativos, NÃO apagados
 *
 * Era wipe-and-reload até 17/ago/2026. Deixou de ser quando medimos que o
 * WordPress de origem tinha perdido 160 pessoas desde julho — 256 matrículas,
 * 97 com progresso real — que o wipe apagaria daqui junto. O e-mail virou a
 * chave porque os IDs do conjunto local mudam a cada execução do import.
 *
 * Progresso por curso vive em enrollments.progress (não há tabela `progress`).
 *
 * Uso:
 *   DATABASE_URL=... npx tsx scripts/load_v3_to_divz.ts                   # DRY-RUN (rollback, só conta)
 *   DATABASE_URL=... npx tsx scripts/load_v3_to_divz.ts --commit          # grava de verdade
 *   DATABASE_URL=... npx tsx scripts/load_v3_to_divz.ts --purge-missing   # + apaga quem sumiu da fonte
 *
 * DivZ usa cert self-signed → ssl.rejectUnauthorized=false.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
// Mesma soma de meses que o servidor usa — clampando fim de mês. Duplicar a
// conta aqui daria prazos diferentes dos que a aplicação mostra.
import { addMonths } from '../server/access/course-access';

const COMMIT = process.argv.includes('--commit');
/**
 * Apaga de produção quem não veio na fonte. Desligado por padrão: sumir do
 * WordPress não é ordem para apagar do AVA — ver o passo 4.
 */
const PURGE_MISSING = process.argv.includes('--purge-missing');
const DB_URL = process.env.DATABASE_URL;
const log = (m: string) => console.log(`[load-v3] ${m}`);

if (!DB_URL) {
  console.error('ERRO: defina DATABASE_URL no ambiente.');
  process.exit(1);
}

interface JsonUser {
  id: string;
  email: string;
  name: string;
  role: 'student' | 'admin' | 'superadmin';
  createdAt: string;
  updatedAt?: string;
}
interface JsonStudent {
  id: string;
  email?: string;
  enrolledCourseIds?: string[];
  progressByCourse?: Record<string, number>;
  status?: 'ativo' | 'em_risco' | 'bloqueado' | 'inativo';
  riskScore?: number;
  lastAccessAt?: string;
  createdAt: string;
  weeklyGoalMinutes?: number;
  totalStudyMinutes?: number;
  /** Data real de matrícula por curso, vinda do import. */
  enrollmentDates?: Record<string, string>;
}

async function readJson<T>(file: string): Promise<T[]> {
  const p = path.resolve(process.cwd(), 'data', file);
  const txt = await fs.readFile(p, 'utf8');
  const j = JSON.parse(txt);
  return Array.isArray(j) ? j : [];
}

function toDate(s: string | undefined | null): Date {
  const d = s ? new Date(s) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/** INSERT multi-row em batches, respeitando o limite de params do PG. */
async function batchInsert(
  client: pg.PoolClient | pg.Client,
  sqlHead: string,
  cols: number,
  rows: unknown[][],
  onConflict = '',
): Promise<number> {
  if (rows.length === 0) return 0;
  const maxParams = 60000;
  const perBatch = Math.max(1, Math.floor(maxParams / cols));
  let inserted = 0;
  for (let i = 0; i < rows.length; i += perBatch) {
    const slice = rows.slice(i, i + perBatch);
    const values: unknown[] = [];
    const tuples: string[] = [];
    slice.forEach((r, idx) => {
      const base = idx * cols;
      tuples.push('(' + r.map((_, k) => `$${base + k + 1}`).join(',') + ')');
      values.push(...r);
    });
    const res = await client.query(
      `${sqlHead} VALUES ${tuples.join(',')} ${onConflict}`,
      values,
    );
    inserted += res.rowCount ?? 0;
  }
  return inserted;
}

async function count(client: pg.Client, t: string): Promise<number> {
  const r = await client.query(`select count(*)::int n from "${t}"`);
  return r.rows[0].n as number;
}

function stripSslParams(url: string): string {
  return url
    .replace(/([?&])sslmode=[^&]*/gi, '$1')
    .replace(/([?&])channel_binding=[^&]*/gi, '$1')
    .replace(/[?&]$/, '')
    .replace(/\?&/, '?');
}

async function main(): Promise<void> {
  log(`modo: ${COMMIT ? '*** COMMIT (grava) ***' : 'DRY-RUN (rollback ao final)'}`);
  log(`DATABASE_URL: ${DB_URL.replace(/:[^:@]+@/, ':***@')}`);

  const usersJson = await readJson<JsonUser>('users.json');
  const studentsJson = await readJson<JsonStudent>('admin-students.json');
  const studentUsers = usersJson.filter((u) => u.role === 'student');
  log(`fonte: ${studentUsers.length} users(student) · ${studentsJson.length} admin-students`);

  // Sem stripSslParams o pg moderno lê `sslmode=require` como `verify-full` e
  // recusa o cert self-signed do DivZ (mesma correção de server/db/client.ts).
  const client = new pg.Client({
    connectionString: stripSslParams(DB_URL),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    const before = {
      users: await count(client, 'users'),
      students: await count(client, 'students'),
      enrollments: await count(client, 'enrollments'),
    };
    log(`ANTES  → users=${before.users} students=${before.students} enrollments=${before.enrollments}`);

    // cursos existentes em prod (FK das enrollments) + prazo de acesso de cada
    // um, para gravar o vencimento junto da matrícula.
    const courseRows = (
      await client.query("select id, (meta->>'accessMonths') as access_months from courses")
    ).rows as Array<{ id: string; access_months: string | null }>;
    const prodCourses = new Set(courseRows.map((r) => String(r.id)));
    const accessMonthsByCourse = new Map<string, number>();
    for (const r of courseRows) {
      const m = Number(r.access_months);
      if (Number.isFinite(m) && m > 0) accessMonthsByCourse.set(String(r.id), m);
    }
    log(
      accessMonthsByCourse.size > 0
        ? `prazo  → ${accessMonthsByCourse.size} curso(s) com meses de acesso definidos`
        : 'prazo  → nenhum curso tem meses de acesso definidos; matrículas entram sem vencimento',
    );

    // Quem já existe em produção, indexado por e-mail. O e-mail é a chave
    // estável entre as duas pontas: os IDs do conjunto local são gerados a cada
    // execução do import, então casar por ID reinseriria todo mundo como pessoa
    // nova e quebraria certificados e progresso que apontam para o ID antigo.
    const prodUsers = (
      await client.query("select id, lower(email) as email from users where role='student'")
    ).rows as Array<{ id: string; email: string }>;
    const idPorEmail = new Map(prodUsers.map((r) => [r.email, r.id]));
    log(`prod   → ${prodUsers.length} aluno(s) já cadastrados, casados por e-mail`);

    await client.query('BEGIN');

    // 1) users — insere quem falta, atualiza o nome de quem já está.
    //
    // Não há wipe. A carga de 07/jul apagava tudo e reinseria; hoje sabemos que
    // 160 pessoas com 256 matrículas foram removidas do WordPress de origem, e
    // um wipe as apagaria daqui junto. Ausente na fonte deixou de significar
    // "apagar" e passou a significar "marcar" — ver o passo 4.
    const uRows = studentUsers.map((u) => {
      const email = (u.email || '').toLowerCase();
      return [
        idPorEmail.get(email) ?? u.id, // preserva o ID de produção quando existe
        email,
        u.name,
        'student',
        toDate(u.createdAt),
        toDate(u.updatedAt ?? u.createdAt),
      ];
    });
    const uIns = await batchInsert(
      client,
      'INSERT INTO users (id, email, name, role, created_at, updated_at)',
      6,
      uRows,
      'ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, updated_at = EXCLUDED.updated_at',
    );
    const novos = uRows.filter((r) => !idPorEmail.has(String(r[1]))).length;
    log(`users  → ${uIns} linha(s) afetadas · ${novos} pessoa(s) novas · ${uRows.length - novos} já existiam`);

    // Mapa definitivo e-mail → id, agora incluindo os recém-inseridos.
    const idFinalPorEmail = new Map(
      (
        await client.query("select id, lower(email) as email from users where role='student'")
      ).rows.map((r) => [String(r.email), String(r.id)]),
    );
    // O conjunto local liga student → user pelo id local; para escrever em prod
    // é preciso traduzir pelo e-mail.
    const emailPorIdLocal = new Map(
      studentUsers.map((u) => [u.id, (u.email || '').toLowerCase()]),
    );
    const idProd = (idLocal: string): string | null => {
      const email = emailPorIdLocal.get(idLocal);
      return email ? (idFinalPorEmail.get(email) ?? null) : null;
    };

    // 2) students — upsert preservando o que produção já sabe.
    const validStudents = studentsJson.filter((s) => idProd(s.id));
    const sRows = validStudents.map((s) => {
      const id = idProd(s.id)!;
      return [
        id,
        id, // user_id === id (convenção AVA PCO)
        s.weeklyGoalMinutes ?? 180,
        s.totalStudyMinutes ?? 0,
        s.riskScore ?? 0,
        s.status ?? 'ativo',
        s.lastAccessAt ? toDate(s.lastAccessAt) : null,
        toDate(s.createdAt),
      ];
    });
    const sIns = await batchInsert(
      client,
      'INSERT INTO students (id, user_id, weekly_goal_minutes, total_study_minutes, risk_score, status, last_access_at, created_at)',
      8,
      sRows,
      // `greatest` no último acesso: import histórico não pode envelhecer um
      // acesso mais recente que o aluno tenha feito no próprio AVA.
      `ON CONFLICT (id) DO UPDATE SET
         risk_score = EXCLUDED.risk_score,
         status = EXCLUDED.status,
         last_access_at = greatest(students.last_access_at, EXCLUDED.last_access_at)`,
    );
    log(`students → ${sIns} linha(s) afetadas (${studentsJson.length - validStudents.length} sem user correspondente)`);

    // 3) enrollments — upsert por (aluno, curso), com data real e vencimento.
    const eRows: unknown[][] = [];
    let skipNoCourse = 0;
    let semDataReal = 0;
    let jaVencidas = 0;
    const agora = new Date();
    for (const s of validStudents) {
      const sid = idProd(s.id)!;
      const prog = s.progressByCourse ?? {};
      for (const cid of s.enrolledCourseIds ?? []) {
        if (!prodCourses.has(cid)) {
          skipNoCourse++;
          continue;
        }
        const p = Math.max(0, Math.min(100, Math.round(Number(prog[cid] ?? 0))));
        // Data REAL da matrícula, por curso. Na carga de 07/jul/2026 usávamos
        // `s.createdAt` aqui, que é quando o registro local foi criado — por isso
        // as 1.109 matrículas de produção ficaram todas com a mesma data e o
        // prazo de acesso contaria do dia do import.
        const inicioReal = s.enrollmentDates?.[cid];
        if (!inicioReal) semDataReal++;
        const enrolledAt = toDate(inicioReal ?? s.createdAt);
        const months = accessMonthsByCourse.get(cid);
        const expiresAt = months
          ? new Date(addMonths(enrolledAt.toISOString(), months))
          : null;
        if (expiresAt && expiresAt <= agora) jaVencidas++;
        eRows.push([`enr-${sid}-${cid}`, sid, cid, p, enrolledAt, expiresAt]);
      }
    }
    const eIns = await batchInsert(
      client,
      'INSERT INTO enrollments (id, student_id, course_id, progress, enrolled_at, expires_at)',
      6,
      eRows,
      // Progresso nunca regride: se o aluno avançou no AVA depois da carga, o
      // número da fonte é o desatualizado. Vencimento manual (extensão vendida)
      // também não é sobrescrito pelo cálculo — `coalesce` mantém o que existe.
      `ON CONFLICT (student_id, course_id) DO UPDATE SET
         progress = greatest(enrollments.progress, EXCLUDED.progress),
         enrolled_at = EXCLUDED.enrolled_at,
         expires_at = coalesce(enrollments.expires_at, EXCLUDED.expires_at)`,
    );
    log(`enroll → ${eIns} linha(s) afetadas (${skipNoCourse} puladas: curso ausente em prod)`);
    log(
      `datas  → ${eRows.length - semDataReal} com data real de matrícula, ${semDataReal} sem (usaram a data do registro)`,
    );
    log(`prazo  → ${jaVencidas} matrícula(s) já entram VENCIDAS com os prazos atuais`);

    // 4) Quem está em produção e NÃO veio na fonte.
    //
    // Some do WordPress ≠ deve sumir do AVA. Em 17/ago/2026 eram 160 pessoas
    // (52 desistentes, 35 inadimplentes, 7 reembolsados, 14 alunos ativos…),
    // com 256 matrículas e 97 delas com progresso real. Apagar isso é perder
    // histórico de estudo de forma irreversível; o padrão é marcar como inativo
    // e deixar a decisão comercial para depois.
    const emailsDaFonte = new Set(uRows.map((r) => String(r[1])));
    const ausentes = prodUsers.filter((u) => !emailsDaFonte.has(u.email));
    if (ausentes.length > 0) {
      const ids = ausentes.map((u) => u.id);
      const detalhe = (
        await client.query(
          `select count(*)::int as matriculas,
                  count(*) FILTER (WHERE progress > 0)::int as com_progresso
             from enrollments where student_id = ANY($1::text[])`,
          [ids],
        )
      ).rows[0] as { matriculas: number; com_progresso: number };

      if (PURGE_MISSING) {
        const dEnr = (
          await client.query('DELETE FROM enrollments WHERE student_id = ANY($1::text[])', [ids])
        ).rowCount ?? 0;
        const dStu = (
          await client.query('DELETE FROM students WHERE id = ANY($1::text[])', [ids])
        ).rowCount ?? 0;
        const dUsr = (
          await client.query('DELETE FROM users WHERE id = ANY($1::text[])', [ids])
        ).rowCount ?? 0;
        log(`ausentes → APAGADOS por --purge-missing: -${dUsr} pessoas · -${dStu} fichas · -${dEnr} matrículas`);
      } else {
        const marcados = (
          await client.query(
            "UPDATE students SET status = 'inativo' WHERE id = ANY($1::text[]) AND status <> 'inativo'",
            [ids],
          )
        ).rowCount ?? 0;
        log(
          `ausentes → ${ausentes.length} pessoa(s) não vieram na fonte: PRESERVADAS, ${marcados} marcada(s) como inativas`,
        );
        log(
          `ausentes → guardam ${detalhe.matriculas} matrícula(s), ${detalhe.com_progresso} com progresso. Use --purge-missing para apagar de vez.`,
        );
      }
    } else {
      log('ausentes → nenhuma: toda a base de produção veio na fonte');
    }

    // conta dentro da transação (antes de decidir commit/rollback)
    const after = {
      users: await count(client, 'users'),
      students: await count(client, 'students'),
      enrollments: await count(client, 'enrollments'),
    };
    log(`DEPOIS → users=${after.users} students=${after.students} enrollments=${after.enrollments}`);
    // sanidade
    const avg = after.students > 0 ? (after.enrollments / after.students).toFixed(2) : '0';
    log(`sanidade → ${avg} matrículas/aluno`);

    if (COMMIT) {
      await client.query('COMMIT');
      log('*** COMMIT feito — produção atualizada. ***');
    } else {
      await client.query('ROLLBACK');
      log('DRY-RUN → ROLLBACK (nada gravado). Rode com --commit para aplicar.');
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[load-v3] ERRO — rollback feito:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();

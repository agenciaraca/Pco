/**
 * Carga cirúrgica dos dados v3 recuperados (data/*.json) para o Postgres de
 * produção (DivZ), corrigindo a base quebrada da v2.
 *
 * ESCOPO (só o que está errado em prod): substitui users(role=student) +
 * students + enrollments. NÃO toca em courses/modules/lessons (prod tem
 * conteúdo mais rico) nem em contas admin/superadmin.
 *
 * Estratégia = wipe-and-reload dentro de UMA transação:
 *   1. DELETE enrollments  → DELETE students → DELETE users WHERE role='student'
 *   2. INSERT users(student)  (ON CONFLICT(email) DO NOTHING — não colide c/ admin)
 *   3. INSERT students        (só os que ficaram com user; FK-safe)
 *   4. INSERT enrollments     (só p/ course existente em prod; progress = progressByCourse)
 *
 * Progresso por curso vive em enrollments.progress (não há tabela `progress`).
 *
 * Uso:
 *   DATABASE_URL=... npx tsx scripts/load_v3_to_divz.ts            # DRY-RUN (rollback, só conta)
 *   DATABASE_URL=... npx tsx scripts/load_v3_to_divz.ts --commit   # grava de verdade
 *
 * DivZ usa cert self-signed → ssl.rejectUnauthorized=false.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const COMMIT = process.argv.includes('--commit');
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

async function main(): Promise<void> {
  log(`modo: ${COMMIT ? '*** COMMIT (grava) ***' : 'DRY-RUN (rollback ao final)'}`);
  log(`DATABASE_URL: ${DB_URL.replace(/:[^:@]+@/, ':***@')}`);

  const usersJson = await readJson<JsonUser>('users.json');
  const studentsJson = await readJson<JsonStudent>('admin-students.json');
  const studentUsers = usersJson.filter((u) => u.role === 'student');
  log(`fonte: ${studentUsers.length} users(student) · ${studentsJson.length} admin-students`);

  const client = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    const before = {
      users: await count(client, 'users'),
      students: await count(client, 'students'),
      enrollments: await count(client, 'enrollments'),
    };
    log(`ANTES  → users=${before.users} students=${before.students} enrollments=${before.enrollments}`);

    // cursos existentes em prod (FK das enrollments)
    const prodCourses = new Set(
      (await client.query('select id from courses')).rows.map((r) => String(r.id)),
    );

    await client.query('BEGIN');

    // 1) wipe (ordem respeita FKs)
    const dEnr = (await client.query('DELETE FROM enrollments')).rowCount ?? 0;
    const dStu = (await client.query('DELETE FROM students')).rowCount ?? 0;
    const dUsr = (await client.query("DELETE FROM users WHERE role = 'student'")).rowCount ?? 0;
    log(`wipe   → -${dEnr} enrollments · -${dStu} students · -${dUsr} users(student)`);

    // 2) insert users(student)
    const uRows = studentUsers.map((u) => [
      u.id,
      u.email,
      u.name,
      'student',
      toDate(u.createdAt),
      toDate(u.updatedAt ?? u.createdAt),
    ]);
    const uIns = await batchInsert(
      client,
      'INSERT INTO users (id, email, name, role, created_at, updated_at)',
      6,
      uRows,
      'ON CONFLICT (email) DO NOTHING',
    );
    log(`users  → +${uIns} inseridos (${uRows.length - uIns} pulados por e-mail duplicado)`);

    // ids de user realmente presentes (p/ FK dos students)
    const liveUserIds = new Set(
      (await client.query("select id from users where role='student'")).rows.map((r) => String(r.id)),
    );

    // 3) insert students (só com user vivo; student.id === user.id)
    const validStudents = studentsJson.filter((s) => liveUserIds.has(s.id));
    const sRows = validStudents.map((s) => [
      s.id,
      s.id, // user_id === id (convenção AVA PCO)
      s.weeklyGoalMinutes ?? 180,
      s.totalStudyMinutes ?? 0,
      s.riskScore ?? 0,
      s.status ?? 'ativo',
      s.lastAccessAt ? toDate(s.lastAccessAt) : null,
      toDate(s.createdAt),
    ]);
    const sIns = await batchInsert(
      client,
      'INSERT INTO students (id, user_id, weekly_goal_minutes, total_study_minutes, risk_score, status, last_access_at, created_at)',
      8,
      sRows,
      'ON CONFLICT (id) DO NOTHING',
    );
    log(`students → +${sIns} inseridos (${studentsJson.length - validStudents.length} pulados sem user)`);

    // 4) insert enrollments (progress = progressByCourse[cid] ?? 0)
    const liveStudentIds = new Set(validStudents.map((s) => s.id));
    const eRows: unknown[][] = [];
    let skipNoCourse = 0;
    for (const s of validStudents) {
      if (!liveStudentIds.has(s.id)) continue;
      const prog = s.progressByCourse ?? {};
      for (const cid of s.enrolledCourseIds ?? []) {
        if (!prodCourses.has(cid)) {
          skipNoCourse++;
          continue;
        }
        const p = Math.max(0, Math.min(100, Math.round(Number(prog[cid] ?? 0))));
        eRows.push([`enr-${s.id}-${cid}`, s.id, cid, p, toDate(s.createdAt)]);
      }
    }
    const eIns = await batchInsert(
      client,
      'INSERT INTO enrollments (id, student_id, course_id, progress, enrolled_at)',
      5,
      eRows,
      'ON CONFLICT (id) DO NOTHING',
    );
    log(`enroll → +${eIns} inseridas (${skipNoCourse} puladas: curso ausente em prod)`);

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

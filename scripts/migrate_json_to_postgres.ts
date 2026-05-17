/**
 * Migra data/*.json para Postgres (Drizzle).
 *
 * Pré-requisitos:
 *   1. DATABASE_URL no .env
 *   2. `npm run db:migrate` (aplica DDL)
 *
 * Uso:
 *   npx tsx scripts/migrate_json_to_postgres.ts [--dry-run] [--only=users,courses,...]
 *
 * O script é idempotente — usa onConflictDoNothing por padrão.
 * Para forçar sobrescrita: --upsert (TODO).
 *
 * Não migra (por design):
 *   - sessions.json (não existe — JWT é stateless)
 *   - audit-log.json (mantém local)
 *   - errors.json (mantém local)
 *   - retention-risks.json (re-gerado pelo worker)
 *
 * Ordem de execução:
 *   users → students (admin-students) → courses (com modules/lessons) →
 *   enrollments → news → podcasts → library → certificates → support
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes('--dry-run');
const onlyArg = argv.find((a) => a.startsWith('--only='))?.slice(7);
const ONLY = onlyArg ? new Set(onlyArg.split(',')) : null;

const log = (m: string) => console.log(`[migrate] ${m}`);

async function readJson<T>(file: string): Promise<T[]> {
  const p = path.resolve(process.cwd(), 'data', file);
  try {
    const txt = await fs.readFile(p, 'utf8');
    const parsed = JSON.parse(txt);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function shouldRun(name: string): boolean {
  if (!ONLY) return true;
  return ONLY.has(name);
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('ERRO: DATABASE_URL ausente no env');
    process.exit(1);
  }

  const { getDb, schema } = await import('../server/db/client');
  const db = getDb();
  if (!db) {
    console.error('ERRO: não foi possível conectar ao Postgres');
    process.exit(1);
  }

  log(`DATABASE_URL: ${process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@')}`);
  log(`dry-run: ${DRY_RUN ? 'sim' : 'NÃO (vai gravar)'}`);
  if (ONLY) log(`only: ${[...ONLY].join(', ')}`);

  let total = 0;

  // ---------- Users ----------
  if (shouldRun('users')) {
    const users = await readJson<{
      id: string;
      email: string;
      name: string;
      passwordHash: string;
      role: 'student' | 'admin' | 'superadmin';
      active: boolean;
      tokenVersion?: number;
      createdAt: string;
      updatedAt?: string;
    }>('users.json');
    log(`users.json: ${users.length} registros`);
    if (users.length > 0 && !DRY_RUN) {
      await db
        .insert(schema.users)
        .values(
          users.map((u) => ({
            id: u.id,
            email: u.email,
            name: u.name,
            passwordHash: u.passwordHash,
            role: u.role,
            active: u.active,
            tokenVersion: u.tokenVersion ?? 0,
            createdAt: new Date(u.createdAt),
            updatedAt: u.updatedAt ? new Date(u.updatedAt) : new Date(u.createdAt),
          })),
        )
        .onConflictDoNothing();
      log(`  ✓ inseridos`);
      total += users.length;
    }
  }

  // ---------- Admin Students ----------
  if (shouldRun('students')) {
    const adminStudents = await readJson<{
      id: string;
      name: string;
      email: string;
      enrolledCourseIds: string[];
      progressByCourse: Record<string, number>;
      status: 'ativo' | 'em_risco' | 'bloqueado' | 'inativo';
      riskScore: number;
      lastAccessAt: string;
      createdAt: string;
      weeklyGoalMinutes?: number;
    }>('admin-students.json');
    log(`admin-students.json: ${adminStudents.length} registros`);
    if (adminStudents.length > 0 && !DRY_RUN) {
      // students tem FK pra users.id. Filtra só os que têm user correspondente.
      const userIds = new Set(
        (await db.select({ id: schema.users.id }).from(schema.users)).map((u) => u.id),
      );
      const valid = adminStudents.filter((s) => userIds.has(s.id));
      log(`  ${valid.length} alunos com user existente (${adminStudents.length - valid.length} sem user → pulam)`);
      if (valid.length > 0) {
        const BATCH = 500;
        for (let i = 0; i < valid.length; i += BATCH) {
          const slice = valid.slice(i, i + BATCH);
          await db
            .insert(schema.students)
            .values(
              slice.map((s) => ({
                id: s.id,
                userId: s.id, // students.id === users.id (convenção AVA PCO)
                status: s.status,
                riskScore: s.riskScore ?? 0,
                lastAccessAt: s.lastAccessAt ? new Date(s.lastAccessAt) : null,
                createdAt: new Date(s.createdAt),
                weeklyGoalMinutes: s.weeklyGoalMinutes ?? 180,
              })),
            )
            .onConflictDoNothing();
        }
        log(`  ✓ inseridos`);
        total += valid.length;
      }
    }
  }

  // ---------- Courses + Modules + Lessons ----------
  if (shouldRun('courses')) {
    const courses = await readJson<{
      id: string;
      slug: string;
      title: string;
      shortTitle: string;
      description: string;
      coverColor: string;
      coverImageUrl?: string;
      totalHours: number;
      certificateAvailable: boolean;
      active?: boolean;
      modules: Array<{
        id: string;
        title: string;
        description?: string;
        order: number;
        lessons: Array<{
          id: string;
          title: string;
          durationMinutes: number;
          videoUrl?: string;
          description?: string;
          content?: string;
          isMandatory: boolean;
          order: number;
        }>;
      }>;
    }>('courses.json');
    log(`courses.json: ${courses.length} cursos`);
    if (courses.length > 0 && !DRY_RUN) {
      await db
        .insert(schema.courses)
        .values(
          courses.map((c) => ({
            id: c.id,
            slug: c.slug,
            title: c.title,
            shortTitle: c.shortTitle,
            description: c.description,
            coverColor: c.coverColor,
            totalHours: c.totalHours,
            certificateAvailable: c.certificateAvailable,
            active: c.active !== false,
          })),
        )
        .onConflictDoNothing();
      total += courses.length;

      const allModules = courses.flatMap((c) =>
        c.modules.map((m) => ({ ...m, courseId: c.id })),
      );
      log(`  modules: ${allModules.length}`);
      if (allModules.length > 0) {
        await db
          .insert(schema.modules)
          .values(
            allModules.map((m) => ({
              id: m.id,
              courseId: m.courseId,
              title: m.title,
              description: m.description ?? null,
              order: m.order,
            })),
          )
          .onConflictDoNothing();
        total += allModules.length;
      }

      const allLessons = courses.flatMap((c) =>
        c.modules.flatMap((m) =>
          m.lessons.map((l) => ({
            ...l,
            moduleId: m.id,
            courseId: c.id,
          })),
        ),
      );
      log(`  lessons: ${allLessons.length}`);
      if (allLessons.length > 0) {
        // Insert em batches de 500 (Postgres tem limite de parâmetros)
        const BATCH = 500;
        for (let i = 0; i < allLessons.length; i += BATCH) {
          const slice = allLessons.slice(i, i + BATCH);
          await db
            .insert(schema.lessons)
            .values(
              slice.map((l) => ({
                id: l.id,
                moduleId: l.moduleId,
                courseId: l.courseId,
                title: l.title,
                durationMinutes: l.durationMinutes,
                videoUrl: l.videoUrl ?? null,
                description: l.description ?? null,
                isMandatory: l.isMandatory,
                order: l.order,
              })),
            )
            .onConflictDoNothing();
        }
        total += allLessons.length;
      }
      log(`  ✓ courses+modules+lessons`);
    }
  }

  log(`==== total: ${total} registros migrados ====`);
}

main().catch((err) => {
  console.error('[migrate] erro fatal:', err);
  process.exit(1);
});

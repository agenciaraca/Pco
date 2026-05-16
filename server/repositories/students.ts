import { eq, desc, asc, and, ilike, or, sql, type SQL } from 'drizzle-orm';
import { getDb, schema } from '../db/client';
import { JsonStore } from '../db/json-store';
import * as usersStore from '../auth/users-store';
import {
  adminStudents as seedAdmin,
  currentStudent,
  type AdminStudentRow,
} from '../../src/app/data/seed';
import type { Student } from '../../src/app/types/schema';
import type {
  StudentsFilter,
  CreateStudentInput,
  UpdateStudentInput,
} from '../../shared/schemas';

interface AdminStudentDto extends AdminStudentRow {}

const adminStore = new JsonStore<AdminStudentDto>('admin-students.json', () =>
  seedAdmin.map((s) => ({
    ...s,
    enrolledCourseIds: [...s.enrolledCourseIds],
    progressByCourse: { ...s.progressByCourse },
  })),
);

function newStudentId() {
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function createAdminStudent(
  input: CreateStudentInput,
): Promise<AdminStudentDto> {
  const id = newStudentId();
  const now = new Date();
  const dto: AdminStudentDto = {
    id,
    name: input.name,
    email: input.email,
    enrolledCourseIds: input.enrolledCourseIds,
    progressByCourse: Object.fromEntries(input.enrolledCourseIds.map((cid) => [cid, 0])),
    status: input.status,
    riskScore: 0,
    lastAccessAt: now.toISOString(),
    createdAt: now.toISOString(),
  };

  const db = getDb();
  if (!db) {
    return await adminStore.unshift(dto);
  }

  await db
    .insert(schema.users)
    .values({ id, email: input.email, name: input.name, role: 'student' })
    .onConflictDoNothing();

  await db.insert(schema.students).values({
    id,
    userId: id,
    weeklyGoalMinutes: input.weeklyGoalMinutes,
    totalStudyMinutes: 0,
    riskScore: 0,
    status: input.status,
    lastAccessAt: now,
  });

  if (input.enrolledCourseIds.length > 0) {
    await db.insert(schema.enrollments).values(
      input.enrolledCourseIds.map((courseId) => ({
        id: `enr-${id}-${courseId}`,
        studentId: id,
        courseId,
        progress: 0,
      })),
    );
  }

  return dto;
}

export async function updateAdminStudent(
  id: string,
  patch: UpdateStudentInput,
): Promise<AdminStudentDto | null> {
  const db = getDb();
  if (!db) {
    return await adminStore.modify((list) => {
      const idx = list.findIndex((s) => s.id === id);
      if (idx === -1) return null;
      list[idx] = {
        ...list[idx],
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.email !== undefined ? { email: patch.email } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.enrolledCourseIds !== undefined
          ? {
              enrolledCourseIds: patch.enrolledCourseIds,
              progressByCourse: Object.fromEntries(
                patch.enrolledCourseIds.map((cid) => [
                  cid,
                  list[idx].progressByCourse[cid] ?? 0,
                ]),
              ),
            }
          : {}),
      };
      return list[idx];
    });
  }

  if (patch.name !== undefined || patch.email !== undefined) {
    const userUpdate: Partial<typeof schema.users.$inferInsert> = {};
    if (patch.name !== undefined) userUpdate.name = patch.name;
    if (patch.email !== undefined) userUpdate.email = patch.email;
    if (Object.keys(userUpdate).length > 0) {
      await db.update(schema.users).set(userUpdate).where(eq(schema.users.id, id));
    }
  }

  if (patch.status !== undefined || patch.weeklyGoalMinutes !== undefined) {
    const studentUpdate: Partial<typeof schema.students.$inferInsert> = {};
    if (patch.status !== undefined) studentUpdate.status = patch.status;
    if (patch.weeklyGoalMinutes !== undefined)
      studentUpdate.weeklyGoalMinutes = patch.weeklyGoalMinutes;
    await db.update(schema.students).set(studentUpdate).where(eq(schema.students.id, id));
  }

  if (patch.enrolledCourseIds !== undefined) {
    await db.delete(schema.enrollments).where(eq(schema.enrollments.studentId, id));
    if (patch.enrolledCourseIds.length > 0) {
      await db.insert(schema.enrollments).values(
        patch.enrolledCourseIds.map((courseId) => ({
          id: `enr-${id}-${courseId}-${Math.random().toString(36).slice(2, 5)}`,
          studentId: id,
          courseId,
          progress: 0,
        })),
      );
    }
  }

  return await findAdminStudent(id);
}

export async function setStudentStatus(
  id: string,
  status: 'ativo' | 'em_risco' | 'bloqueado' | 'inativo',
): Promise<AdminStudentDto | null> {
  return updateAdminStudent(id, { status });
}

/**
 * Adiciona courseId ao enrolledCourseIds do aluno se ainda não estiver.
 * Idempotente. Cria entrada mínima para o aluno se ele não existir como adminStudent.
 */
export async function enrollInCourse(
  userId: string,
  courseId: string,
  /**
   * Quando vindo de import histórico, passe o real "último acesso" do
   * aluno (ex: max de started_at/completed_at no sistema de origem) para
   * não setar tudo como "hoje". Em fluxo runtime (aluno clicou em
   * matricule-se agora), omita — vira new Date().
   */
  lastAccessAt?: string,
): Promise<void> {
  // Hidrata nome/email do users-store antes do modify (caso seja stub novo)
  const u = await usersStore.findUserById(userId);
  await adminStore.modify((rows) => {
    let row = rows.find((s) => s.id === userId);
    if (!row) {
      const now = new Date().toISOString();
      const fresh: AdminStudentDto = {
        id: userId,
        name: u?.name || userId,
        email: u?.email || '',
        status: 'ativo',
        riskScore: 0,
        enrolledCourseIds: [],
        progressByCourse: {},
        lastAccessAt: lastAccessAt || now,
        createdAt: lastAccessAt || now,
        enrollmentDates: {},
      };
      rows.push(fresh);
      row = fresh;
    }
    if (!row.enrolledCourseIds.includes(courseId)) {
      row.enrolledCourseIds = [...row.enrolledCourseIds, courseId];
      row.progressByCourse = { ...row.progressByCourse, [courseId]: 0 };
      row.enrollmentDates = {
        ...(row.enrollmentDates ?? {}),
        [courseId]: new Date().toISOString(),
      };
    }
  });
}

/**
 * Retorna a data ISO em que o aluno se matriculou no curso.
 * Fallback (registros antigos sem enrollmentDates): student.createdAt.
 */
export async function getEnrollmentDate(
  userId: string,
  courseId: string,
): Promise<string | null> {
  const all = await adminStore.getAll();
  const row = all.find((s) => s.id === userId);
  if (!row) return null;
  if (!row.enrolledCourseIds.includes(courseId)) return null;
  return row.enrollmentDates?.[courseId] ?? row.createdAt;
}

/**
 * Remove matrícula em curso. Mantém o registro do aluno e o progresso histórico
 * por aula — apenas remove o curso da lista de enrolledCourseIds.
 */
export async function unenrollFromCourse(
  userId: string,
  courseId: string,
): Promise<void> {
  await adminStore.modify((rows) => {
    const row = rows.find((s) => s.id === userId);
    if (!row) return;
    row.enrolledCourseIds = row.enrolledCourseIds.filter((c) => c !== courseId);
    if (row.progressByCourse) {
      const next = { ...row.progressByCourse };
      delete next[courseId];
      row.progressByCourse = next;
    }
  });
}

/**
 * Atualiza progressByCourse[courseId] = percentual (0..100). Usado pelo
 * importer para refletir progresso vindo do LearnDash. Cria registro mínimo
 * de student se necessário (mesmo padrão do enrollInCourse).
 */
export async function setCourseProgress(
  userId: string,
  courseId: string,
  percent: number,
  /** ver enrollInCourse — opcional, default = agora. */
  lastAccessAt?: string,
): Promise<void> {
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  const u = await usersStore.findUserById(userId);
  await adminStore.modify((rows) => {
    let row = rows.find((s) => s.id === userId);
    if (!row) {
      const now = new Date().toISOString();
      const fresh: AdminStudentDto = {
        id: userId,
        name: u?.name || userId,
        email: u?.email || '',
        status: 'ativo',
        riskScore: 0,
        enrolledCourseIds: [],
        progressByCourse: {},
        lastAccessAt: lastAccessAt || now,
        createdAt: lastAccessAt || now,
        enrollmentDates: {},
      };
      rows.push(fresh);
      row = fresh;
    }
    if (!row.enrolledCourseIds.includes(courseId)) {
      row.enrolledCourseIds = [...row.enrolledCourseIds, courseId];
    }
    row.progressByCourse = { ...row.progressByCourse, [courseId]: pct };
    // Atualiza lastAccessAt apenas se o evento for mais recente que o atual
    // (evita import histórico sobrescrever um valor mais novo).
    const candidate = lastAccessAt;
    if (candidate && (!row.lastAccessAt || candidate > row.lastAccessAt)) {
      row.lastAccessAt = candidate;
    }
  });
}

export async function deleteAdminStudent(id: string): Promise<boolean> {
  const db = getDb();
  if (!db) {
    return await adminStore.remove((s) => s.id === id);
  }
  const rows = await db
    .delete(schema.students)
    .where(eq(schema.students.id, id))
    .returning({ id: schema.students.id });
  await db.delete(schema.users).where(eq(schema.users.id, id));
  return rows.length > 0;
}

export async function getCurrentStudent(): Promise<Student> {
  const db = getDb();
  if (!db) return currentStudent;

  const rows = await db
    .select({
      s: schema.students,
      u: schema.users,
    })
    .from(schema.students)
    .leftJoin(schema.users, eq(schema.users.id, schema.students.userId))
    .where(eq(schema.students.id, currentStudent.id));

  const found = rows[0];
  if (!found || !found.u) return currentStudent;

  // Coletar cursos do aluno
  const enrollments = await db
    .select()
    .from(schema.enrollments)
    .where(eq(schema.enrollments.studentId, found.s.id));

  return {
    id: found.s.id,
    name: found.u.name,
    email: found.u.email,
    role: 'student',
    avatarUrl: found.u.avatarUrl ?? undefined,
    enrolledCourseIds: enrollments.map((e) => e.courseId),
    lastAccessAt: found.s.lastAccessAt?.toISOString(),
    weeklyGoalMinutes: found.s.weeklyGoalMinutes,
    totalStudyMinutes: found.s.totalStudyMinutes,
    riskScore: found.s.riskScore,
    createdAt: found.s.createdAt.toISOString(),
  };
}

export async function listAdminStudents(filter: StudentsFilter): Promise<AdminStudentDto[]> {
  const db = getDb();
  if (!db) {
    return await filterSeed(filter);
  }

  const baseQuery = db
    .select({
      id: schema.students.id,
      name: schema.users.name,
      email: schema.users.email,
      status: schema.students.status,
      riskScore: schema.students.riskScore,
      lastAccessAt: schema.students.lastAccessAt,
      createdAt: schema.students.createdAt,
    })
    .from(schema.students)
    .leftJoin(schema.users, eq(schema.users.id, schema.students.userId));

  const conds: SQL[] = [];
  if (filter.search) {
    const q = `%${filter.search}%`;
    const searchCond = or(ilike(schema.users.name, q), ilike(schema.users.email, q));
    if (searchCond) conds.push(searchCond);
  }
  if (filter.status && filter.status !== 'todos')
    conds.push(eq(schema.students.status, filter.status));

  const filtered = conds.length > 0 ? baseQuery.where(and(...conds)) : baseQuery;

  const ordered =
    filter.sortBy === 'risk'
      ? filtered.orderBy(desc(schema.students.riskScore))
      : filter.sortBy === 'lastAccess'
        ? filtered.orderBy(desc(schema.students.lastAccessAt))
        : filtered.orderBy(asc(schema.users.name));

  const rows = await ordered;
  if (rows.length === 0) return filterSeed(filter);

  // Buscar enrollments + progress para cada um (uma query batched seria melhor — fazemos simples)
  const ids = rows.map((r) => r.id);
  const enrolls =
    ids.length === 0
      ? []
      : await db
          .select()
          .from(schema.enrollments)
          .where(sql`${schema.enrollments.studentId} = ANY(${ids})`);

  const result: AdminStudentDto[] = rows.map((r) => {
    const myEnrolls = enrolls.filter((e) => e.studentId === r.id);
    return {
      id: r.id,
      name: r.name ?? r.id,
      email: r.email ?? '',
      enrolledCourseIds: myEnrolls.map((e) => e.courseId),
      progressByCourse: Object.fromEntries(myEnrolls.map((e) => [e.courseId, e.progress])),
      status: r.status,
      riskScore: r.riskScore,
      lastAccessAt: r.lastAccessAt?.toISOString() ?? r.createdAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
    };
  });

  if (filter.courseId && filter.courseId !== 'todos') {
    return result.filter((s) => s.enrolledCourseIds.includes(filter.courseId!));
  }
  return result;
}

export async function findAdminStudent(id: string): Promise<AdminStudentDto | null> {
  const list = await listAdminStudents({});
  return list.find((s) => s.id === id) ?? null;
}

async function filterSeed(filter: StudentsFilter): Promise<AdminStudentDto[]> {
  let list = await adminStore.getAll();
  if (filter.search) {
    const q = filter.search.toLowerCase();
    list = list.filter(
      (s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q),
    );
  }
  if (filter.status && filter.status !== 'todos')
    list = list.filter((s) => s.status === filter.status);
  if (filter.courseId && filter.courseId !== 'todos')
    list = list.filter((s) => s.enrolledCourseIds.includes(filter.courseId!));
  list.sort((a, b) => {
    if (filter.sortBy === 'risk') return b.riskScore - a.riskScore;
    if (filter.sortBy === 'lastAccess')
      return new Date(b.lastAccessAt).getTime() - new Date(a.lastAccessAt).getTime();
    return a.name.localeCompare(b.name);
  });
  return list;
}

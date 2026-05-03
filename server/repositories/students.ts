import { eq, desc, asc, and, ilike, or, sql, type SQL } from 'drizzle-orm';
import { getDb, schema } from '../db/client';
import {
  adminStudents as seedAdmin,
  currentStudent,
  type AdminStudentRow,
} from '../../src/app/data/seed';
import type { Student } from '../../src/app/types/schema';
import type { StudentsFilter } from '../../shared/schemas';

interface AdminStudentDto extends AdminStudentRow {}

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
    return filterSeed(filter);
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

function filterSeed(filter: StudentsFilter): AdminStudentDto[] {
  let list = [...seedAdmin];
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

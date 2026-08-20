import { eq, desc, asc, and, ilike, or, sql, inArray, type SQL } from 'drizzle-orm';
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
import * as coursesRepo from './courses';
import { computeExpiry, addMonths, LIFETIME } from '../access/course-access';

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
 * Prazo de acesso declarado pelo curso, em meses. Lê `accessMonths` do curso
 * (vive no JSONB `meta`) para calcular o fim do acesso NO MOMENTO da matrícula
 * — depois disso, quem manda é a data gravada na matrícula.
 */
async function courseAccessMonths(courseId: string): Promise<number | null> {
  const course = await coursesRepo.findCourse(courseId);
  const months = (course as unknown as { accessMonths?: number | null } | null)?.accessMonths;
  return typeof months === 'number' ? months : null;
}

/**
 * Adiciona courseId ao enrolledCourseIds do aluno se ainda não estiver.
 * Idempotente. Cria entrada mínima para o aluno se ele não existir como adminStudent.
 *
 * Grava o fim do acesso a partir do `accessMonths` do curso. Curso sem prazo
 * declarado gera matrícula vitalícia (`expiresAt` nulo).
 *
 * Persiste no Postgres quando há banco — até 17/ago/2026 esta função só escrevia
 * no JSON, então matrícula vinda de pagamento aprovado sumia em produção, que lê
 * `enrollments` do banco.
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
  /**
   * Início do acesso, quando diferente de agora — importação histórica que
   * conhece a data real da compra. O prazo conta a partir daqui.
   */
  enrolledAt?: string,
): Promise<void> {
  const startedAt = enrolledAt ?? new Date().toISOString();
  const months = await courseAccessMonths(courseId);
  const expiresAt = computeExpiry(startedAt, months);

  const db = getDb();
  if (db) {
    // O aluno precisa existir em `students` para a FK aceitar a matrícula — e,
    // se não existir, a ficha é criada aqui.
    //
    // Antes esta função desistia em silêncio nesse caso, e o silêncio custava
    // caro: o checkout público cria só a credencial de quem compra sem ter
    // conta, então todo cliente novo pagava e não recebia acesso. Sem erro no
    // log, sem falha no webhook, sem nada — o dinheiro entrava e o curso não
    // aparecia. Quem tem conta merece a ficha; desistir é para quem não existe
    // em lugar nenhum.
    const exists = await db
      .select({ id: schema.students.id })
      .from(schema.students)
      .where(eq(schema.students.id, userId));
    if (exists.length === 0) {
      const conta = await usersStore.findUserById(userId);
      if (!conta) {
        // eslint-disable-next-line no-console
        console.warn(`[enrollInCourse] ${userId} não existe como usuário — matrícula ignorada`);
        return;
      }
      await db
        .insert(schema.users)
        .values({
          id: conta.id,
          email: conta.email,
          name: conta.name,
          role: 'student',
          createdAt: new Date(conta.createdAt),
          updatedAt: new Date(),
        })
        .onConflictDoNothing();
      await db
        .insert(schema.students)
        .values({
          id: userId,
          userId,
          weeklyGoalMinutes: 180,
          totalStudyMinutes: 0,
          riskScore: 0,
          status: 'ativo',
          lastAccessAt: lastAccessAt ? new Date(lastAccessAt) : null,
          createdAt: new Date(startedAt),
        })
        .onConflictDoNothing();
    }
    await db
      .insert(schema.enrollments)
      .values({
        id: `enr-${userId}-${courseId}`,
        studentId: userId,
        courseId,
        progress: 0,
        enrolledAt: new Date(startedAt),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      })
      // Rematrícula não zera progresso nem reinicia prazo: quem já tem acesso
      // segue com o que tem, e estender é trabalho de extendCourseAccess.
      .onConflictDoNothing();
    return;
  }

  // Hidrata nome/email do users-store antes do modify (caso seja stub novo)
  const u = await usersStore.findUserById(userId);
  const jaTemFicha = (await adminStore.getAll()).some((s) => s.id === userId);
  if (!u && !jaTemFicha) {
    // Matrícula precisa de alguém por trás — conta de login ou ficha de aluno.
    // Sem isto, qualquer id virava ficha nova com o próprio id no lugar do nome.
    // As duas condições existem porque os dois cadastros são independentes: há
    // aluno com ficha e sem credencial (vindo de importação) e há credencial sem
    // ficha (quem comprou pelo site e ainda não foi matriculado).
    // eslint-disable-next-line no-console
    console.warn(`[enrollInCourse] ${userId} não existe como usuário nem como aluno — ignorado`);
    return;
  }
  await adminStore.modify((rows) => {
    let row = rows.find((s) => s.id === userId);
    if (!row) {
      const now = new Date().toISOString();
      const fresh: AdminStudentDto = {
        id: userId,
        name: u?.name ?? userId,
        email: u?.email ?? '',
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
        [courseId]: startedAt,
      };
      if (expiresAt) {
        row.accessExpiresByCourse = {
          ...(row.accessExpiresByCourse ?? {}),
          [courseId]: expiresAt,
        };
      }
    }
  });
}

/**
 * Estende (ou encurta) o acesso de um aluno a um curso.
 *
 * `months` conta a partir do fim atual quando ainda há acesso, e a partir de
 * agora quando já expirou — renovar depois do vencimento não deve devolver dias
 * que o aluno passou sem estudar. Passe `until` para cravar uma data, ou
 * `LIFETIME` para isentar esta matrícula do prazo do curso.
 *
 * Devolve o novo fim do acesso, ou null se virou vitalício. Null também quando
 * a matrícula não existe — o chamador checa antes.
 */
export async function extendCourseAccess(
  userId: string,
  courseId: string,
  grant: { months: number } | { until: string } | { lifetime: true },
): Promise<{ ok: boolean; expiresAt: string | null }> {
  const now = new Date().toISOString();
  const nextFrom = (current: string | null): string | null => {
    if ('lifetime' in grant) return null;
    if ('until' in grant) return new Date(grant.until).toISOString();
    const base = current && current > now ? current : now;
    return addMonths(base, grant.months);
  };

  const db = getDb();
  if (db) {
    const rows = await db
      .select()
      .from(schema.enrollments)
      .where(
        and(eq(schema.enrollments.studentId, userId), eq(schema.enrollments.courseId, courseId)),
      );
    const current = rows[0];
    if (!current) return { ok: false, expiresAt: null };
    const next = nextFrom(current.expiresAt?.toISOString() ?? null);
    await db
      .update(schema.enrollments)
      .set({ expiresAt: next ? new Date(next) : null })
      .where(eq(schema.enrollments.id, current.id));
    return { ok: true, expiresAt: next };
  }

  let result: { ok: boolean; expiresAt: string | null } = { ok: false, expiresAt: null };
  await adminStore.modify((rows) => {
    const row = rows.find((s) => s.id === userId);
    if (!row || !row.enrolledCourseIds.includes(courseId)) return;
    const stored = row.accessExpiresByCourse?.[courseId];
    const next = nextFrom(stored && stored !== LIFETIME ? stored : null);
    const map = { ...(row.accessExpiresByCourse ?? {}) };
    if (next) map[courseId] = next;
    else map[courseId] = LIFETIME;
    row.accessExpiresByCourse = map;
    result = { ok: true, expiresAt: next };
  });
  return result;
}

/**
 * Retorna a data ISO em que o aluno se matriculou no curso.
 * Fallback (registros antigos sem enrollmentDates): student.createdAt.
 */
export async function getEnrollmentDate(
  userId: string,
  courseId: string,
): Promise<string | null> {
  const db = getDb();
  if (db) {
    const rows = await db
      .select({ enrolledAt: schema.enrollments.enrolledAt })
      .from(schema.enrollments)
      .where(
        and(eq(schema.enrollments.studentId, userId), eq(schema.enrollments.courseId, courseId)),
      );
    return rows[0]?.enrolledAt?.toISOString() ?? null;
  }
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
        name: u?.name ?? userId,
        email: u?.email ?? '',
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

/**
 * Perfil acadêmico de UM aluno — o que `/auth/me` devolve para quem está logado.
 *
 * Existe porque `getCurrentStudent()` sempre devolveu o aluno do seed, e o
 * endpoint só trocava nome e e-mail por cima. Na prática, todo aluno enxergava
 * as matrículas e o progresso de outra pessoa: quem entrasse pelo convite veria
 * cursos que nunca comprou e não veria os seus.
 *
 * Aluno sem ficha (veio da loja e nunca foi matriculado) recebe um perfil vazio,
 * não um erro: ele existe, só não tem curso.
 */
export async function getStudentProfile(userId: string): Promise<Student | null> {
  const db = getDb();
  if (!db) {
    const row = (await adminStore.getAll()).find((s) => s.id === userId);
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: 'student',
      enrolledCourseIds: row.enrolledCourseIds ?? [],
      lastAccessAt: row.lastAccessAt,
      weeklyGoalMinutes: row.weeklyGoalMinutes ?? 180,
      totalStudyMinutes: 0,
      riskScore: row.riskScore ?? 0,
      createdAt: row.createdAt,
    };
  }

  const linhas = await db
    .select({ s: schema.students, u: schema.users })
    .from(schema.students)
    .leftJoin(schema.users, eq(schema.users.id, schema.students.userId))
    .where(eq(schema.students.id, userId));
  const achado = linhas[0];

  const matriculas = await db
    .select({ courseId: schema.enrollments.courseId })
    .from(schema.enrollments)
    .where(eq(schema.enrollments.studentId, userId));

  if (!achado) {
    // Sem ficha: devolve o mínimo para a interface não quebrar, com a lista de
    // cursos vazia em vez de herdar a de outra pessoa.
    const usuario = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId));
    const u = usuario[0];
    if (!u) return null;
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: 'student',
      enrolledCourseIds: matriculas.map((m) => m.courseId),
      lastAccessAt: undefined,
      weeklyGoalMinutes: 180,
      totalStudyMinutes: 0,
      riskScore: 0,
      createdAt: u.createdAt.toISOString(),
    };
  }

  return {
    id: achado.s.id,
    name: achado.u?.name ?? achado.s.id,
    email: achado.u?.email ?? '',
    role: 'student',
    avatarUrl: achado.u?.avatarUrl ?? undefined,
    enrolledCourseIds: matriculas.map((m) => m.courseId),
    lastAccessAt: achado.s.lastAccessAt?.toISOString(),
    weeklyGoalMinutes: achado.s.weeklyGoalMinutes,
    totalStudyMinutes: achado.s.totalStudyMinutes,
    riskScore: achado.s.riskScore,
    createdAt: achado.s.createdAt.toISOString(),
  };
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
          // inArray gera `IN (...)` — portável em node-postgres. O antigo
          // `= ANY(${ids})` virava tupla no driver pg e quebrava.
          .where(inArray(schema.enrollments.studentId, ids));

  const result: AdminStudentDto[] = rows.map((r) => {
    const myEnrolls = enrolls.filter((e) => e.studentId === r.id);
    return {
      id: r.id,
      name: r.name ?? r.id,
      email: r.email ?? '',
      enrolledCourseIds: myEnrolls.map((e) => e.courseId),
      progressByCourse: Object.fromEntries(myEnrolls.map((e) => [e.courseId, e.progress])),
      enrollmentDates: Object.fromEntries(
        myEnrolls.map((e) => [e.courseId, e.enrolledAt.toISOString()]),
      ),
      // Só entra o que está gravado. Ausente não é "vitalício": é "prazo sai do
      // accessMonths do curso" — quem decide isso é resolveExpiry().
      accessExpiresByCourse: Object.fromEntries(
        myEnrolls
          .filter((e) => e.expiresAt)
          .map((e) => [e.courseId, e.expiresAt!.toISOString()]),
      ),
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

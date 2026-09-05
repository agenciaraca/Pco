// Courses são lidos primariamente do seed enquanto o conteúdo não migra para CMS.
// Quando DB existe, lê de courses + modules + lessons + assessments.
// Sem DB, persiste em data/courses.json (com modules/lessons/assessments aninhados).

import { eq, asc } from 'drizzle-orm';
import { getDb, schema } from '../db/client';
import { JsonStore } from '../db/json-store';
import { courses as seedCourses } from '../../src/app/data/seed';
import type { Course, Module, Lesson, Assessment } from '../../src/app/types/schema';
import type {
  UpdateCourseInput,
  CreateModuleInput,
  UpdateModuleInput,
  CreateLessonInput,
  UpdateLessonInput,
  CreateAssessmentInput,
  UpdateAssessmentInput,
} from '../../shared/schemas';

const store = new JsonStore<Course>('courses.json', () =>
  // Deep clone do seed pra não compartilhar refs
  seedCourses.map((c) => ({
    ...c,
    modules: c.modules.map((m) => ({
      ...m,
      lessons: m.lessons.map((l) => ({ ...l })),
      assessment: m.assessment ? { ...m.assessment } : undefined,
    })),
  })),
);

/**
 * A coluna `courses.meta` é recente. O banco de produção não tem histórico de
 * migrations do drizzle (o schema foi criado por push/manual), então ela pode
 * não existir ainda no ambiente onde este código roda — e o `select()` do
 * drizzle lista as colunas explicitamente, o que derrubaria toda a listagem de
 * cursos com 42703. Detectamos uma vez e seguimos sem os campos ricos, em vez
 * de tornar o deploy dependente da ordem em que o DDL foi aplicado.
 */
let metaColumnAvailable = true;

/**
 * O drizzle embrulha o erro do pg (DrizzleQueryError), então o `code` 42703 não
 * está no erro de cima — está em `cause`, possivelmente aninhado. Andar a
 * cadeia é o que faz a detecção funcionar de verdade: checar só o topo passa
 * batido e derruba a listagem inteira de cursos.
 */
function isMissingMetaColumn(err: unknown): boolean {
  let cur: unknown = err;
  for (let depth = 0; cur && depth < 5; depth++) {
    const e = cur as { code?: string; message?: string; cause?: unknown };
    const says = `${e.code ?? ''} ${e.message ?? ''}`;
    if (e.code === '42703' || /column .*\bmeta\b.* does not exist/i.test(says)) return true;
    cur = e.cause;
  }
  return false;
}

const COURSE_BASE_COLUMNS = {
  id: schema.courses.id,
  slug: schema.courses.slug,
  title: schema.courses.title,
  shortTitle: schema.courses.shortTitle,
  description: schema.courses.description,
  coverColor: schema.courses.coverColor,
  totalHours: schema.courses.totalHours,
  certificateAvailable: schema.courses.certificateAvailable,
} as const;

async function selectActiveCourses(
  db: NonNullable<ReturnType<typeof getDb>>,
  somenteAtivos = true,
): Promise<Array<Record<string, unknown>>> {
  const filtro = somenteAtivos ? eq(schema.courses.active, true) : undefined;
  if (metaColumnAvailable) {
    try {
      return await db.select().from(schema.courses).where(filtro);
    } catch (err) {
      if (!isMissingMetaColumn(err)) throw err;
      metaColumnAvailable = false;
      console.warn(
        '[courses] coluna `meta` ausente no banco — campos ricos do curso ' +
          '(instrutor, tags, página pública) ficam indisponíveis até rodar o DDL da migration 0002.',
      );
    }
  }
  return await db.select(COURSE_BASE_COLUMNS).from(schema.courses).where(filtro);
}

async function loadFromDb(somenteAtivos = true): Promise<Course[]> {
  const db = getDb();
  if (!db) return [];

  const courses = (await selectActiveCourses(db, somenteAtivos)) as Array<
    typeof schema.courses.$inferSelect
  >;
  if (courses.length === 0) return [];

  const modules = await db.select().from(schema.modules).orderBy(asc(schema.modules.order));
  const lessons = await db.select().from(schema.lessons).orderBy(asc(schema.lessons.order));
  const assessments = await db.select().from(schema.assessments);

  return courses.map((c) => {
    const courseModules = modules
      .filter((m) => m.courseId === c.id)
      .map((m) => {
        const moduleLessons: Lesson[] = lessons
          .filter((l) => l.moduleId === m.id)
          .map((l) => ({
            id: l.id,
            moduleId: l.moduleId,
            courseId: l.courseId,
            title: l.title,
            durationMinutes: l.durationMinutes,
            videoUrl: l.videoUrl ?? undefined,
            description: l.description ?? undefined,
            content: l.content ?? undefined,
            isMandatory: l.isMandatory,
            isPreview: l.isPreview,
            transcripts: l.transcripts ?? undefined,
            order: l.order,
          }));
        const assessment = assessments.find((a) => a.moduleId === m.id);
        return {
          id: m.id,
          courseId: m.courseId,
          title: m.title,
          description: m.description ?? undefined,
          order: m.order,
          releaseAt: m.releaseAt?.toISOString(),
          releaseAfterEnrollmentDays: m.releaseAfterEnrollmentDays ?? null,
          lessons: moduleLessons,
          assessment: assessment
            ? ({
                id: assessment.id,
                moduleId: assessment.moduleId,
                courseId: assessment.courseId,
                title: assessment.title,
                questionCount: assessment.questionCount,
                passingScore: assessment.passingScore,
                timeLimitMinutes: assessment.timeLimitMinutes ?? undefined,
              } as Assessment)
            : undefined,
        } as Module;
      });

    // `meta` carrega os campos ricos sem coluna própria (tags, instrutor,
    // learningOutcomes, certificateTemplate, campos da página pública...).
    // Vem primeiro no spread para que as colunas reais sempre vençam.
    return {
      ...(c.meta ?? {}),
      id: c.id,
      slug: c.slug,
      title: c.title,
      shortTitle: c.shortTitle,
      description: c.description,
      coverColor: c.coverColor,
      modules: courseModules,
      totalHours: c.totalHours,
      certificateAvailable: c.certificateAvailable,
      // `active` vem junto porque a regra de visibilidade **depende dele**:
      // `isPubliclyListed` é `active !== false && publicListed !== false`, e
      // sem o campo no objeto ela lia `undefined` e deixava passar. Enquanto o
      // catálogo era lido já filtrado por `active`, isso não aparecia; quem
      // precisa da lista completa (o admin, e o aluno com matrícula) traz
      // curso inativo junto, e aí é este campo que separa um do outro.
      active: c.active,
    } as Course;
  });
}

/**
 * Campos que têm coluna própria na tabela `courses`. Todo o resto do patch vai
 * para a coluna JSONB `meta`.
 */
export const COURSE_COLUMNS = new Set([
  'title',
  'slug',
  'shortTitle',
  'description',
  'totalHours',
  'certificateAvailable',
  'coverColor',
  'active',
]);

/**
 * Separa do patch os campos que não têm coluna própria — eles vão para `meta`.
 * Chaves com `undefined` são ignoradas: em patch parcial, ausência não é apagar.
 */
export function pickMetaFields(patch: Record<string, unknown>): Record<string, unknown> {
  const meta: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined && !COURSE_COLUMNS.has(k)) meta[k] = v;
  }
  return meta;
}

/** Só as chaves definidas do patch — `undefined` nunca sobrescreve o que existe. */
function definedFields(patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/** Normaliza os opcionais em que string vazia quer dizer "limpar o campo". */
function blankToUndefined(
  patch: Record<string, unknown>,
  keys: string[],
): Record<string, undefined> {
  const out: Record<string, undefined> = {};
  for (const k of keys) {
    if (patch[k] !== undefined && !patch[k]) out[k] = undefined;
  }
  return out;
}

/**
 * Duplica um curso completo (módulos + aulas) gerando novos IDs.
 * Title vira "Cópia de X" e slug recebe sufixo "-copia".
 * No modo DB, atualmente não suportado — admin deve criar manual e usar import.
 */
/**
 * Cria um curso vazio (sem módulos). Usado pelo botão "Novo curso" no /admin/cursos.
 * Gera id estável a partir do slug; falha se já existir.
 */
export async function createCourse(input: {
  title: string;
  slug: string;
  shortTitle: string;
  description?: string;
  totalHours?: number;
  certificateAvailable?: boolean;
  coverColor?: string;
  active?: boolean;
}): Promise<Course | { error: 'DUPLICATE_SLUG' }> {
  const db = getDb();
  if (db) {
    throw new Error('createCourse não implementado em modo DB ainda. Usar JSON.');
  }
  const id = `course-${input.slug}-${Date.now().toString(36).slice(-4)}`;
  const all = await store.getAll();
  if (all.some((c) => c.slug === input.slug)) {
    return { error: 'DUPLICATE_SLUG' };
  }
  const course: Course = {
    id,
    slug: input.slug,
    title: input.title,
    shortTitle: input.shortTitle,
    description: input.description ?? input.title,
    coverColor: input.coverColor ?? 'from-pco-blue to-pco-cyan',
    modules: [],
    totalHours: input.totalHours ?? 0,
    certificateAvailable: input.certificateAvailable ?? true,
    active: input.active ?? true,
    tags: [],
  };
  await store.unshift(course);
  return course;
}

export async function duplicateCourse(sourceId: string): Promise<Course | null> {
  const db = getDb();
  const source = await findCourse(sourceId);
  if (!source) return null;
  if (db) {
    throw new Error(
      'Duplicação só implementada em modo JSON. Em DB, exporte e re-importe via /admin/imports.',
    );
  }

  const newCourseId = `course-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
  const cloned: Course = {
    ...source,
    id: newCourseId,
    title: `Cópia de ${source.title}`,
    slug: `${source.slug ?? newCourseId}-copia-${Date.now().toString(36).slice(-4)}`,
    modules: (source.modules ?? []).map((m) => {
      const newModuleId = `${newCourseId}-mod-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      return {
        ...m,
        id: newModuleId,
        courseId: newCourseId,
        lessons: (m.lessons ?? []).map((l) => ({
          ...l,
          id: `${newModuleId}-les-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          moduleId: newModuleId,
          courseId: newCourseId,
        })),
        assessment: m.assessment
          ? {
              ...m.assessment,
              id: `${newModuleId}-asmt-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
              moduleId: newModuleId,
              courseId: newCourseId,
            }
          : undefined,
      };
    }),
  };
  await store.unshift(cloned);
  return cloned;
}

/**
 * Exclui permanentemente um curso e seus módulos/aulas/avaliações aninhados.
 *
 * Em modo JSON: remove do array em data/courses.json.
 * Em modo DB: marca como inactive (soft-delete) já que o cleanup em cascata
 *   precisa de coordenação com tabelas de progresso/matrículas que ficam
 *   fora deste repo. Chama-se separado em uma sprint de cleanup.
 *
 * Retorna { ok: true } se removeu, null se não encontrou.
 */
/**
 * Reordena módulos e aulas de um curso em uma operação atômica.
 * Aceita também mover aulas entre módulos (cross-module reorder via DnD).
 *
 * Input: lista de módulos na nova ordem. Cada módulo traz as lessons na
 * nova ordem. Os ids precisam corresponder aos existentes; ids desconhecidos
 * são ignorados (não cria nada novo).
 *
 * No modo JSON: substitui in-place. No modo DB: faz batch update de order +
 * moduleId nas lessons.
 */
export async function reorderCourseContent(
  courseId: string,
  modules: Array<{ id: string; lessonIds: string[] }>,
): Promise<Course | null> {
  const db = getDb();
  if (!db) {
    return await store.modify((courses) => {
      const c = courses.find((x) => x.id === courseId);
      if (!c) return null;
      const existingModules = new Map(c.modules.map((m) => [m.id, m]));
      const allLessons = new Map<string, Lesson>();
      for (const m of c.modules) {
        for (const l of m.lessons) allLessons.set(l.id, l);
      }

      const newModules: Module[] = [];
      let moduleOrder = 1;
      for (const incoming of modules) {
        const mod = existingModules.get(incoming.id);
        if (!mod) continue;
        let lessonOrder = 1;
        const newLessons: Lesson[] = [];
        for (const lid of incoming.lessonIds) {
          const l = allLessons.get(lid);
          if (!l) continue;
          newLessons.push({
            ...l,
            moduleId: mod.id,
            courseId,
            order: lessonOrder++,
          });
          allLessons.delete(lid);
        }
        newModules.push({
          ...mod,
          order: moduleOrder++,
          lessons: newLessons,
        });
      }
      c.modules = newModules;
      return c;
    });
  }

  // DB path: atualiza order dos módulos e order + moduleId de cada lesson
  let moduleOrder = 1;
  for (const incoming of modules) {
    await db
      .update(schema.modules)
      .set({ order: moduleOrder++ })
      .where(eq(schema.modules.id, incoming.id));
    let lessonOrder = 1;
    for (const lid of incoming.lessonIds) {
      await db
        .update(schema.lessons)
        .set({ order: lessonOrder++, moduleId: incoming.id })
        .where(eq(schema.lessons.id, lid));
    }
  }
  return await findCourse(courseId);
}

export async function deleteCourse(id: string): Promise<{ ok: true } | null> {
  const db = getDb();
  if (!db) {
    const removed = await store.modify((courses) => {
      const idx = courses.findIndex((c) => c.id === id);
      if (idx === -1) return null;
      courses.splice(idx, 1);
      return { ok: true } as const;
    });
    return removed;
  }
  const existing = await findCourse(id);
  if (!existing) return null;
  await db
    .update(schema.courses)
    .set({ active: false })
    .where(eq(schema.courses.id, id));
  return { ok: true };
}

export async function listCourses(): Promise<Course[]> {
  if (getDb()) {
    const fromDb = await loadFromDb();
    if (fromDb.length > 0) return fromDb;
  }
  return await store.getAll();
}

/**
 * O catálogo inteiro, inclusive o que está desativado.
 *
 * `listCourses()` filtra `active = true`, e isso é regra de **descoberta**:
 * curso desativado não aparece na vitrine nem na estante. Não é regra de
 * **operação** sobre uma aula que o aluno já está vendo — e como `deleteCourse`
 * também é um `active: false`, os dois casos entram pela mesma porta.
 *
 * Enquanto não existia esta variante, desativar um curso para editá-lo
 * congelava, para quem estivesse estudando, a conclusão de aula **e** o tempo
 * de assistência: as duas rotas resolvem curso e módulo a partir do `lessonId`
 * (para não confiar no corpo do POST) e as duas devolviam `404 NOT_FOUND` —
 * indistinguível de "esta aula não existe". O tempo de assistência alimenta o
 * cálculo de risco de evasão, então os dois sinais pedagógicos paravam juntos,
 * sem erro para ninguém.
 *
 * Use só onde o aluno já tem o conteúdo em mãos. Para listar, `listCourses()`.
 */
export async function listCoursesIncludingInactive(): Promise<Course[]> {
  if (getDb()) {
    const fromDb = await loadFromDb(false);
    if (fromDb.length > 0) return fromDb;
  }
  // No modo JSON não há filtro nenhum: o store já devolve tudo.
  return await store.getAll();
}

export async function findCourse(id: string): Promise<Course | null> {
  const all = await listCourses();
  return all.find((c) => c.id === id) ?? null;
}

/** Como `findCourse`, mas enxerga curso desativado. Ver `listCoursesIncludingInactive`. */
export async function findCourseIncludingInactive(id: string): Promise<Course | null> {
  const all = await listCoursesIncludingInactive();
  return all.find((c) => c.id === id) ?? null;
}

export async function updateCourse(
  id: string,
  patch: UpdateCourseInput,
): Promise<Course | null> {
  const db = getDb();

  if (!db) {
    return await store.update(
      (c) => c.id === id,
      (c) => ({
        ...c,
        // Aplica todo campo definido do patch. Antes esta lista era enumerada à
        // mão e ficou para trás quando o schema ganhou os campos da página
        // pública (badge, tldr, faqs, ...): a validação passava e a gravação
        // descartava. Enumerar de novo repetiria o mesmo erro no próximo campo.
        ...definedFields(patch),
        // String vazia nesses opcionais significa "limpar", não "gravar ''".
        ...blankToUndefined(patch, [
          'coverImageUrl',
          'instructorName',
          'instructorBio',
          'instructorPhotoUrl',
        ]),
      }),
    );
  }

  const update: Partial<typeof schema.courses.$inferInsert> = {};
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.slug !== undefined) update.slug = patch.slug;
  if (patch.shortTitle !== undefined) update.shortTitle = patch.shortTitle;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.totalHours !== undefined) update.totalHours = patch.totalHours;
  if (patch.certificateAvailable !== undefined)
    update.certificateAvailable = patch.certificateAvailable;
  if (patch.coverColor !== undefined) update.coverColor = patch.coverColor;
  if (patch.active !== undefined) update.active = patch.active;

  // Campos sem coluna própria vão para `meta`, mesclados com o que já estava lá
  // (patch parcial não pode apagar o que não veio no corpo).
  const metaPatch = pickMetaFields(patch as Record<string, unknown>);
  if (Object.keys(metaPatch).length > 0 && metaColumnAvailable) {
    try {
      const current = await db
        .select({ meta: schema.courses.meta })
        .from(schema.courses)
        .where(eq(schema.courses.id, id));
      if (current.length === 0) return null;
      update.meta = { ...(current[0].meta ?? {}), ...metaPatch };
    } catch (err) {
      if (!isMissingMetaColumn(err)) throw err;
      metaColumnAvailable = false;
      console.warn('[courses] update sem `meta`: coluna ausente no banco.');
    }
  }

  if (Object.keys(update).length === 0) return await findCourse(id);

  await db.update(schema.courses).set(update).where(eq(schema.courses.id, id));
  return await findCourse(id);
}

// ---------- Modules ----------

function newModuleId(courseId: string) {
  return `${courseId}-mod-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
}

function newLessonId(moduleId: string) {
  return `${moduleId}-les-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
}

export async function createModule(
  courseId: string,
  input: CreateModuleInput,
): Promise<Module | null> {
  const id = newModuleId(courseId);

  const db = getDb();
  if (!db) {
    return await store.modify((courses) => {
      const c = courses.find((x) => x.id === courseId);
      if (!c) return null;
      const newModule: Module = {
        id,
        courseId,
        title: input.title,
        description: input.description,
        order: input.order,
        releaseAt: input.releaseAt,
        releaseAfterEnrollmentDays: input.releaseAfterEnrollmentDays ?? null,
        lessons: [],
      };
      c.modules.push(newModule);
      c.modules.sort((a, b) => a.order - b.order);
      return newModule;
    });
  }

  await db.insert(schema.modules).values({
    id,
    courseId,
    title: input.title,
    description: input.description ?? null,
    order: input.order,
    releaseAt: input.releaseAt ? new Date(input.releaseAt) : null,
    releaseAfterEnrollmentDays: input.releaseAfterEnrollmentDays ?? null,
  });
  return {
    id,
    courseId,
    title: input.title,
    description: input.description,
    order: input.order,
    releaseAt: input.releaseAt,
    releaseAfterEnrollmentDays: input.releaseAfterEnrollmentDays ?? null,
    lessons: [],
  };
}

export async function updateModule(
  moduleId: string,
  patch: UpdateModuleInput,
): Promise<Module | null> {
  const db = getDb();
  if (!db) {
    return await store.modify((courses) => {
      for (const c of courses) {
        const idx = c.modules.findIndex((m) => m.id === moduleId);
        if (idx !== -1) {
          c.modules[idx] = { ...c.modules[idx], ...patch } as Module;
          if (patch.order !== undefined) c.modules.sort((a, b) => a.order - b.order);
          return c.modules[idx];
        }
      }
      return null;
    });
  }

  const update: Partial<typeof schema.modules.$inferInsert> = {};
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.description !== undefined) update.description = patch.description ?? null;
  if (patch.order !== undefined) update.order = patch.order;
  if (patch.releaseAt !== undefined)
    update.releaseAt = patch.releaseAt ? new Date(patch.releaseAt) : null;
  if (patch.releaseAfterEnrollmentDays !== undefined)
    update.releaseAfterEnrollmentDays = patch.releaseAfterEnrollmentDays ?? null;

  if (Object.keys(update).length === 0) {
    const rows = await db.select().from(schema.modules).where(eq(schema.modules.id, moduleId));
    if (rows.length === 0) return null;
    return {
      id: rows[0].id,
      courseId: rows[0].courseId,
      title: rows[0].title,
      description: rows[0].description ?? undefined,
      order: rows[0].order,
      releaseAt: rows[0].releaseAt?.toISOString(),
      releaseAfterEnrollmentDays: rows[0].releaseAfterEnrollmentDays ?? null,
      lessons: [],
    };
  }

  const rows = await db
    .update(schema.modules)
    .set(update)
    .where(eq(schema.modules.id, moduleId))
    .returning();
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    courseId: r.courseId,
    title: r.title,
    description: r.description ?? undefined,
    order: r.order,
    releaseAt: r.releaseAt?.toISOString(),
    releaseAfterEnrollmentDays: r.releaseAfterEnrollmentDays ?? null,
    lessons: [],
  };
}

export async function deleteModule(moduleId: string): Promise<boolean> {
  const db = getDb();
  if (!db) {
    return await store.modify((courses) => {
      for (const c of courses) {
        const idx = c.modules.findIndex((m) => m.id === moduleId);
        if (idx !== -1) {
          c.modules.splice(idx, 1);
          return true;
        }
      }
      return false;
    });
  }
  const rows = await db
    .delete(schema.modules)
    .where(eq(schema.modules.id, moduleId))
    .returning({ id: schema.modules.id });
  return rows.length > 0;
}

// ---------- Lessons ----------

export async function createLesson(
  moduleId: string,
  input: CreateLessonInput,
): Promise<Lesson | null> {
  const db = getDb();
  if (!db) {
    return await store.modify((courses) => {
      for (const c of courses) {
        const m = c.modules.find((x) => x.id === moduleId);
        if (m) {
          const id = newLessonId(moduleId);
          const lesson: Lesson = {
            id,
            moduleId,
            courseId: c.id,
            title: input.title,
            durationMinutes: input.durationMinutes,
            videoUrl: input.videoUrl || undefined,
            description: input.description,
            isMandatory: input.isMandatory,
            order: input.order,
            isPreview: input.isPreview ?? false,
            transcripts: input.transcripts,
          };
          m.lessons.push(lesson);
          m.lessons.sort((a, b) => a.order - b.order);
          return lesson;
        }
      }
      return null;
    });
  }

  // Resolve courseId via DB
  const moduleRow = await db
    .select()
    .from(schema.modules)
    .where(eq(schema.modules.id, moduleId));
  if (moduleRow.length === 0) return null;
  const courseId = moduleRow[0].courseId;
  const id = newLessonId(moduleId);

  await db.insert(schema.lessons).values({
    id,
    moduleId,
    courseId,
    title: input.title,
    durationMinutes: input.durationMinutes,
    videoUrl: input.videoUrl || null,
    description: input.description ?? null,
    content: input.content ?? null,
    isMandatory: input.isMandatory,
    isPreview: input.isPreview ?? false,
    transcripts: input.transcripts ?? null,
    order: input.order,
  });
  return {
    id,
    moduleId,
    courseId,
    title: input.title,
    durationMinutes: input.durationMinutes,
    videoUrl: input.videoUrl || undefined,
    description: input.description,
    isMandatory: input.isMandatory,
    isPreview: input.isPreview ?? false,
    transcripts: input.transcripts,
    order: input.order,
  };
}

export async function updateLesson(
  lessonId: string,
  patch: UpdateLessonInput,
): Promise<Lesson | null> {
  const db = getDb();
  if (!db) {
    return await store.modify((courses) => {
      for (const c of courses) {
        for (const m of c.modules) {
          const idx = m.lessons.findIndex((l) => l.id === lessonId);
          if (idx !== -1) {
            m.lessons[idx] = { ...m.lessons[idx], ...patch } as Lesson;
            if (patch.order !== undefined) m.lessons.sort((a, b) => a.order - b.order);
            return m.lessons[idx];
          }
        }
      }
      return null;
    });
  }

  const update: Partial<typeof schema.lessons.$inferInsert> = {};
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.durationMinutes !== undefined) update.durationMinutes = patch.durationMinutes;
  if (patch.videoUrl !== undefined) update.videoUrl = patch.videoUrl || null;
  if (patch.description !== undefined) update.description = patch.description ?? null;
  if (patch.content !== undefined) update.content = patch.content ?? null;
  if (patch.isMandatory !== undefined) update.isMandatory = patch.isMandatory;
  if (patch.isPreview !== undefined) update.isPreview = patch.isPreview;
  if (patch.transcripts !== undefined) update.transcripts = patch.transcripts ?? null;
  if (patch.order !== undefined) update.order = patch.order;

  if (Object.keys(update).length === 0) {
    const rows = await db.select().from(schema.lessons).where(eq(schema.lessons.id, lessonId));
    if (rows.length === 0) return null;
    return rowToLesson(rows[0]);
  }

  const rows = await db
    .update(schema.lessons)
    .set(update)
    .where(eq(schema.lessons.id, lessonId))
    .returning();
  return rows[0] ? rowToLesson(rows[0]) : null;
}

export async function deleteLesson(lessonId: string): Promise<boolean> {
  const db = getDb();
  if (!db) {
    return await store.modify((courses) => {
      for (const c of courses) {
        for (const m of c.modules) {
          const idx = m.lessons.findIndex((l) => l.id === lessonId);
          if (idx !== -1) {
            m.lessons.splice(idx, 1);
            return true;
          }
        }
      }
      return false;
    });
  }
  const rows = await db
    .delete(schema.lessons)
    .where(eq(schema.lessons.id, lessonId))
    .returning({ id: schema.lessons.id });
  return rows.length > 0;
}

function rowToLesson(r: typeof schema.lessons.$inferSelect): Lesson {
  return {
    id: r.id,
    moduleId: r.moduleId,
    courseId: r.courseId,
    title: r.title,
    durationMinutes: r.durationMinutes,
    videoUrl: r.videoUrl ?? undefined,
    description: r.description ?? undefined,
    content: r.content ?? undefined,
    isMandatory: r.isMandatory,
    isPreview: r.isPreview,
    transcripts: r.transcripts ?? undefined,
    order: r.order,
  };
}

// ---------- Assessments ----------

function newAssessmentId(moduleId: string) {
  return `${moduleId}-aval-${Date.now()}`;
}

export async function upsertAssessment(
  moduleId: string,
  input: CreateAssessmentInput,
): Promise<Assessment | null> {
  const db = getDb();

  if (!db) {
    return await store.modify((courses) => {
      for (const c of courses) {
        const m = c.modules.find((x) => x.id === moduleId);
        if (m) {
          const id = m.assessment?.id ?? newAssessmentId(moduleId);
          const assessment: Assessment = {
            id,
            moduleId,
            courseId: c.id,
            title: input.title,
            questionCount: input.questionCount,
            passingScore: input.passingScore,
            timeLimitMinutes: input.timeLimitMinutes,
          };
          m.assessment = assessment;
          return assessment;
        }
      }
      return null;
    });
  }

  const moduleRow = await db
    .select()
    .from(schema.modules)
    .where(eq(schema.modules.id, moduleId));
  if (moduleRow.length === 0) return null;
  const courseId = moduleRow[0].courseId;

  const existing = await db
    .select()
    .from(schema.assessments)
    .where(eq(schema.assessments.moduleId, moduleId));

  if (existing.length === 0) {
    const id = newAssessmentId(moduleId);
    await db.insert(schema.assessments).values({
      id,
      moduleId,
      courseId,
      title: input.title,
      questionCount: input.questionCount,
      passingScore: input.passingScore,
      timeLimitMinutes: input.timeLimitMinutes ?? null,
    });
    return {
      id,
      moduleId,
      courseId,
      title: input.title,
      questionCount: input.questionCount,
      passingScore: input.passingScore,
      timeLimitMinutes: input.timeLimitMinutes,
    };
  }

  const id = existing[0].id;
  await db
    .update(schema.assessments)
    .set({
      title: input.title,
      questionCount: input.questionCount,
      passingScore: input.passingScore,
      timeLimitMinutes: input.timeLimitMinutes ?? null,
    })
    .where(eq(schema.assessments.id, id));
  return {
    id,
    moduleId,
    courseId,
    title: input.title,
    questionCount: input.questionCount,
    passingScore: input.passingScore,
    timeLimitMinutes: input.timeLimitMinutes,
  };
}

export async function updateAssessment(
  assessmentId: string,
  patch: UpdateAssessmentInput,
): Promise<Assessment | null> {
  const db = getDb();
  if (!db) {
    return await store.modify((courses) => {
      for (const c of courses) {
        for (const m of c.modules) {
          if (m.assessment?.id === assessmentId) {
            m.assessment = { ...m.assessment, ...patch } as Assessment;
            return m.assessment;
          }
        }
      }
      return null;
    });
  }

  const update: Partial<typeof schema.assessments.$inferInsert> = {};
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.questionCount !== undefined) update.questionCount = patch.questionCount;
  if (patch.passingScore !== undefined) update.passingScore = patch.passingScore;
  if (patch.timeLimitMinutes !== undefined)
    update.timeLimitMinutes = patch.timeLimitMinutes ?? null;

  if (Object.keys(update).length === 0) {
    const rows = await db
      .select()
      .from(schema.assessments)
      .where(eq(schema.assessments.id, assessmentId));
    return rows[0] ? rowToAssessment(rows[0]) : null;
  }

  const rows = await db
    .update(schema.assessments)
    .set(update)
    .where(eq(schema.assessments.id, assessmentId))
    .returning();
  return rows[0] ? rowToAssessment(rows[0]) : null;
}

export async function deleteAssessment(assessmentId: string): Promise<boolean> {
  const db = getDb();
  if (!db) {
    return await store.modify((courses) => {
      for (const c of courses) {
        for (const m of c.modules) {
          if (m.assessment?.id === assessmentId) {
            m.assessment = undefined;
            return true;
          }
        }
      }
      return false;
    });
  }
  const rows = await db
    .delete(schema.assessments)
    .where(eq(schema.assessments.id, assessmentId))
    .returning({ id: schema.assessments.id });
  return rows.length > 0;
}

function rowToAssessment(r: typeof schema.assessments.$inferSelect): Assessment {
  return {
    id: r.id,
    moduleId: r.moduleId,
    courseId: r.courseId,
    title: r.title,
    questionCount: r.questionCount,
    passingScore: r.passingScore,
    timeLimitMinutes: r.timeLimitMinutes ?? undefined,
  };
}

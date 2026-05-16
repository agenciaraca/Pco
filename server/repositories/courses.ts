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

async function loadFromDb(): Promise<Course[]> {
  const db = getDb();
  if (!db) return [];

  const courses = await db.select().from(schema.courses).where(eq(schema.courses.active, true));
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
            isMandatory: l.isMandatory,
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

    return {
      id: c.id,
      slug: c.slug,
      title: c.title,
      shortTitle: c.shortTitle,
      description: c.description,
      coverColor: c.coverColor,
      modules: courseModules,
      totalHours: c.totalHours,
      certificateAvailable: c.certificateAvailable,
    } as Course;
  });
}

/**
 * Duplica um curso completo (módulos + aulas) gerando novos IDs.
 * Title vira "Cópia de X" e slug recebe sufixo "-copia".
 * No modo DB, atualmente não suportado — admin deve criar manual e usar import.
 */
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

export async function findCourse(id: string): Promise<Course | null> {
  const all = await listCourses();
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
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.slug !== undefined ? { slug: patch.slug } : {}),
        ...(patch.shortTitle !== undefined ? { shortTitle: patch.shortTitle } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.totalHours !== undefined ? { totalHours: patch.totalHours } : {}),
        ...(patch.certificateAvailable !== undefined
          ? { certificateAvailable: patch.certificateAvailable }
          : {}),
        ...(patch.coverColor !== undefined ? { coverColor: patch.coverColor } : {}),
        ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
        ...(patch.prerequisiteCourseIds !== undefined
          ? { prerequisiteCourseIds: patch.prerequisiteCourseIds }
          : {}),
        ...(patch.learningOutcomes !== undefined
          ? { learningOutcomes: patch.learningOutcomes }
          : {}),
        ...(patch.instructorName !== undefined
          ? { instructorName: patch.instructorName || undefined }
          : {}),
        ...(patch.instructorBio !== undefined
          ? { instructorBio: patch.instructorBio || undefined }
          : {}),
        ...(patch.instructorPhotoUrl !== undefined
          ? { instructorPhotoUrl: patch.instructorPhotoUrl || undefined }
          : {}),
        ...(patch.certificateTemplate !== undefined
          ? { certificateTemplate: patch.certificateTemplate }
          : {}),
        ...(patch.collaborators !== undefined
          ? { collaborators: patch.collaborators }
          : {}),
        ...(patch.changelog !== undefined
          ? { changelog: patch.changelog }
          : {}),
        ...(patch.active !== undefined ? { active: patch.active } : {}),
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
  });
  return {
    id,
    courseId,
    title: input.title,
    description: input.description,
    order: input.order,
    releaseAt: input.releaseAt,
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
    isMandatory: input.isMandatory,
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
  if (patch.isMandatory !== undefined) update.isMandatory = patch.isMandatory;
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
    isMandatory: r.isMandatory,
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

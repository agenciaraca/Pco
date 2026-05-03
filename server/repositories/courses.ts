// Courses são lidos primariamente do seed enquanto o conteúdo não migra para CMS.
// Quando DB existe, lê de courses + modules + lessons + assessments.

import { eq, asc } from 'drizzle-orm';
import { getDb, schema } from '../db/client';
import { courses as seedCourses } from '../../src/app/data/seed';
import type { Course, Module, Lesson, Assessment } from '../../src/app/types/schema';
import type {
  UpdateCourseInput,
  CreateModuleInput,
  UpdateModuleInput,
  CreateLessonInput,
  UpdateLessonInput,
} from '../../shared/schemas';

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

export async function listCourses(): Promise<Course[]> {
  if (getDb()) {
    const fromDb = await loadFromDb();
    if (fromDb.length > 0) return fromDb;
  }
  return seedCourses;
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
    const idx = seedCourses.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    const current = seedCourses[idx];
    seedCourses[idx] = {
      ...current,
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.slug !== undefined ? { slug: patch.slug } : {}),
      ...(patch.shortTitle !== undefined ? { shortTitle: patch.shortTitle } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.totalHours !== undefined ? { totalHours: patch.totalHours } : {}),
      ...(patch.certificateAvailable !== undefined
        ? { certificateAvailable: patch.certificateAvailable }
        : {}),
      ...(patch.coverColor !== undefined ? { coverColor: patch.coverColor } : {}),
    };
    return seedCourses[idx];
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

function findSeedCourseIdx(courseId: string): number {
  return seedCourses.findIndex((c) => c.id === courseId);
}

export async function createModule(
  courseId: string,
  input: CreateModuleInput,
): Promise<Module | null> {
  const id = newModuleId(courseId);

  const db = getDb();
  if (!db) {
    const ci = findSeedCourseIdx(courseId);
    if (ci === -1) return null;
    const newModule: Module = {
      id,
      courseId,
      title: input.title,
      description: input.description,
      order: input.order,
      releaseAt: input.releaseAt,
      lessons: [],
    };
    seedCourses[ci].modules.push(newModule);
    seedCourses[ci].modules.sort((a, b) => a.order - b.order);
    return newModule;
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
    for (const course of seedCourses) {
      const idx = course.modules.findIndex((m) => m.id === moduleId);
      if (idx !== -1) {
        course.modules[idx] = { ...course.modules[idx], ...patch } as Module;
        if (patch.order !== undefined) course.modules.sort((a, b) => a.order - b.order);
        return course.modules[idx];
      }
    }
    return null;
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
    for (const course of seedCourses) {
      const idx = course.modules.findIndex((m) => m.id === moduleId);
      if (idx !== -1) {
        course.modules.splice(idx, 1);
        return true;
      }
    }
    return false;
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
    for (const course of seedCourses) {
      const m = course.modules.find((x) => x.id === moduleId);
      if (m) {
        const id = newLessonId(moduleId);
        const lesson: Lesson = {
          id,
          moduleId,
          courseId: course.id,
          title: input.title,
          durationMinutes: input.durationMinutes,
          videoUrl: input.videoUrl || undefined,
          description: input.description,
          isMandatory: input.isMandatory,
          order: input.order,
        };
        m.lessons.push(lesson);
        m.lessons.sort((a, b) => a.order - b.order);
        return lesson;
      }
    }
    return null;
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
    for (const course of seedCourses) {
      for (const m of course.modules) {
        const idx = m.lessons.findIndex((l) => l.id === lessonId);
        if (idx !== -1) {
          m.lessons[idx] = { ...m.lessons[idx], ...patch } as Lesson;
          if (patch.order !== undefined) m.lessons.sort((a, b) => a.order - b.order);
          return m.lessons[idx];
        }
      }
    }
    return null;
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
    for (const course of seedCourses) {
      for (const m of course.modules) {
        const idx = m.lessons.findIndex((l) => l.id === lessonId);
        if (idx !== -1) {
          m.lessons.splice(idx, 1);
          return true;
        }
      }
    }
    return false;
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

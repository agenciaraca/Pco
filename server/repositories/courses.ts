// Courses são lidos primariamente do seed enquanto o conteúdo não migra para CMS.
// Quando DB existe, lê de courses + modules + lessons + assessments.

import { eq, asc } from 'drizzle-orm';
import { getDb, schema } from '../db/client';
import { courses as seedCourses } from '../../src/app/data/seed';
import type { Course, Module, Lesson, Assessment } from '../../src/app/types/schema';
import type { UpdateCourseInput } from '../../shared/schemas';

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

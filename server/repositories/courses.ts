// Courses são lidos primariamente do seed enquanto o conteúdo não migra para CMS.
// Quando DB existe, lê de courses + modules + lessons + assessments.

import { eq, asc } from 'drizzle-orm';
import { getDb, schema } from '../db/client';
import { courses as seedCourses } from '../../src/app/data/seed';
import type { Course, Module, Lesson, Assessment } from '../../src/app/types/schema';

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

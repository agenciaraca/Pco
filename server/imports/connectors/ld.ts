// Connector LearnDash — REST sob /wp-json/ldlms/v2/.
// Cobre: courses, lessons, topics; pulls enrollments via /users/{id}/courses (uma chamada extra).

import { paginate } from './http';
import type { ImportConnection } from '../connections-store';
import { decryptCreds } from '../connections-store';

interface LdCourse {
  id: number;
  title?: { rendered?: string } | string;
  slug?: string;
  link?: string;
  date?: string;
  status?: string;
  meta?: Record<string, unknown>;
  course_access_list?: number[]; // user ids com acesso (nem sempre existe)
}

interface LdLesson {
  id: number;
  title?: { rendered?: string } | string;
  slug?: string;
  link?: string;
  status?: string;
  parent?: number;
  course?: number;
  menu_order?: number;
}

function unwrapTitle(t: LdCourse['title'] | LdLesson['title']): string {
  if (!t) return '';
  if (typeof t === 'string') return t;
  return t.rendered ?? '';
}

export async function fetchLdCourses(
  c: ImportConnection,
  perPage = 100,
): Promise<Array<Record<string, unknown>>> {
  const creds = decryptCreds(c);
  const out: Array<Record<string, unknown>> = [];
  for await (const batch of paginate<LdCourse>(
    {
      baseUrl: c.siteUrl,
      path: 'wp-json/ldlms/v2/sfwd-courses',
      username: creds.wpUsername,
      password: creds.wpAppPassword,
    },
    perPage,
  )) {
    for (const co of batch) {
      out.push({
        external_course_id: String(co.id),
        learndash_course_id: String(co.id),
        title: unwrapTitle(co.title),
        slug: co.slug ?? '',
        wp_status: co.status ?? '',
        published_at: co.date ?? '',
        access_duration_days: '',
      });
    }
  }
  return out;
}

export async function fetchLdLessons(
  c: ImportConnection,
  perPage = 100,
): Promise<Array<Record<string, unknown>>> {
  const creds = decryptCreds(c);
  const out: Array<Record<string, unknown>> = [];
  for await (const batch of paginate<LdLesson>(
    {
      baseUrl: c.siteUrl,
      path: 'wp-json/ldlms/v2/sfwd-lessons',
      username: creds.wpUsername,
      password: creds.wpAppPassword,
    },
    perPage,
  )) {
    for (const ls of batch) {
      out.push({
        external_lesson_id: String(ls.id),
        learndash_lesson_id: String(ls.id),
        title: unwrapTitle(ls.title),
        slug: ls.slug ?? '',
        course_external_id: ls.course ? String(ls.course) : '',
        order: ls.menu_order ?? 0,
      });
    }
  }
  return out;
}

/**
 * Para cada course, lê /sfwd-courses/{id}/users para inferir matrículas.
 * Retorna rows no formato canônico de enrollment.
 */
export async function fetchLdEnrollments(
  c: ImportConnection,
): Promise<Array<Record<string, unknown>>> {
  const creds = decryptCreds(c);
  const courses = await fetchLdCourses(c, 100);
  const out: Array<Record<string, unknown>> = [];

  for (const co of courses) {
    const courseId = String(co.external_course_id);
    try {
      // /sfwd-courses/{id}/users — endpoint LearnDash 4.x retorna lista com user_id, ou raw int[]
      const res = await fetch(
        `${c.siteUrl}/wp-json/ldlms/v2/sfwd-courses/${courseId}/users?per_page=100`,
        {
          headers: {
            Accept: 'application/json',
            ...(creds.wpUsername && creds.wpAppPassword
              ? {
                  Authorization: `Basic ${Buffer.from(
                    `${creds.wpUsername}:${creds.wpAppPassword}`,
                  ).toString('base64')}`,
                }
              : {}),
          },
        },
      );
      if (!res.ok) continue;
      const arr = (await res.json()) as Array<number | { id?: number; user_id?: number }>;
      for (const u of arr) {
        const userId =
          typeof u === 'number' ? u : (u.id ?? u.user_id);
        if (!userId) continue;
        out.push({
          external_enrollment_id: `ld:${courseId}:${userId}`,
          user_external_id: String(userId),
          course_external_id: courseId,
          learndash_course_id: courseId,
          status: 'active',
        });
      }
    } catch {
      // ignora cursos sem permissão/sem endpoint
    }
  }
  return out;
}

// Connector LearnDash — REST v2 (https://developers.learndash.com/learndash-rest-api-ldlms-v2/).
// Cobertura ampla:
//   - sfwd-courses (cursos)
//   - sfwd-lessons (aulas)
//   - sfwd-topic   (tópicos dentro de aulas)
//   - sfwd-quiz    (quizzes)
//   - sfwd-question (questões dos quizzes)
//   - groups       (grupos de alunos)
//   - sfwd-courses/{id}/users        (matrículas)
//   - sfwd-courses/{id}/groups       (relação curso↔grupo)
//   - sfwd-courses/{id}/steps        (estrutura completa)
//   - sfwd-courses/{id}/prerequisites
//   - users/{id}/course-progress
//   - users/{id}/courses
//
// Os endpoints que podem não existir em LD < 4.5 são tratados com try/catch — pulamos silenciosamente.

import { paginate, getJson, ConnectorError } from './http';
import type { ImportConnection } from '../connections-store';
import { decryptCreds } from '../connections-store';

// ---------- Tipos LearnDash (parcial — só o que usamos) ----------

interface LdRendered {
  rendered?: string;
}

interface LdCourse {
  id: number;
  title?: LdRendered | string;
  slug?: string;
  link?: string;
  date?: string;
  status?: string;
  excerpt?: LdRendered | string;
  content?: LdRendered | string;
  meta?: Record<string, unknown>;
  course_access_list?: number[];
  course_categories?: number[];
}

interface LdLesson {
  id: number;
  title?: LdRendered | string;
  slug?: string;
  link?: string;
  status?: string;
  parent?: number;
  course?: number;
  menu_order?: number;
  excerpt?: LdRendered | string;
  content?: LdRendered | string;
}

interface LdTopic {
  id: number;
  title?: LdRendered | string;
  slug?: string;
  status?: string;
  course?: number;
  lesson?: number;
  menu_order?: number;
  content?: LdRendered | string;
}

interface LdQuiz {
  id: number;
  title?: LdRendered | string;
  slug?: string;
  status?: string;
  course?: number;
  lesson?: number;
  date?: string;
}

interface LdQuestion {
  id: number;
  title?: LdRendered | string;
  slug?: string;
  quiz?: number;
  type?: string;
  points?: number;
}

interface LdGroup {
  id: number;
  title?: LdRendered | string;
  slug?: string;
  status?: string;
  date?: string;
}

function unwrap(t: LdRendered | string | undefined | null): string {
  if (!t) return '';
  if (typeof t === 'string') return t;
  return t.rendered ?? '';
}

function basicAuthHeader(c: ImportConnection): Record<string, string> {
  const creds = decryptCreds(c);
  if (!creds.wpUsername || !creds.wpAppPassword) return {};
  return {
    Authorization: `Basic ${Buffer.from(
      `${creds.wpUsername}:${creds.wpAppPassword}`,
    ).toString('base64')}`,
  };
}

async function tryFetchJson<T = unknown>(
  c: ImportConnection,
  path: string,
  opts: { query?: Record<string, string | number> } = {},
): Promise<T | null> {
  try {
    const res = await getJson<T>({
      baseUrl: c.siteUrl,
      path,
      query: opts.query,
      ...(() => {
        const creds = decryptCreds(c);
        return { username: creds.wpUsername, password: creds.wpAppPassword };
      })(),
      timeoutMs: 20_000,
    });
    return res.data;
  } catch {
    return null;
  }
}

// ---------- Cursos ----------

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
        title: unwrap(co.title),
        slug: co.slug ?? '',
        wp_status: co.status ?? '',
        published_at: co.date ?? '',
        access_duration_days: '',
        excerpt: unwrap(co.excerpt),
        content_html: unwrap(co.content),
        link: co.link ?? '',
        categories: (co.course_categories ?? []).join('|'),
      });
    }
  }
  return out;
}

// ---------- Aulas ----------

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
        title: unwrap(ls.title),
        slug: ls.slug ?? '',
        course_external_id: ls.course ? String(ls.course) : '',
        order: ls.menu_order ?? 0,
        excerpt: unwrap(ls.excerpt),
        content_html: unwrap(ls.content),
        wp_status: ls.status ?? '',
      });
    }
  }
  return out;
}

// ---------- Tópicos (dentro de aulas) ----------

export async function fetchLdTopics(
  c: ImportConnection,
  perPage = 100,
): Promise<Array<Record<string, unknown>>> {
  const creds = decryptCreds(c);
  const out: Array<Record<string, unknown>> = [];
  for await (const batch of paginate<LdTopic>(
    {
      baseUrl: c.siteUrl,
      path: 'wp-json/ldlms/v2/sfwd-topic',
      username: creds.wpUsername,
      password: creds.wpAppPassword,
    },
    perPage,
  )) {
    for (const t of batch) {
      out.push({
        external_topic_id: String(t.id),
        learndash_topic_id: String(t.id),
        title: unwrap(t.title),
        slug: t.slug ?? '',
        course_external_id: t.course ? String(t.course) : '',
        lesson_external_id: t.lesson ? String(t.lesson) : '',
        order: t.menu_order ?? 0,
        content_html: unwrap(t.content),
        wp_status: t.status ?? '',
      });
    }
  }
  return out;
}

// ---------- Quizzes ----------

export async function fetchLdQuizzes(
  c: ImportConnection,
  perPage = 100,
): Promise<Array<Record<string, unknown>>> {
  const creds = decryptCreds(c);
  const out: Array<Record<string, unknown>> = [];
  for await (const batch of paginate<LdQuiz>(
    {
      baseUrl: c.siteUrl,
      path: 'wp-json/ldlms/v2/sfwd-quiz',
      username: creds.wpUsername,
      password: creds.wpAppPassword,
    },
    perPage,
  )) {
    for (const q of batch) {
      out.push({
        external_quiz_id: String(q.id),
        learndash_quiz_id: String(q.id),
        title: unwrap(q.title),
        slug: q.slug ?? '',
        course_external_id: q.course ? String(q.course) : '',
        lesson_external_id: q.lesson ? String(q.lesson) : '',
        wp_status: q.status ?? '',
        published_at: q.date ?? '',
      });
    }
  }
  return out;
}

// ---------- Questões dos quizzes ----------

export async function fetchLdQuestions(
  c: ImportConnection,
  perPage = 100,
): Promise<Array<Record<string, unknown>>> {
  const creds = decryptCreds(c);
  const out: Array<Record<string, unknown>> = [];
  for await (const batch of paginate<LdQuestion>(
    {
      baseUrl: c.siteUrl,
      path: 'wp-json/ldlms/v2/sfwd-question',
      username: creds.wpUsername,
      password: creds.wpAppPassword,
    },
    perPage,
  )) {
    for (const q of batch) {
      out.push({
        external_question_id: String(q.id),
        learndash_question_id: String(q.id),
        title: unwrap(q.title),
        slug: q.slug ?? '',
        quiz_external_id: q.quiz ? String(q.quiz) : '',
        type: q.type ?? '',
        points: q.points ?? 1,
      });
    }
  }
  return out;
}

// ---------- Grupos de alunos ----------

export async function fetchLdGroups(
  c: ImportConnection,
  perPage = 100,
): Promise<Array<Record<string, unknown>>> {
  const creds = decryptCreds(c);
  const out: Array<Record<string, unknown>> = [];
  // LearnDash 4.x usa /groups; em versões antigas é /sfwd-groups. Tenta primeiro o moderno.
  const paths = ['wp-json/ldlms/v2/groups', 'wp-json/ldlms/v2/sfwd-groups'];
  for (const path of paths) {
    try {
      for await (const batch of paginate<LdGroup>(
        {
          baseUrl: c.siteUrl,
          path,
          username: creds.wpUsername,
          password: creds.wpAppPassword,
        },
        perPage,
      )) {
        for (const g of batch) {
          out.push({
            external_group_id: String(g.id),
            learndash_group_id: String(g.id),
            title: unwrap(g.title),
            slug: g.slug ?? '',
            wp_status: g.status ?? '',
            published_at: g.date ?? '',
          });
        }
      }
      if (out.length > 0) return out;
    } catch {
      // tenta o próximo path
    }
  }
  return out;
}

// ---------- Estrutura completa do curso ----------

export interface LdCourseSteps {
  courseId: string;
  // Árvore lessons → topics/quizzes
  lessons: Array<{
    lessonId: string;
    title?: string;
    topics: string[];
    quizzes: string[];
  }>;
  quizzes: string[]; // quizzes diretamente no curso
}

export async function fetchLdCourseSteps(
  c: ImportConnection,
  courseId: string,
): Promise<LdCourseSteps | null> {
  const data = await tryFetchJson<Record<string, unknown>>(
    c,
    `wp-json/ldlms/v2/sfwd-courses/${courseId}/steps`,
  );
  if (!data) return null;

  const lessonsRaw = (data['sfwd-lessons'] ?? {}) as Record<string, unknown>;
  const courseQuizzes = Object.keys(
    (data['sfwd-quiz'] ?? {}) as Record<string, unknown>,
  );

  const lessons: LdCourseSteps['lessons'] = Object.entries(lessonsRaw).map(
    ([lessonId, lessonNode]) => {
      const node = (lessonNode ?? {}) as Record<string, unknown>;
      const topics = Object.keys((node['sfwd-topic'] ?? {}) as Record<string, unknown>);
      const quizzes = Object.keys((node['sfwd-quiz'] ?? {}) as Record<string, unknown>);
      return { lessonId, topics, quizzes };
    },
  );

  return { courseId, lessons, quizzes: courseQuizzes };
}

// ---------- Pré-requisitos do curso ----------

export async function fetchLdCoursePrerequisites(
  c: ImportConnection,
  courseId: string,
): Promise<string[]> {
  const data = await tryFetchJson<unknown>(
    c,
    `wp-json/ldlms/v2/sfwd-courses/${courseId}/prerequisites`,
  );
  if (!data) return [];
  if (Array.isArray(data)) {
    return data.map((x) => (typeof x === 'number' ? String(x) : String((x as { id?: number }).id ?? '')));
  }
  return [];
}

// ---------- Matrículas via /courses/{id}/users ----------

export async function fetchLdEnrollments(
  c: ImportConnection,
): Promise<Array<Record<string, unknown>>> {
  const courses = await fetchLdCourses(c, 100);
  const out: Array<Record<string, unknown>> = [];
  const auth = basicAuthHeader(c);

  for (const co of courses) {
    const courseId = String(co.external_course_id);
    try {
      const res = await fetch(
        `${c.siteUrl}/wp-json/ldlms/v2/sfwd-courses/${courseId}/users?per_page=100`,
        { headers: { Accept: 'application/json', ...auth } },
      );
      if (!res.ok) continue;
      const arr = (await res.json()) as Array<number | { id?: number; user_id?: number }>;
      for (const u of arr) {
        const userId = typeof u === 'number' ? u : (u.id ?? u.user_id);
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
      /* ignora */
    }
  }
  return out;
}

// ---------- Progresso por aluno ----------

interface LdUserCourseProgress {
  course_id?: number;
  status?: string;
  completed?: number;
  total?: number;
  last_step?: number;
  date_completed?: string | null;
  steps?: Array<{
    post_id: number;
    post_type: string;
    status?: string;
    date?: string;
  }>;
}

/**
 * Para cada matrícula → busca course-progress detalhado em /users/{id}/course-progress.
 * Retorna rows no formato canônico de progress.
 */
export async function fetchLdProgress(
  c: ImportConnection,
): Promise<Array<Record<string, unknown>>> {
  const enrollments = await fetchLdEnrollments(c);
  const userIds = Array.from(new Set(enrollments.map((e) => String(e.user_external_id))));
  const out: Array<Record<string, unknown>> = [];
  const auth = basicAuthHeader(c);

  // Limite defensivo — não passar de 500 users em um único job
  for (const userId of userIds.slice(0, 500)) {
    try {
      const res = await fetch(
        `${c.siteUrl}/wp-json/ldlms/v2/users/${userId}/course-progress?per_page=100`,
        { headers: { Accept: 'application/json', ...auth } },
      );
      if (!res.ok) continue;
      const data = (await res.json()) as LdUserCourseProgress[];
      for (const p of Array.isArray(data) ? data : []) {
        if (!p.course_id) continue;
        out.push({
          user_external_id: userId,
          course_external_id: String(p.course_id),
          learndash_course_id: String(p.course_id),
          status: p.status ?? '',
          completed_steps: p.completed ?? 0,
          total_steps: p.total ?? 0,
          last_step: p.last_step ? String(p.last_step) : '',
          completed_at: p.date_completed ?? '',
          progress_percentage:
            p.total && p.total > 0
              ? Math.round(((p.completed ?? 0) / p.total) * 100)
              : 0,
        });
        // Steps detalhadas (se vier — vira lista de progress por aula/topic/quiz)
        for (const step of p.steps ?? []) {
          out.push({
            user_external_id: userId,
            course_external_id: String(p.course_id),
            external_step_id: String(step.post_id),
            step_type: step.post_type,
            status: step.status ?? '',
            completed_at: step.date ?? '',
          });
        }
      }
    } catch {
      /* ignora */
    }
  }
  return out;
}

// ---------- Ping da API LearnDash ----------

export async function pingLd(c: ImportConnection): Promise<{ ok: boolean; message: string; counts?: Record<string, number> }> {
  const creds = decryptCreds(c);
  // 1) caminho oficial ldlms/v2 (LD 3.x e 4.x)
  // 2) fallback para wp/v2/sfwd-courses (algumas instalações habilitam show_in_rest)
  const candidates = [
    'wp-json/ldlms/v2/sfwd-courses',
    'wp-json/wp/v2/sfwd-courses',
  ];
  let lastDetail = '';
  for (const path of candidates) {
    try {
      const r = await getJson<unknown[]>({
        baseUrl: c.siteUrl,
        path,
        query: { per_page: 1 },
        username: creds.wpUsername,
        password: creds.wpAppPassword,
        timeoutMs: 20_000,
      });
      const count = Array.isArray(r.data) ? r.data.length : 0;
      const ns = path.includes('ldlms') ? 'ldlms/v2' : 'wp/v2';
      return {
        ok: true,
        message: `LearnDash OK · namespace ${ns} · ${count} curso(s) na 1ª página${
          r.total ? ` (total ${r.total})` : ''
        }`,
      };
    } catch (err) {
      if (err instanceof ConnectorError) {
        lastDetail = `${path} → HTTP ${err.status}: ${String(err.body ?? '').slice(0, 200)}`;
        // 404 → endpoint não existe nesse namespace; tenta próximo
        if (err.status === 404) continue;
        // 401/403 → auth/permissão; tem mais info útil pra usuário
        if (err.status === 401 || err.status === 403) {
          return {
            ok: false,
            message: `LearnDash REST exige permissão (HTTP ${err.status}). Use Application Password de um usuário com role administrator/group_leader. Detalhe: ${String(
              err.body ?? '',
            ).slice(0, 200)}`,
          };
        }
        return { ok: false, message: lastDetail };
      }
      lastDetail = err instanceof Error ? err.message : String(err);
    }
  }
  return {
    ok: false,
    message: `LearnDash REST não acessível em nenhum namespace conhecido (ldlms/v2 ou wp/v2/sfwd-courses). Verifique se o plugin LearnDash LMS está ativo e se a REST API está habilitada nas configurações do plugin. Último erro: ${lastDetail}`,
  };
}

/**
 * Diagnóstico detalhado do LearnDash — testa cada endpoint individualmente
 * e retorna o status, ajudando o admin a saber se é falta de plugin,
 * falta de permissão ou bug do servidor.
 */
export async function diagnoseLd(c: ImportConnection): Promise<{
  rootNamespacesIncludesLdlms: boolean;
  rootNamespaces: string[];
  endpoints: Array<{ path: string; ok: boolean; status: number; detail: string }>;
  hint: string;
}> {
  const creds = decryptCreds(c);
  const baseUrl = c.siteUrl.replace(/\/+$/, '');
  const auth =
    creds.wpUsername && creds.wpAppPassword
      ? `Basic ${Buffer.from(`${creds.wpUsername}:${creds.wpAppPassword}`).toString('base64')}`
      : '';

  async function ping(
    path: string,
  ): Promise<{ ok: boolean; status: number; detail: string }> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12_000);
    try {
      const res = await fetch(`${baseUrl}${path}`, {
        headers: {
          Accept: 'application/json',
          ...(auth ? { Authorization: auth } : {}),
        },
        signal: ctrl.signal,
        redirect: 'follow',
      });
      clearTimeout(t);
      const txt = await res.text().catch(() => '');
      return {
        ok: res.ok,
        status: res.status,
        detail:
          res.status === 200
            ? `OK (${txt.length} bytes)`
            : txt.slice(0, 200) || res.statusText,
      };
    } catch (err) {
      clearTimeout(t);
      const e = err as { message?: string; name?: string };
      return {
        ok: false,
        status: 0,
        detail: e.name === 'AbortError' ? 'Timeout (12s)' : (e.message ?? 'fetch failed'),
      };
    }
  }

  const root = await ping('/wp-json');
  let rootNamespaces: string[] = [];
  try {
    const j = JSON.parse(root.detail.startsWith('OK') ? '{}' : root.detail) as {
      namespaces?: string[];
    };
    rootNamespaces = j.namespaces ?? [];
  } catch {
    // root pode ter sido OK mas detail é "OK (...bytes)" — refazer fetch só pra parse
    if (root.ok) {
      try {
        const r = await fetch(`${baseUrl}/wp-json`, {
          headers: { Accept: 'application/json', ...(auth ? { Authorization: auth } : {}) },
        });
        const j = (await r.json().catch(() => ({}))) as { namespaces?: string[] };
        rootNamespaces = j.namespaces ?? [];
      } catch {
        /* ignore */
      }
    }
  }

  const endpoints: Array<{ path: string; ok: boolean; status: number; detail: string }> = [];
  for (const path of [
    '/wp-json/ldlms/v2',
    '/wp-json/ldlms/v2/sfwd-courses?per_page=1',
    '/wp-json/wp/v2/sfwd-courses?per_page=1',
  ]) {
    const r = await ping(path);
    endpoints.push({ path, ...r });
  }

  const hasLdlms = rootNamespaces.some((n) => n === 'ldlms/v2' || n.startsWith('ldlms/'));
  let hint = '';
  if (!hasLdlms) {
    hint =
      'Namespace ldlms/v2 ausente em /wp-json. O plugin LearnDash provavelmente NÃO está ativado, OU o REST API foi desabilitado em LearnDash > Configurações > REST API.';
  } else if (endpoints.some((e) => e.status === 401 || e.status === 403)) {
    hint =
      'Namespace ldlms/v2 existe mas o user da Application Password não tem permissão. Use um user com role "administrator" (ou capability "read_courses_admin").';
  } else if (endpoints.every((e) => e.status === 404)) {
    hint =
      'Namespace ldlms/v2 existe mas as rotas /sfwd-courses retornam 404. Verifique a versão do LearnDash (REST estável a partir do 3.0+).';
  } else if (endpoints.every((e) => e.ok)) {
    hint = 'OK — LearnDash REST acessível. Pode importar cursos/aulas/quizzes.';
  } else {
    hint = 'Resposta mista. Veja os detalhes por endpoint abaixo.';
  }

  return {
    rootNamespacesIncludesLdlms: hasLdlms,
    rootNamespaces,
    endpoints,
    hint,
  };
}

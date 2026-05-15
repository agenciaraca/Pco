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

// ---------- LD slug discovery ----------
// Sites LD frequentemente customizam os slugs dos endpoints REST (especialmente
// em pt/es/fr). Em vez de hardcodar /sfwd-courses, pedimos /wp-json/ldlms/v2 e
// descobrimos os slugs reais. Cache em memória por connection id (TTL 10min).

export interface LdSlugs {
  courses: string;
  lessons: string;
  topics: string;
  quizzes: string;
  questions: string;
  groups: string;
  // Subrotas sob courses/{id}/X
  courseUsers: string;
  courseSteps: string;
  coursePrerequisites: string;
  // Subrotas sob users/{id}/X
  userCourseProgress: string;
}

const DEFAULT_LD_SLUGS: LdSlugs = {
  courses: 'sfwd-courses',
  lessons: 'sfwd-lessons',
  topics: 'sfwd-topic',
  quizzes: 'sfwd-quiz',
  questions: 'sfwd-question',
  groups: 'groups',
  courseUsers: 'users',
  courseSteps: 'steps',
  coursePrerequisites: 'prerequisites',
  userCourseProgress: 'course-progress',
};

// Aliases por idioma — ordem importa, primeiro match vence quando a busca
// inversa cair num empate.
const LD_SLUG_ALIASES: Record<keyof LdSlugs, string[]> = {
  courses: ['sfwd-courses', 'cursos', 'courses', 'cours', 'kurse'],
  lessons: ['sfwd-lessons', 'aulas', 'lecciones', 'lecons', 'lektionen', 'lessons'],
  topics: ['sfwd-topic', 'sfwd-topics', 'topicos', 'tópicos', 'topics', 'temas', 'themen'],
  quizzes: ['sfwd-quiz', 'teste', 'pruebas', 'quizzes', 'quiz'],
  questions: ['sfwd-question', 'sfwd-questions', 'perguntas', 'preguntas', 'questions', 'fragen'],
  groups: ['groups', 'sfwd-groups', 'grupos', 'gruppen'],
  courseUsers: ['users', 'usuarios', 'usuários', 'utilisateurs', 'benutzer'],
  courseSteps: ['steps', 'passo', 'pasos', 'etapes', 'étapes', 'schritte'],
  coursePrerequisites: ['prerequisites', 'prerequisitos', 'prerrequisitos', 'pre-requisitos', 'voraussetzungen'],
  userCourseProgress: ['course-progress', 'progresso-curso', 'progreso-curso'],
};

interface LdRouteIndex {
  namespace?: string;
  routes?: Record<string, unknown>;
}

interface SlugCacheEntry {
  slugs: LdSlugs;
  fetchedAt: number;
  rawRoutes: string[];
}

const SLUG_CACHE_TTL_MS = 10 * 60 * 1000;
const slugCache = new Map<string, SlugCacheEntry>();

async function fetchLdRouteIndex(c: ImportConnection): Promise<LdRouteIndex | null> {
  const creds = decryptCreds(c);
  // 1) tenta /wp-json/ldlms/v2 (compacto, só rotas LD)
  try {
    const r = await getJson<LdRouteIndex>({
      baseUrl: c.siteUrl,
      path: 'wp-json/ldlms/v2',
      username: creds.wpUsername,
      password: creds.wpAppPassword,
      timeoutMs: 12_000,
    });
    if (r.data && r.data.routes && Object.keys(r.data.routes).length > 0) {
      return r.data;
    }
  } catch {
    /* tenta fallback */
  }
  // 2) Fallback: /wp-json (root) lista TODAS as rotas de TODOS namespaces.
  // Filtramos pra só ldlms/v2. Funciona mesmo quando o ldlms/v2 isolado falha.
  try {
    const r = await getJson<{ routes?: Record<string, unknown> }>({
      baseUrl: c.siteUrl,
      path: 'wp-json',
      username: creds.wpUsername,
      password: creds.wpAppPassword,
      timeoutMs: 15_000,
    });
    const allRoutes = r.data?.routes ?? {};
    const ldRoutes: Record<string, unknown> = {};
    for (const [path, info] of Object.entries(allRoutes)) {
      if (path === '/ldlms/v2' || path.startsWith('/ldlms/v2/')) {
        ldRoutes[path] = info;
      }
    }
    if (Object.keys(ldRoutes).length > 0) {
      return { namespace: 'ldlms/v2', routes: ldRoutes };
    }
  } catch {
    /* fim — retorna null */
  }
  return null;
}

function extractTopLevelRouteSlugs(routes: string[]): Set<string> {
  const out = new Set<string>();
  for (const path of routes) {
    // só /ldlms/v2/<slug> exato — sem subpaths nem placeholders
    const m = /^\/ldlms\/v2\/([^/()]+)$/.exec(path);
    if (m && m[1]) out.add(m[1].toLowerCase());
  }
  return out;
}

function extractSubrouteSlugs(routes: string[], parentSlug: string): Set<string> {
  const out = new Set<string>();
  const prefix = `/ldlms/v2/${parentSlug}/`;
  for (const path of routes) {
    if (!path.startsWith(prefix)) continue;
    const segments = path.slice(prefix.length).split('/');
    // forma esperada: ['(?P<id>...)', '<child>'] — child pode ser palavra simples
    if (segments.length === 2) {
      const child = segments[1];
      if (child && !child.includes('(')) out.add(child.toLowerCase());
    }
  }
  return out;
}

function pickSlug(available: Set<string>, aliases: string[], fallback: string): string {
  for (const a of aliases) {
    if (available.has(a.toLowerCase())) return a;
  }
  return fallback;
}

export async function getLdSlugs(c: ImportConnection): Promise<LdSlugs> {
  const cached = slugCache.get(c.id);
  if (cached && Date.now() - cached.fetchedAt < SLUG_CACHE_TTL_MS) {
    return cached.slugs;
  }
  const idx = await fetchLdRouteIndex(c);
  if (!idx || !idx.routes) {
    // Sem index acessível — usa defaults (mantém comportamento legado)
    const slugs = { ...DEFAULT_LD_SLUGS };
    slugCache.set(c.id, { slugs, fetchedAt: Date.now(), rawRoutes: [] });
    return slugs;
  }
  const allRoutes = Object.keys(idx.routes);
  const topLevel = extractTopLevelRouteSlugs(allRoutes);
  const courses = pickSlug(topLevel, LD_SLUG_ALIASES.courses, DEFAULT_LD_SLUGS.courses);
  const lessons = pickSlug(topLevel, LD_SLUG_ALIASES.lessons, DEFAULT_LD_SLUGS.lessons);
  const topics = pickSlug(topLevel, LD_SLUG_ALIASES.topics, DEFAULT_LD_SLUGS.topics);
  const quizzes = pickSlug(topLevel, LD_SLUG_ALIASES.quizzes, DEFAULT_LD_SLUGS.quizzes);
  const questions = pickSlug(topLevel, LD_SLUG_ALIASES.questions, DEFAULT_LD_SLUGS.questions);
  const groups = pickSlug(topLevel, LD_SLUG_ALIASES.groups, DEFAULT_LD_SLUGS.groups);

  const coursesSubs = extractSubrouteSlugs(allRoutes, courses);
  const userSubs = extractSubrouteSlugs(allRoutes, 'users');

  const slugs: LdSlugs = {
    courses,
    lessons,
    topics,
    quizzes,
    questions,
    groups,
    courseUsers: pickSlug(coursesSubs, LD_SLUG_ALIASES.courseUsers, DEFAULT_LD_SLUGS.courseUsers),
    courseSteps: pickSlug(coursesSubs, LD_SLUG_ALIASES.courseSteps, DEFAULT_LD_SLUGS.courseSteps),
    coursePrerequisites: pickSlug(
      coursesSubs,
      LD_SLUG_ALIASES.coursePrerequisites,
      DEFAULT_LD_SLUGS.coursePrerequisites,
    ),
    userCourseProgress: pickSlug(
      userSubs,
      LD_SLUG_ALIASES.userCourseProgress,
      DEFAULT_LD_SLUGS.userCourseProgress,
    ),
  };
  slugCache.set(c.id, { slugs, fetchedAt: Date.now(), rawRoutes: allRoutes });
  return slugs;
}

export function _resetLdSlugCacheForTests(): void {
  slugCache.clear();
}

/**
 * Itera nos aliases conhecidos pra um kind até achar um que retorne 200 (não 404).
 * Usado quando o slug descoberto retorna rest_no_route (discovery falhou ou
 * slug mudou). Atualiza o cache com o slug que funcionou.
 */
async function findWorkingSlug(
  c: ImportConnection,
  kind: keyof LdSlugs,
  perPage = 1,
): Promise<string | null> {
  const creds = decryptCreds(c);
  for (const candidate of LD_SLUG_ALIASES[kind]) {
    try {
      const r = await getJson<unknown[]>({
        baseUrl: c.siteUrl,
        path: `wp-json/ldlms/v2/${candidate}`,
        query: { per_page: perPage },
        username: creds.wpUsername,
        password: creds.wpAppPassword,
        timeoutMs: 12_000,
      });
      if (Array.isArray(r.data)) {
        // Atualiza cache
        const cached = slugCache.get(c.id);
        if (cached) {
          cached.slugs[kind] = candidate;
          cached.fetchedAt = Date.now();
        }
        return candidate;
      }
    } catch (err) {
      // continua tentando próximo alias se for 404
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('HTTP 404')) {
        // Erros não-404 (401, 403, 500, rede): não vale a pena continuar.
        return null;
      }
    }
  }
  return null;
}

/**
 * Busca top-level com retry automático em aliases se o slug atual der 404.
 * Wrapper genérico usado pelas funções fetchLd*. Returns rows accumulated.
 */
async function paginateWithSlugFallback(
  c: ImportConnection,
  kind: keyof LdSlugs,
  initialSlug: string,
  perPage: number,
): Promise<string> {
  // Tenta uma chamada de teste rápida pra detectar 404
  const creds = decryptCreds(c);
  try {
    await getJson<unknown[]>({
      baseUrl: c.siteUrl,
      path: `wp-json/ldlms/v2/${initialSlug}`,
      query: { per_page: 1 },
      username: creds.wpUsername,
      password: creds.wpAppPassword,
      timeoutMs: 12_000,
    });
    return initialSlug;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('HTTP 404') || msg.includes('rest_no_route')) {
      const found = await findWorkingSlug(c, kind, perPage);
      if (found) return found;
    }
    throw err;
  }
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
  const slugs = await getLdSlugs(c);
  const courseSlug = await paginateWithSlugFallback(c, 'courses', slugs.courses, perPage);
  const out: Array<Record<string, unknown>> = [];
  // status=any inclui drafts/private — sites WP frequentemente têm cursos
  // não-publicados com alunos matriculados (rascunhos, programas internos).
  for await (const batch of paginate<LdCourse>(
    {
      baseUrl: c.siteUrl,
      path: `wp-json/ldlms/v2/${courseSlug}`,
      query: { status: 'any' },
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
  const slugs = await getLdSlugs(c);
  const lessonSlug = await paginateWithSlugFallback(c, 'lessons', slugs.lessons, perPage);
  const out: Array<Record<string, unknown>> = [];
  for await (const batch of paginate<LdLesson>(
    {
      baseUrl: c.siteUrl,
      path: `wp-json/ldlms/v2/${lessonSlug}`,
      query: { status: 'any' },
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
  const slugs = await getLdSlugs(c);
  const topicSlug = await paginateWithSlugFallback(c, 'topics', slugs.topics, perPage);
  const out: Array<Record<string, unknown>> = [];
  for await (const batch of paginate<LdTopic>(
    {
      baseUrl: c.siteUrl,
      path: `wp-json/ldlms/v2/${topicSlug}`,
      query: { status: 'any' },
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
  const slugs = await getLdSlugs(c);
  const quizSlug = await paginateWithSlugFallback(c, 'quizzes', slugs.quizzes, perPage);
  const out: Array<Record<string, unknown>> = [];
  for await (const batch of paginate<LdQuiz>(
    {
      baseUrl: c.siteUrl,
      path: `wp-json/ldlms/v2/${quizSlug}`,
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
  const slugs = await getLdSlugs(c);
  const questionSlug = await paginateWithSlugFallback(c, 'questions', slugs.questions, perPage);
  const out: Array<Record<string, unknown>> = [];
  for await (const batch of paginate<LdQuestion>(
    {
      baseUrl: c.siteUrl,
      path: `wp-json/ldlms/v2/${questionSlug}`,
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
  const slugs = await getLdSlugs(c);
  const out: Array<Record<string, unknown>> = [];
  // Discovery decide o slug; mas mantemos fallback histórico (sfwd-groups) caso o
  // index esteja inacessível mas o site tenha LD antigo.
  const paths = [
    `wp-json/ldlms/v2/${slugs.groups}`,
    'wp-json/ldlms/v2/sfwd-groups',
  ].filter((p, i, a) => a.indexOf(p) === i);
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
  const slugs = await getLdSlugs(c);
  const data = await tryFetchJson<Record<string, unknown>>(
    c,
    `wp-json/ldlms/v2/${slugs.courses}/${courseId}/${slugs.courseSteps}`,
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
  const slugs = await getLdSlugs(c);
  const data = await tryFetchJson<unknown>(
    c,
    `wp-json/ldlms/v2/${slugs.courses}/${courseId}/${slugs.coursePrerequisites}`,
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
  const slugs = await getLdSlugs(c);
  const courses = await fetchLdCourses(c, 100);
  const out: Array<Record<string, unknown>> = [];
  const auth = basicAuthHeader(c);

  for (const co of courses) {
    const courseId = String(co.external_course_id);
    // Pagina todos os usuários de cada curso (X-WP-TotalPages do WP REST).
    let page = 1;
    let totalPages = 1;
    do {
      try {
        const res = await fetch(
          `${c.siteUrl}/wp-json/ldlms/v2/${slugs.courses}/${courseId}/${slugs.courseUsers}?per_page=100&page=${page}`,
          { headers: { Accept: 'application/json', ...auth } },
        );
        if (!res.ok) break;
        const tp = Number(res.headers.get('x-wp-totalpages') ?? '');
        if (Number.isFinite(tp) && tp > 0) totalPages = tp;
        const arr = (await res.json()) as Array<number | { id?: number; user_id?: number }>;
        if (!Array.isArray(arr) || arr.length === 0) break;
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
        break;
      }
      page++;
    } while (page <= totalPages && page <= 50); // teto de segurança
  }
  return out;
}

// ---------- Progresso por aluno ----------

interface LdUserCourseProgress {
  // LD 4.x v2 nomes "novos"
  course?: number;
  progress_status?: string;
  steps_completed?: number;
  steps_total?: number;
  date_started?: string | null;
  // LD legado / variações
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
  const slugs = await getLdSlugs(c);
  const enrollments = await fetchLdEnrollments(c);
  const userIds = Array.from(new Set(enrollments.map((e) => String(e.user_external_id))));
  const out: Array<Record<string, unknown>> = [];
  const auth = basicAuthHeader(c);

  // Limite defensivo configurável via env (default 1000)
  const max = Number(process.env.LD_PROGRESS_MAX_USERS ?? 1000);
  for (const userId of userIds.slice(0, max)) {
    try {
      const res = await fetch(
        `${c.siteUrl}/wp-json/ldlms/v2/users/${userId}/${slugs.userCourseProgress}?per_page=100`,
        { headers: { Accept: 'application/json', ...auth } },
      );
      if (!res.ok) continue;
      const data = (await res.json()) as LdUserCourseProgress[];
      for (const p of Array.isArray(data) ? data : []) {
        // LD 4.x v2 usa "course"; legado usa "course_id"
        const courseId = p.course ?? p.course_id;
        if (!courseId) continue;
        const completed = p.steps_completed ?? p.completed ?? 0;
        const total = p.steps_total ?? p.total ?? 0;
        const status = p.progress_status ?? p.status ?? '';
        out.push({
          user_external_id: userId,
          course_external_id: String(courseId),
          learndash_course_id: String(courseId),
          status,
          completed_steps: completed,
          total_steps: total,
          last_step: p.last_step ? String(p.last_step) : '',
          started_at: p.date_started ?? '',
          completed_at: p.date_completed ?? '',
          progress_percentage:
            total > 0 ? Math.round((completed / total) * 100) : 0,
        });
        // Steps detalhadas (se vier — vira lista de progress por aula/topic/quiz)
        for (const step of p.steps ?? []) {
          out.push({
            user_external_id: userId,
            course_external_id: String(courseId),
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
  // Discovery primeiro: descobre o slug real (sfwd-courses, cursos, cursos, etc.)
  const slugs = await getLdSlugs(c);
  // 1) caminho oficial ldlms/v2 com slug descoberto
  // 2) fallback wp/v2 (algumas instalações habilitam show_in_rest no post type)
  const candidates = [
    `wp-json/ldlms/v2/${slugs.courses}`,
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
      const slugInfo =
        slugs.courses !== DEFAULT_LD_SLUGS.courses
          ? ` · slug custom: "${slugs.courses}"`
          : '';
      return {
        ok: true,
        message: `LearnDash OK · namespace ${ns}${slugInfo} · ${count} curso(s) na 1ª página${
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
  discoveredSlugs: LdSlugs;
  customSlugs: Array<{ entity: keyof LdSlugs; default: string; actual: string }>;
  rawRoutesPreview: string[];
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

  // Limpa cache pra rodar discovery fresh — admin clicou pra debugar
  slugCache.delete(c.id);
  const discoveredSlugs = await getLdSlugs(c);

  const endpoints: Array<{ path: string; ok: boolean; status: number; detail: string }> = [];
  const candidatePaths = [
    '/wp-json/ldlms/v2',
    `/wp-json/ldlms/v2/${discoveredSlugs.courses}?per_page=1`,
  ];
  // Inclui o default sfwd-courses só se for diferente do descoberto, pra deixar
  // claro qual está respondendo.
  if (discoveredSlugs.courses !== DEFAULT_LD_SLUGS.courses) {
    candidatePaths.push(`/wp-json/ldlms/v2/${DEFAULT_LD_SLUGS.courses}?per_page=1`);
  }
  candidatePaths.push('/wp-json/wp/v2/sfwd-courses?per_page=1');
  for (const path of candidatePaths) {
    const r = await ping(path);
    endpoints.push({ path, ...r });
  }

  const customSlugs: Array<{ entity: keyof LdSlugs; default: string; actual: string }> = [];
  for (const k of Object.keys(DEFAULT_LD_SLUGS) as Array<keyof LdSlugs>) {
    if (discoveredSlugs[k] !== DEFAULT_LD_SLUGS[k]) {
      customSlugs.push({
        entity: k,
        default: DEFAULT_LD_SLUGS[k],
        actual: discoveredSlugs[k],
      });
    }
  }

  const hasLdlms = rootNamespaces.some((n) => n === 'ldlms/v2' || n.startsWith('ldlms/'));
  let hint = '';
  const coursesOk = endpoints.find((e) =>
    e.path.includes(`/${discoveredSlugs.courses}`),
  )?.ok;
  if (!hasLdlms) {
    hint =
      'Namespace ldlms/v2 ausente em /wp-json. O plugin LearnDash provavelmente NÃO está ativado, OU o REST API foi desabilitado em LearnDash > Configurações > REST API.';
  } else if (endpoints.some((e) => e.status === 401 || e.status === 403)) {
    hint =
      'Namespace ldlms/v2 existe mas o user da Application Password não tem permissão. Use um user com role "administrator" (ou capability "read_courses_admin").';
  } else if (coursesOk) {
    hint =
      customSlugs.length > 0
        ? `OK — LearnDash REST acessível com ${customSlugs.length} slug(s) custom (idioma localizado). O AVA já adapta automaticamente.`
        : 'OK — LearnDash REST acessível. Pode importar cursos/aulas/quizzes.';
  } else if (endpoints.every((e) => e.status === 404)) {
    hint =
      'Namespace ldlms/v2 existe mas o endpoint de cursos retorna 404 mesmo no slug descoberto. Verifique a versão do LearnDash (REST estável a partir do 3.0+).';
  } else {
    hint = 'Resposta mista. Veja os detalhes por endpoint abaixo.';
  }

  // Pega routes brutas (do cache pós-discovery) pra debug
  const cached = slugCache.get(c.id);
  const rawRoutesPreview = cached
    ? cached.rawRoutes.filter((r) => r.startsWith('/ldlms/v2')).slice(0, 30)
    : [];

  return {
    rootNamespacesIncludesLdlms: hasLdlms,
    rootNamespaces,
    endpoints,
    discoveredSlugs,
    customSlugs,
    rawRoutesPreview,
    hint,
  };
}

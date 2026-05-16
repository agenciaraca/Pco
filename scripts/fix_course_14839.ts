/**
 * Reconstroi a estrutura do curso 14839 ("Curso de Psicanálise Clínica Online")
 * lendo a árvore REAL do LearnDash via /wp-json/ldlms/v2/cursos/14839/passo.
 *
 * Motivo: o import anterior só pegou 3 lessons "diretas" via filtro
 * course_external_id; perdeu 16 lessons compartilhadas com outros cursos
 * (LD shared steps). Resultado: 1 módulo "Conteúdo Completo" com 3 aulas.
 *
 * Resultado esperado: 19 módulos × ~146 aulas, hierarquia LD lesson → AVA módulo,
 * LD topic → AVA aula.
 *
 * Mantém intactos: outros 15 cursos em data/courses.json, enrollments,
 * progressByCourse (referenciam courseId=14839, não aula individual).
 *
 * Uso:
 *   npx tsx scripts/fix_course_14839.ts [--dry-run]
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

const COURSE_ID = '14839';
const PORTAL_URL = 'https://portalpco.online';

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes('--dry-run');

const log = (m: string) => console.log(`[fix-14839] ${m}`);

interface StepsResponse {
  h: {
    'sfwd-lessons'?: Record<
      string,
      {
        'sfwd-topic'?: Record<string, unknown>;
        'sfwd-quiz'?: Record<string, unknown> | unknown[];
      }
    >;
  };
}

interface LdPost {
  id: number;
  title?: { rendered?: string } | string;
  slug?: string;
  menu_order?: number;
  excerpt?: { rendered?: string } | string;
  content?: { rendered?: string } | string;
}

function loadCreds() {
  return {
    user: 'claude',
    pass: 'ibYs vril 09iY AhkB 8LSm rnvV',
  };
}

function authHeader(): string {
  const c = loadCreds();
  return 'Basic ' + Buffer.from(`${c.user}:${c.pass}`).toString('base64');
}

async function fetchJson<T>(p: string): Promise<T> {
  const r = await fetch(PORTAL_URL + p, {
    headers: { Authorization: authHeader() },
  });
  if (!r.ok) throw new Error(`${p} → ${r.status} ${r.statusText}`);
  return r.json() as Promise<T>;
}

function unwrap(v: unknown): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v && 'rendered' in v) {
    return String((v as { rendered: unknown }).rendered ?? '');
  }
  return String(v);
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#8217;/g, "'")
    .replace(/&#8211;/g, '–')
    .replace(/\s+/g, ' ')
    .trim();
}

interface AvaLesson {
  id: string;
  moduleId: string;
  courseId: string;
  title: string;
  durationMinutes: number;
  description?: string;
  isMandatory: boolean;
  order: number;
  status?: 'pending' | 'in_progress' | 'completed' | 'available';
}

interface AvaModule {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  order: number;
  lessons: AvaLesson[];
}

interface AvaCourse {
  id: string;
  slug: string;
  title: string;
  shortTitle: string;
  description: string;
  coverColor: string;
  modules: AvaModule[];
  totalHours: number;
  certificateAvailable: boolean;
  tags?: string[];
}

async function main(): Promise<void> {
  log(`buscando árvore /cursos/${COURSE_ID}/passo ...`);
  const steps = await fetchJson<StepsResponse>(
    `/wp-json/ldlms/v2/cursos/${COURSE_ID}/passo`,
  );
  const lessonsMap = steps.h['sfwd-lessons'] ?? {};
  const lessonIds = Object.keys(lessonsMap);
  log(`encontradas ${lessonIds.length} lessons no LD`);

  // Buscar título do curso
  const courseMeta = await fetchJson<LdPost>(
    `/wp-json/ldlms/v2/cursos/${COURSE_ID}`,
  );
  const courseTitle = stripHtml(unwrap(courseMeta.title)) || 'Curso 14839';
  const courseSlug = courseMeta.slug ?? 'curso-de-psicanalise-clinica-online';
  log(`curso: "${courseTitle}" (slug: ${courseSlug})`);

  // Para cada lesson, buscar título + menu_order; e para cada topic, idem.
  const modules: AvaModule[] = [];
  let totalTopics = 0;

  // Buscamos em paralelo controlado (5 concorrentes) pra não floodar o WP
  const lessonMeta = await runLimited(
    lessonIds,
    5,
    async (lid): Promise<{ lid: string; post: LdPost; topics: string[] }> => {
      const post = await fetchJson<LdPost>(
        `/wp-json/ldlms/v2/aulas/${lid}`,
      );
      const topicIds = Object.keys(lessonsMap[lid]?.['sfwd-topic'] ?? {});
      return { lid, post, topics: topicIds };
    },
  );

  // A ordem da árvore /passo já é a ordem oficial do LD (ld_course_steps_order).
  // menu_order é global e não bate com a ordem do curso, então NÃO usar.
  lessonMeta.sort(
    (a, b) => lessonIds.indexOf(a.lid) - lessonIds.indexOf(b.lid),
  );

  for (let mIdx = 0; mIdx < lessonMeta.length; mIdx++) {
    const { lid, post, topics: topicIds } = lessonMeta[mIdx]!;
    const moduleTitle = stripHtml(unwrap(post.title)) || `Módulo ${mIdx + 1}`;
    const moduleId = `mod-${COURSE_ID}-${lid}`;
    log(`  [${mIdx + 1}] "${moduleTitle}" (${topicIds.length} aulas)`);

    // Buscar título de cada topic
    const topicMeta = await runLimited(
      topicIds,
      5,
      async (tid): Promise<{ tid: string; post: LdPost }> => {
        const post = await fetchJson<LdPost>(
          `/wp-json/ldlms/v2/topicos/${tid}`,
        );
        return { tid, post };
      },
    );

    // Mesma lógica: árvore /passo já dá a ordem correta dos topics
    topicMeta.sort(
      (a, b) => topicIds.indexOf(a.tid) - topicIds.indexOf(b.tid),
    );

    const lessons: AvaLesson[] = topicMeta.map((t, idx) => ({
      id: `lesson-${COURSE_ID}-${t.tid}`,
      moduleId,
      courseId: COURSE_ID,
      title: stripHtml(unwrap(t.post.title)) || `Aula ${idx + 1}`,
      durationMinutes: 15,
      description: stripHtml(unwrap(t.post.excerpt)).slice(0, 500),
      isMandatory: true,
      order: idx + 1,
      status: 'available' as const,
    }));

    totalTopics += lessons.length;

    modules.push({
      id: moduleId,
      courseId: COURSE_ID,
      title: moduleTitle,
      description: stripHtml(unwrap(post.excerpt)).slice(0, 300),
      order: mIdx + 1,
      lessons,
    });
  }

  const totalHours = Math.max(1, Math.round((totalTopics * 15) / 60));
  log(`total: ${modules.length} módulos × ${totalTopics} aulas (~${totalHours}h)`);

  // Carrega courses.json existente
  const coursesPath = path.resolve(process.cwd(), 'data/courses.json');
  const existing = JSON.parse(
    await fs.readFile(coursesPath, 'utf8'),
  ) as AvaCourse[];

  const idx = existing.findIndex((c) => c.id === COURSE_ID);
  if (idx === -1) {
    throw new Error(`Curso ${COURSE_ID} não existe em data/courses.json — abortando`);
  }
  const prev = existing[idx]!;
  log(`antes: ${prev.modules?.length ?? 0} módulos × ${(prev.modules ?? []).reduce((a, m) => a + (m.lessons?.length ?? 0), 0)} aulas`);

  const updated: AvaCourse = {
    ...prev,
    title: courseTitle,
    slug: courseSlug,
    shortTitle: courseTitle.length > 40 ? courseTitle.slice(0, 37) + '...' : courseTitle,
    modules,
    totalHours,
  };

  if (DRY_RUN) {
    log('DRY_RUN — não grava');
    return;
  }

  existing[idx] = updated;
  await fs.writeFile(coursesPath, JSON.stringify(existing, null, 2), 'utf8');
  log(`courses.json atualizado (curso ${COURSE_ID} substituído)`);
}

async function runLimited<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  async function worker(): Promise<void> {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

main().catch((err) => {
  console.error('[fix-14839] erro:', err);
  process.exit(1);
});

/**
 * Re-importa a estrutura real (módulos + aulas) de um ou mais cursos LD usando
 * o endpoint /wp-json/ldlms/v2/cursos/:id/passo.
 *
 * Generaliza o fix_course_14839.ts pra rodar em qualquer course ID. O motivo
 * do bug é o mesmo: lessons compartilhadas entre cursos (LD shared steps)
 * não aparecem com filtro course_external_id direto.
 *
 * Uso:
 *   npx tsx scripts/fix_courses.ts <id1> [id2] [id3...] [--dry-run]
 *   npx tsx scripts/fix_courses.ts --all  (todos os cursos que tem em courses.json)
 *
 * Exemplos:
 *   npx tsx scripts/fix_courses.ts 8495 8748
 *   npx tsx scripts/fix_courses.ts --all --dry-run
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

const PORTAL_URL = 'https://portalpco.online';
const PORTAL_USER = 'claude';
const PORTAL_PASS = 'ibYs vril 09iY AhkB 8LSm rnvV';

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes('--dry-run');
const ALL = argv.includes('--all');
const courseIdsArg = argv.filter((a) => /^\d+$/.test(a));

const log = (m: string) => console.log(`[fix-courses] ${m}`);

interface StepsResponse {
  h: {
    'sfwd-lessons'?: Record<
      string,
      { 'sfwd-topic'?: Record<string, unknown> }
    >;
  };
}
interface LdPost {
  id: number;
  title?: { rendered?: string; raw?: string } | string;
  slug?: string;
  menu_order?: number;
  excerpt?: { rendered?: string; raw?: string } | string;
  content?: { rendered?: string; raw?: string } | string;
}

function authHeader(): string {
  return 'Basic ' + Buffer.from(`${PORTAL_USER}:${PORTAL_PASS}`).toString('base64');
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
  if (typeof v === 'object' && v && 'raw' in v) {
    const raw = (v as { raw?: unknown }).raw;
    if (typeof raw === 'string' && raw.length > 0) return raw;
  }
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

function cleanLdElementorWrapper(html: string): string {
  return html
    .replace(/<nav[^>]*ld-breadcrumbs[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<div[^>]*ld-progress[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi, '')
    .replace(/<div[^>]*ld-status[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<div[^>]*learndash-wrapper[^>]*>/gi, '<div>')
    .replace(/<div[^>]*ld-topic-status[^>]*>[\s\S]*?<\/div>\s*<\/div>/gi, '')
    .replace(/Módulo Progresso[\s\S]*?% Concluído/g, '')
    .replace(/Aula anterior\s+Voltar para Módulo\s+Próximo Aula/g, '')
    .trim();
}

function normalizeVideoEmbed(src: string): string {
  const ytWatch = src.match(/youtube\.com\/watch\?v=([\w-]{11})/);
  if (ytWatch) return `https://www.youtube.com/embed/${ytWatch[1]}`;
  const ytShort = src.match(/youtu\.be\/([\w-]{11})/);
  if (ytShort) return `https://www.youtube.com/embed/${ytShort[1]}`;
  const vm = src.match(/^(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return src;
}

function extractVideoUrl(html: string): string | null {
  if (!html) return null;
  const iframeMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  if (iframeMatch) {
    const src = iframeMatch[1]!;
    if (/youtube\.com|youtu\.be|vimeo\.com/i.test(src)) {
      return normalizeVideoEmbed(src);
    }
  }
  const yt = html.match(
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/,
  );
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = html.match(/(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}

interface AvaLesson {
  id: string;
  moduleId: string;
  courseId: string;
  title: string;
  durationMinutes: number;
  videoUrl?: string;
  description?: string;
  content?: string;
  isMandatory: boolean;
  order: number;
  status?: 'available';
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
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return out;
}

async function fixCourse(courseId: string, existing: AvaCourse[]): Promise<AvaCourse | null> {
  log(`--- curso ${courseId} ---`);
  let steps: StepsResponse;
  try {
    steps = await fetchJson<StepsResponse>(
      `/wp-json/ldlms/v2/cursos/${courseId}/passo`,
    );
  } catch (e) {
    log(`  ⚠ erro ao buscar passo: ${(e as Error).message}`);
    return null;
  }
  const lessonsMap = steps.h['sfwd-lessons'] ?? {};
  const lessonIds = Object.keys(lessonsMap);
  log(`  ${lessonIds.length} lessons na árvore LD`);
  if (lessonIds.length === 0) {
    log('  curso sem estrutura no LD — preservando estado atual');
    return null;
  }

  let courseMeta: LdPost | null = null;
  try {
    courseMeta = await fetchJson<LdPost>(
      `/wp-json/ldlms/v2/cursos/${courseId}`,
    );
  } catch {
    // segue mesmo sem metadata do curso
  }
  const courseTitle = courseMeta
    ? stripHtml(unwrap(courseMeta.title)) || `Curso ${courseId}`
    : existing.find((c) => c.id === courseId)?.title ?? `Curso ${courseId}`;
  const courseSlug =
    courseMeta?.slug ?? existing.find((c) => c.id === courseId)?.slug ?? courseId;
  log(`  "${courseTitle}"`);

  const lessonMeta = await runLimited(
    lessonIds,
    5,
    async (lid): Promise<{ lid: string; post: LdPost; topicIds: string[] }> => {
      const post = await fetchJson<LdPost>(
        `/wp-json/ldlms/v2/aulas/${lid}?context=edit`,
      );
      const topicIds = Object.keys(lessonsMap[lid]?.['sfwd-topic'] ?? {});
      return { lid, post, topicIds };
    },
  );
  lessonMeta.sort(
    (a, b) => lessonIds.indexOf(a.lid) - lessonIds.indexOf(b.lid),
  );

  const modules: AvaModule[] = [];
  let totalTopics = 0;

  for (let mIdx = 0; mIdx < lessonMeta.length; mIdx++) {
    const { lid, post, topicIds } = lessonMeta[mIdx]!;
    const moduleTitle = stripHtml(unwrap(post.title)) || `Módulo ${mIdx + 1}`;
    const moduleId = `mod-${courseId}-${lid}`;
    log(`    [${mIdx + 1}] ${moduleTitle} (${topicIds.length} aulas)`);

    const topicMeta = topicIds.length === 0
      ? []
      : await runLimited(
          topicIds,
          5,
          async (tid): Promise<{ tid: string; post: LdPost }> => {
            const post = await fetchJson<LdPost>(
              `/wp-json/ldlms/v2/topicos/${tid}?context=edit`,
            );
            return { tid, post };
          },
        );
    topicMeta.sort(
      (a, b) => topicIds.indexOf(a.tid) - topicIds.indexOf(b.tid),
    );

    const lessons: AvaLesson[] = topicMeta.map((t, idx) => {
      const contentRaw =
        t.post.content && typeof t.post.content === 'object' && 'raw' in t.post.content
          ? String((t.post.content as { raw?: unknown }).raw ?? '')
          : '';
      const contentRendered =
        t.post.content && typeof t.post.content === 'object' && 'rendered' in t.post.content
          ? String((t.post.content as { rendered?: unknown }).rendered ?? '')
          : '';
      const contentHtml = contentRaw
        ? contentRaw
        : cleanLdElementorWrapper(contentRendered);
      const videoUrl =
        extractVideoUrl(contentRendered) ?? extractVideoUrl(contentHtml) ?? undefined;
      const plain = stripHtml(contentHtml);
      const description = plain.slice(0, 500);
      return {
        id: `lesson-${courseId}-${t.tid}`,
        moduleId,
        courseId,
        title: stripHtml(unwrap(t.post.title)) || `Aula ${idx + 1}`,
        durationMinutes: 15,
        videoUrl,
        description: description || undefined,
        content: contentHtml || undefined,
        isMandatory: true,
        order: idx + 1,
        status: 'available' as const,
      };
    });
    totalTopics += lessons.length;
    modules.push({
      id: moduleId,
      courseId,
      title: moduleTitle,
      description: stripHtml(unwrap(post.excerpt)).slice(0, 300),
      order: mIdx + 1,
      lessons,
    });
  }

  const totalHours = Math.max(1, Math.round((totalTopics * 15) / 60));
  log(`  ✓ ${modules.length} módulos × ${totalTopics} aulas (~${totalHours}h)`);

  const prev = existing.find((c) => c.id === courseId);
  const baseCourse: AvaCourse = prev ?? {
    id: courseId,
    slug: courseSlug,
    title: courseTitle,
    shortTitle: courseTitle.length > 40 ? courseTitle.slice(0, 37) + '...' : courseTitle,
    description: courseTitle,
    coverColor: '#0097B2',
    modules: [],
    totalHours: 0,
    certificateAvailable: true,
    tags: ['importado-ld'],
  };
  return {
    ...baseCourse,
    title: courseTitle,
    slug: courseSlug,
    shortTitle: courseTitle.length > 40 ? courseTitle.slice(0, 37) + '...' : courseTitle,
    modules,
    totalHours,
  };
}

async function main(): Promise<void> {
  const coursesPath = path.resolve(process.cwd(), 'data/courses.json');
  const existing = JSON.parse(
    await fs.readFile(coursesPath, 'utf8'),
  ) as AvaCourse[];

  let targets: string[];
  if (ALL) {
    // Roda em todos os cursos cujo id é numérico (vindos do LD)
    targets = existing.filter((c) => /^\d+$/.test(c.id)).map((c) => c.id);
  } else if (courseIdsArg.length > 0) {
    targets = courseIdsArg;
  } else {
    console.error('Uso: npx tsx scripts/fix_courses.ts <id> [id...] | --all [--dry-run]');
    process.exit(1);
  }

  log(`alvo: ${targets.length} curso(s)`);
  log(`dry-run: ${DRY_RUN ? 'sim' : 'NÃO (vai gravar)'}`);

  let okCount = 0;
  let failCount = 0;
  for (const id of targets) {
    try {
      const updated = await fixCourse(id, existing);
      if (!updated) {
        failCount += 1;
        continue;
      }
      const idx = existing.findIndex((c) => c.id === id);
      if (idx === -1) existing.push(updated);
      else existing[idx] = updated;
      okCount += 1;
    } catch (e) {
      log(`  ⚠ falha em ${id}: ${(e as Error).message}`);
      failCount += 1;
    }
  }

  log(`==== resumo: ${okCount} ok / ${failCount} falhas`);

  if (DRY_RUN) {
    log('DRY_RUN — não grava');
    return;
  }
  if (okCount === 0) {
    log('Nada a gravar.');
    return;
  }
  await fs.writeFile(coursesPath, JSON.stringify(existing, null, 2), 'utf8');
  log(`courses.json atualizado (${okCount} curso(s) substituído(s))`);
}

main().catch((err) => {
  console.error('[fix-courses] erro fatal:', err);
  process.exit(1);
});

/**
 * Scrape autenticado das páginas de aula do portalpco.online para extrair:
 *   - videoUrl: iframes YouTube/Vimeo/Spotify/SoundCloud (Elementor widgets)
 *   - content: texto/HTML dos widgets Elementor que não vêm via REST API
 *
 * Login HTTP via cookie de sessão (user precisa estar matriculado nos cursos).
 *
 * Para cada lesson em data/courses.json com link no portal LD original:
 *   1. Fetch página com cookie
 *   2. Limpa wrappers LD/Elementor
 *   3. Extrai mídia + texto
 *   4. Atualiza videoUrl/content da lesson SE não tinha antes
 *
 * Não sobrescreve content/videoUrl já existentes (preserva re-imports anteriores).
 *
 * Uso:
 *   WP_PASS=xxx npx tsx scripts/scrape_lesson_media.ts [--course=<id>] [--dry-run] [--limit=N]
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

const PORTAL_URL = 'https://portalpco.online';
const PORTAL_USER = 'claude';
const PORTAL_PASS = process.env.WP_PASS ?? '';

if (!PORTAL_PASS) {
  console.error('ERRO: setar WP_PASS=<senha do user claude>');
  process.exit(1);
}

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes('--dry-run');
const COURSE_FILTER = argv.find((a) => a.startsWith('--course='))?.slice(9);
const LIMIT = Number(argv.find((a) => a.startsWith('--limit='))?.slice(8) ?? 0);

const log = (m: string) => console.log(`[scrape] ${m}`);

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
  modules: AvaModule[];
  [k: string]: unknown;
}

// ---------- Helpers ----------

function normalizeVideoEmbed(src: string): string {
  const decoded = src.replace(/&amp;/g, '&');
  const ytWatch = decoded.match(/youtube\.com\/watch\?v=([\w-]{11})/);
  if (ytWatch) return `https://www.youtube.com/embed/${ytWatch[1]}`;
  const ytShort = decoded.match(/youtu\.be\/([\w-]{11})/);
  if (ytShort) return `https://www.youtube.com/embed/${ytShort[1]}`;
  const ytEmbed = decoded.match(/youtube(-nocookie)?\.com\/embed\/([\w-]{11})/);
  if (ytEmbed) return `https://www.youtube.com/embed/${ytEmbed[2]}`;
  const vimeoPlayer = decoded.match(/player\.vimeo\.com\/video\/(\d+)/);
  if (vimeoPlayer) return `https://player.vimeo.com/video/${vimeoPlayer[1]}`;
  const vimeo = decoded.match(/^(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  const spotify = decoded.match(/open\.spotify\.com\/embed\/[\w-]+\/[\w-]+/);
  if (spotify) return decoded;
  const soundcloud = decoded.match(/w\.soundcloud\.com\/player/);
  if (soundcloud) return decoded;
  return decoded;
}

function isMediaEmbed(url: string): boolean {
  return /youtube|youtu\.be|vimeo|spotify|soundcloud/i.test(url);
}

function extractVideoFromHtml(html: string): string | null {
  // 1. Iframes
  const iframes = [...html.matchAll(/<iframe[^>]+src=["']([^"']+)["']/gi)];
  for (const m of iframes) {
    const src = m[1] ?? '';
    if (isMediaEmbed(src)) return normalizeVideoEmbed(src);
  }
  // 2. data-src de lazy load
  const dataSrcs = [...html.matchAll(/data-src=["']([^"']+)["']/gi)];
  for (const m of dataSrcs) {
    const src = m[1] ?? '';
    if (isMediaEmbed(src)) return normalizeVideoEmbed(src);
  }
  // 3. URLs soltas em widgets de vídeo
  const yt = html.match(
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/,
  );
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = html.match(/(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}

function extractTextFromElementor(html: string): string {
  // Pega tudo dentro de divs com classe elementor-widget-text-editor / elementor-widget-heading
  const blocks: string[] = [];
  const widgetRe =
    /<div[^>]*elementor-widget-(?:text-editor|heading|html|raw-html)[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
  let m: RegExpExecArray | null;
  while ((m = widgetRe.exec(html))) {
    blocks.push(m[1] ?? '');
  }
  return blocks.join('\n\n');
}

function cleanContentSnippet(html: string): string {
  // Pega tudo dentro do main <article> (LD usa) ou de .elementor-section principal
  // Remove navigation, breadcrumbs, status, sidebar
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  let content = articleMatch ? articleMatch[1] ?? '' : html;

  content = content
    // Remove o wrapper LD inteiro até o conteúdo Elementor
    .replace(/<nav[^>]*ld-breadcrumbs[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<div[^>]*ld-progress[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi, '')
    .replace(/<div[^>]*ld-status[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<div[^>]*ld-topic-actions[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<div[^>]*ld-topic-status[^>]*>[\s\S]*?<\/div>\s*<\/div>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  return content.trim();
}

// ---------- Login ----------

async function login(): Promise<string> {
  const initResp = await fetch(`${PORTAL_URL}/wp-login.php`, { redirect: 'manual' });
  const initCookies =
    (initResp.headers.getSetCookie?.() ?? [])
      .map((c) => c.split(';')[0])
      .join('; ') + '; wordpress_test_cookie=WP%20Cookie%20check';

  const form = new URLSearchParams({
    log: PORTAL_USER,
    pwd: PORTAL_PASS,
    'wp-submit': 'Acessar',
    redirect_to: `${PORTAL_URL}/wp-admin/`,
    testcookie: '1',
  });
  const resp = await fetch(`${PORTAL_URL}/wp-login.php`, {
    method: 'POST',
    body: form,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: initCookies,
      'User-Agent': 'Mozilla/5.0',
    },
    redirect: 'manual',
  });
  const cookies = (resp.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]);
  const logged = cookies.find((c) => c.startsWith('wordpress_logged_in'));
  if (!logged) {
    const body = await resp.text();
    const err = body.match(/id=["']login_error["'][^>]*>([\s\S]*?)<\/div>/);
    throw new Error(
      `Login falhou: ${err ? err[1]?.replace(/<[^>]+>/g, '').trim().slice(0, 150) : 'desconhecido'}`,
    );
  }
  return cookies.join('; ');
}

// ---------- Course slug map ----------

// Resolve topicId → URL pública via /?p=<id> (301 redirect → URL com slugs).
// Funciona sem precisar de matrícula (LD só protege o body, não a URL).
async function resolveTopicUrl(topicId: string): Promise<string | null> {
  const r = await fetch(`${PORTAL_URL}/?p=${topicId}`, {
    redirect: 'manual',
  });
  if (r.status >= 300 && r.status < 400) {
    const loc = r.headers.get('location');
    return loc ?? null;
  }
  return null;
}

async function buildLessonUrlMap(
  courses: AvaCourse[],
): Promise<Map<string, string>> {
  const topicIds: string[] = [];
  const lessonByTopicId = new Map<string, string>();
  for (const c of courses) {
    for (const m of c.modules ?? []) {
      for (const l of m.lessons ?? []) {
        const match = l.id.match(/^lesson-\d+-(\d+)$/);
        if (!match) continue;
        const topicId = match[1]!;
        topicIds.push(topicId);
        lessonByTopicId.set(topicId, l.id);
      }
    }
  }
  const map = new Map<string, string>();
  let resolved = 0;
  await runLimited(topicIds, 8, async (topicId) => {
    const url = await resolveTopicUrl(topicId);
    if (url) {
      map.set(lessonByTopicId.get(topicId)!, url);
      resolved++;
    }
    if (resolved % 100 === 0 && resolved > 0) {
      log(`  ...resolvidos ${resolved} URLs`);
    }
  });
  return map;
}

// ---------- Scrape ----------

async function scrapeLesson(
  lessonId: string,
  url: string,
  cookies: string,
): Promise<{ videoUrl?: string; content?: string }> {
  const r = await fetch(url, {
    headers: { Cookie: cookies, 'User-Agent': 'Mozilla/5.0' },
  });
  if (!r.ok) {
    throw new Error(`HTTP ${r.status}`);
  }
  const html = await r.text();
  const videoUrl = extractVideoFromHtml(html) ?? undefined;
  const textFromElementor = extractTextFromElementor(html);
  const content =
    textFromElementor.length > 30
      ? cleanContentSnippet(textFromElementor)
      : undefined;
  return { videoUrl, content };
}

async function runLimited<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, idx: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  async function worker(): Promise<void> {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]!, idx);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return out;
}

// ---------- Main ----------

async function main(): Promise<void> {
  const coursesPath = path.resolve(process.cwd(), 'data/courses.json');
  const courses = JSON.parse(
    await fs.readFile(coursesPath, 'utf8'),
  ) as AvaCourse[];

  log('autenticando...');
  const cookies = await login();
  log('✓ login OK');

  log('montando mapa de URLs...');
  const urlMap = await buildLessonUrlMap(courses);
  log(`  ${urlMap.size} URLs mapeadas`);

  // Junta lista de aulas a processar
  const targets: { lesson: AvaLesson; url: string }[] = [];
  for (const c of courses) {
    if (COURSE_FILTER && c.id !== COURSE_FILTER) continue;
    for (const m of c.modules ?? []) {
      for (const l of m.lessons ?? []) {
        if (l.videoUrl && l.content) continue; // já tem ambos
        const url = urlMap.get(l.id);
        if (!url) continue;
        targets.push({ lesson: l, url });
      }
    }
  }
  log(`alvo: ${targets.length} aulas`);
  const limited = LIMIT > 0 ? targets.slice(0, LIMIT) : targets;
  log(`processando: ${limited.length}`);

  let okCount = 0;
  let videoAdded = 0;
  let contentAdded = 0;
  let failed = 0;
  let processed = 0;

  await runLimited(limited, 4, async ({ lesson, url }) => {
    try {
      const result = await scrapeLesson(lesson.id, url, cookies);
      if (result.videoUrl && !lesson.videoUrl) {
        lesson.videoUrl = result.videoUrl;
        videoAdded++;
      }
      if (result.content && !lesson.content) {
        lesson.content = result.content;
        contentAdded++;
      }
      okCount++;
    } catch (e) {
      failed++;
      if (failed <= 5) log(`  ⚠ ${lesson.id}: ${(e as Error).message}`);
    }
    processed++;
    if (processed % 25 === 0) {
      log(
        `  ${processed}/${limited.length} (vídeos: +${videoAdded}, textos: +${contentAdded}, falhas: ${failed})`,
      );
    }
  });

  log(
    `==== ${okCount} ok / ${failed} falhas | +${videoAdded} vídeos | +${contentAdded} textos`,
  );

  if (DRY_RUN) {
    log('DRY_RUN — não grava');
    return;
  }
  if (videoAdded === 0 && contentAdded === 0) {
    log('Nada novo a gravar.');
    return;
  }
  await fs.writeFile(coursesPath, JSON.stringify(courses, null, 2), 'utf8');
  log(`courses.json atualizado`);
}

main().catch((err) => {
  console.error('[scrape] erro fatal:', err);
  process.exit(1);
});

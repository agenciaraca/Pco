/**
 * Importa secundários da migração WP/LD/WC v3:
 * - Posts (publish) dos dois sites → data/news.json (NewsArticle válido)
 * - Questões LD com conteúdo → data/question-bank-stubs.json (sem answers
 *   porque REST não expõe — futuro: extrair via SQL/plugin)
 *
 * Cupom WC: psi tem 0 cupons no momento — pulado.
 *
 * Uso: npx tsx scripts/import_secondaries.ts
 */

import { config as loadEnv } from 'dotenv';
import { promises as fs } from 'node:fs';
import path from 'node:path';

loadEnv({ path: '.env.import' });

const PORTAL = process.env.PORTAL_PCO_URL!;
const PORTAL_AUTH =
  'Basic ' +
  Buffer.from(
    `${process.env.PORTAL_PCO_USER}:${process.env.PORTAL_PCO_APP_PASSWORD}`,
  ).toString('base64');
const PSI = process.env.PSICANALISE_URL!;
const PSI_AUTH =
  'Basic ' +
  Buffer.from(
    `${process.env.PSICANALISE_USER}:${process.env.PSICANALISE_APP_PASSWORD}`,
  ).toString('base64');

const DATA = path.resolve(process.cwd(), 'data');
const log = (m: string) => console.log(`[secondaries] ${m}`);

interface WpPost {
  id: number;
  date: string;
  slug: string;
  status: string;
  title: { rendered: string; raw?: string };
  content: { rendered: string; raw?: string };
  excerpt: { rendered: string; raw?: string };
  author: number;
  categories: number[];
  tags: number[];
  featured_media: number;
}

interface WpCategory {
  id: number;
  name: string;
  slug: string;
}

interface WpUser {
  id: number;
  name: string;
}

interface NewsArticle {
  id: string;
  title: string;
  excerpt: string;
  body?: string;
  category: string;
  tags: string[];
  coverColor: string;
  authorName: string;
  publishedAt: string;
  featured?: boolean;
  relatedCourseIds?: string[];
}

// Paleta PCO pra coverColor
const COVER_COLORS = ['#0097B2', '#0CC0DF', '#5CE1E6', '#FE9002', '#063B49'];

function pickColor(n: number): string {
  return COVER_COLORS[n % COVER_COLORS.length]!;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .trim();
}

async function fetchPaged<T>(
  base: string,
  pathSuffix: string,
  auth: string,
): Promise<T[]> {
  const out: T[] = [];
  let page = 1;
  while (true) {
    const url = `${base}/wp-json${pathSuffix}${pathSuffix.includes('?') ? '&' : '?'}page=${page}&per_page=100`;
    const r = await fetch(url, {
      headers: { Authorization: auth, Accept: 'application/json' },
    });
    if (!r.ok) break;
    const data = (await r.json()) as T[];
    if (!Array.isArray(data) || data.length === 0) break;
    out.push(...data);
    const totalPages = Number(r.headers.get('x-wp-totalpages') ?? 1);
    if (page >= totalPages) break;
    page += 1;
  }
  return out;
}

async function fetchCategories(
  base: string,
  auth: string,
): Promise<Map<number, string>> {
  const cats = await fetchPaged<WpCategory>(base, '/wp/v2/categories', auth);
  return new Map(cats.map((c) => [c.id, c.name]));
}

async function fetchAuthors(
  base: string,
  auth: string,
  ids: number[],
): Promise<Map<number, string>> {
  const uniq = Array.from(new Set(ids));
  const out = new Map<number, string>();
  for (const id of uniq) {
    if (id === 0) continue;
    try {
      const r = await fetch(
        `${base}/wp-json/wp/v2/users/${id}?context=edit`,
        { headers: { Authorization: auth, Accept: 'application/json' } },
      );
      if (r.ok) {
        const u = (await r.json()) as WpUser;
        out.set(id, u.name || `User ${id}`);
      }
    } catch {
      // ignore
    }
  }
  return out;
}

async function importPosts(): Promise<NewsArticle[]> {
  const articles: NewsArticle[] = [];
  const sources: Array<{
    label: string;
    base: string;
    auth: string;
    sourcePrefix: string;
  }> = [
    { label: 'portal', base: PORTAL, auth: PORTAL_AUTH, sourcePrefix: 'portal' },
    { label: 'psi', base: PSI, auth: PSI_AUTH, sourcePrefix: 'psi' },
  ];

  for (const src of sources) {
    log(`buscando posts publish do ${src.label}...`);
    const posts = await fetchPaged<WpPost>(
      src.base,
      '/wp/v2/posts?context=edit&status=publish',
      src.auth,
    );
    log(`  ${posts.length} posts em ${src.label}`);

    const cats = await fetchCategories(src.base, src.auth);
    const authorIds = posts.map((p) => p.author);
    const authors = await fetchAuthors(src.base, src.auth, authorIds);

    for (const [i, p] of posts.entries()) {
      const title = stripHtml(p.title.raw ?? p.title.rendered ?? '');
      const body = p.content.raw ?? p.content.rendered ?? '';
      const excerpt = stripHtml(p.excerpt.raw ?? p.excerpt.rendered ?? '')
        .slice(0, 280)
        .trim();
      const category =
        p.categories.length > 0 ? cats.get(p.categories[0]!) || 'Geral' : 'Geral';
      const authorName = authors.get(p.author) || 'Equipe PCO';
      articles.push({
        id: `n-${src.sourcePrefix}-${p.id}`,
        title: title || `Post ${p.id}`,
        excerpt: excerpt || title.slice(0, 280),
        body,
        category,
        tags: [],
        coverColor: pickColor(i),
        authorName,
        publishedAt: p.date,
        featured: false,
        relatedCourseIds: [],
      });
    }
  }
  return articles;
}

interface QuestionStub {
  id: string;
  ldQuestionId: number;
  quizExternalId: number;
  type: string;
  title: string;
  promptHtml: string;
  promptText: string;
  pointsTotal: number;
  correctMessage: string;
  incorrectMessage: string;
  hasAnswers: false;
  reason: string;
}

interface LdQuestionDetail {
  id: number;
  title: { raw?: string; rendered?: string };
  content: { raw?: string; rendered?: string };
  question_type: string;
  quiz: number;
  points_total: number;
  correct_message: string;
  incorrect_message: string;
}

async function importQuestionStubs(): Promise<QuestionStub[]> {
  log('listando todas as questões LD do portal...');
  const list = await fetchPaged<{ id: number }>(
    PORTAL,
    '/ldlms/v2/sfwd-question?context=edit',
    PORTAL_AUTH,
  );
  log(`  ${list.length} questões na lista`);

  const stubs: QuestionStub[] = [];
  let skipped = 0;
  for (const [i, q] of list.entries()) {
    try {
      const r = await fetch(
        `${PORTAL}/wp-json/ldlms/v2/sfwd-question/${q.id}?context=edit`,
        { headers: { Authorization: PORTAL_AUTH, Accept: 'application/json' } },
      );
      if (!r.ok) {
        skipped += 1;
        continue;
      }
      const d = (await r.json()) as LdQuestionDetail;
      const promptHtml = d.content.raw ?? d.content.rendered ?? '';
      const promptText = stripHtml(promptHtml);
      if (!promptText || promptText.length < 5) {
        skipped += 1;
        continue;
      }
      stubs.push({
        id: `qstub-${q.id}`,
        ldQuestionId: q.id,
        quizExternalId: d.quiz ?? 0,
        type: d.question_type ?? 'unknown',
        title: stripHtml(d.title.raw ?? d.title.rendered ?? ''),
        promptHtml,
        promptText,
        pointsTotal: d.points_total ?? 0,
        correctMessage: d.correct_message ?? '',
        incorrectMessage: d.incorrect_message ?? '',
        hasAnswers: false,
        reason:
          'REST API não expõe options/answers (postmeta _question_pro_settings). Importação completa exige acesso DB direto ou plugin LD-export.',
      });
    } catch {
      skipped += 1;
    }
    if ((i + 1) % 25 === 0) log(`  ${i + 1}/${list.length} questões processadas...`);
  }
  log(`  ${stubs.length} stubs com conteúdo · ${skipped} skipped (vazias/erros)`);
  return stubs;
}

async function main(): Promise<void> {
  log('==== início ====');

  const articles = await importPosts();
  await fs.writeFile(
    path.join(DATA, 'news.json'),
    JSON.stringify(articles, null, 2),
    'utf8',
  );
  log(`news.json: ${articles.length} artigos persistidos`);

  const stubs = await importQuestionStubs();
  await fs.writeFile(
    path.join(DATA, 'question-bank-stubs.json'),
    JSON.stringify(stubs, null, 2),
    'utf8',
  );
  log(`question-bank-stubs.json: ${stubs.length} stubs (sem answers — TODO)`);

  log('cupom WC: 0 cupons existem no psi, nada a importar.');

  log('==== fim ====');
}

main().catch((err) => {
  console.error('[secondaries] erro:', err);
  process.exit(1);
});

/**
 * Carrega os posts de data/news.json no Postgres de produção (DivZ).
 *
 * A tabela `news_articles` existe no schema Drizzle mas nunca foi criada/populada
 * no DivZ (news só vivia no JsonStore). Em modo DB isso quebra /blog (público) e
 * /news (logado). Este loader é ADITIVO e idempotente:
 *   1. CREATE TABLE IF NOT EXISTS news_articles (igual ao schema)
 *   2. INSERT ... ON CONFLICT (id) DO NOTHING
 *
 * Uso:
 *   DATABASE_URL=... npx tsx scripts/load_news_to_divz.ts           # DRY-RUN
 *   DATABASE_URL=... npx tsx scripts/load_news_to_divz.ts --commit  # grava
 *
 * DivZ usa cert self-signed → ssl.rejectUnauthorized=false. NÃO passe sslmode na
 * URL (o pg novo trata 'require' como verify-full e barra o cert).
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const COMMIT = process.argv.includes('--commit');
const DB_URL = process.env.DATABASE_URL;
const log = (m: string) => console.log(`[load-news] ${m}`);

if (!DB_URL) {
  console.error('ERRO: defina DATABASE_URL.');
  process.exit(1);
}

interface JsonPost {
  id: string;
  title: string;
  excerpt?: string;
  body?: string;
  category?: string;
  tags?: string[];
  coverColor?: string;
  authorName?: string;
  publishedAt?: string;
  featured?: boolean;
  relatedCourseIds?: string[];
}

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS news_articles (
  id text PRIMARY KEY,
  title text NOT NULL,
  excerpt text NOT NULL,
  body text,
  category text NOT NULL,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  cover_color text NOT NULL,
  author_name text NOT NULL,
  published_at text NOT NULL,
  featured boolean NOT NULL DEFAULT false,
  related_course_ids jsonb NOT NULL DEFAULT '[]'::jsonb
);`;

async function main(): Promise<void> {
  log(`modo: ${COMMIT ? '*** COMMIT ***' : 'DRY-RUN'}`);
  const raw = await fs.readFile(path.resolve(process.cwd(), 'data', 'news.json'), 'utf8');
  const posts: JsonPost[] = JSON.parse(raw);
  log(`fonte: ${posts.length} posts em news.json`);

  const client = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(CREATE_SQL);
    const before = (await client.query('select count(*)::int n from news_articles')).rows[0].n;
    log(`ANTES → ${before} posts na tabela`);

    let ins = 0;
    for (const p of posts) {
      const res = await client.query(
        `INSERT INTO news_articles
           (id, title, excerpt, body, category, tags, cover_color, author_name, published_at, featured, related_course_ids)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11::jsonb)
         ON CONFLICT (id) DO NOTHING`,
        [
          p.id,
          p.title ?? 'Sem título',
          p.excerpt ?? p.title ?? '',
          p.body ?? null,
          p.category ?? 'Geral',
          JSON.stringify(Array.isArray(p.tags) ? p.tags : []),
          p.coverColor ?? '#0f6e66',
          p.authorName ?? 'Equipe PCO',
          p.publishedAt ?? new Date().toISOString(),
          Boolean(p.featured),
          JSON.stringify(Array.isArray(p.relatedCourseIds) ? p.relatedCourseIds : []),
        ],
      );
      ins += res.rowCount ?? 0;
    }
    const after = (await client.query('select count(*)::int n from news_articles')).rows[0].n;
    log(`inseridos: +${ins} (pulados por id existente: ${posts.length - ins})`);
    log(`DEPOIS → ${after} posts`);

    if (COMMIT) {
      await client.query('COMMIT');
      log('*** COMMIT — news_articles populada. ***');
    } else {
      await client.query('ROLLBACK');
      log('DRY-RUN → ROLLBACK. Rode com --commit para aplicar.');
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[load-news] ERRO — rollback:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();

import { desc } from 'drizzle-orm';
import { getDb, schema } from '../db/client';
import { newsArticles as seed } from '../../src/app/data/seed';
import type { NewsArticle } from '../../src/app/types/schema';

export async function listNews(): Promise<NewsArticle[]> {
  const db = getDb();
  if (!db) return seed;
  const rows = await db
    .select()
    .from(schema.newsArticles)
    .orderBy(desc(schema.newsArticles.publishedAt));
  if (rows.length === 0) return seed;
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    excerpt: r.excerpt,
    body: r.body ?? undefined,
    category: r.category,
    tags: r.tags ?? [],
    coverColor: r.coverColor,
    authorName: r.authorName,
    publishedAt: r.publishedAt,
    featured: r.featured,
    relatedCourseIds: r.relatedCourseIds ?? [],
  }));
}

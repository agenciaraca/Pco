import { eq, desc } from 'drizzle-orm';
import { getDb, schema } from '../db/client';
import { JsonStore } from '../db/json-store';
import { newsArticles as defaults } from '../../src/app/data/seed';
import type { NewsArticle } from '../../src/app/types/schema';
import type { CreateNewsInput, UpdateNewsInput } from '../../shared/schemas';

const store = new JsonStore<NewsArticle>('news.json', () =>
  defaults.map((d) => ({
    ...d,
    tags: [...d.tags],
    relatedCourseIds: [...(d.relatedCourseIds ?? [])],
  })),
);

function rowToArticle(r: typeof schema.newsArticles.$inferSelect): NewsArticle {
  return {
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
  };
}

function newId() {
  return `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function listNews(): Promise<NewsArticle[]> {
  const db = getDb();
  if (!db) return await store.getAll();
  const rows = await db
    .select()
    .from(schema.newsArticles)
    .orderBy(desc(schema.newsArticles.publishedAt));
  if (rows.length === 0) return await store.getAll();
  return rows.map(rowToArticle);
}

export async function findNews(id: string): Promise<NewsArticle | null> {
  const db = getDb();
  if (!db) return await store.findOne((n) => n.id === id);
  const rows = await db
    .select()
    .from(schema.newsArticles)
    .where(eq(schema.newsArticles.id, id));
  if (rows.length === 0) return await store.findOne((n) => n.id === id);
  return rowToArticle(rows[0]);
}

export async function createNews(input: CreateNewsInput): Promise<NewsArticle> {
  const id = newId();
  const article: NewsArticle = {
    id,
    title: input.title,
    excerpt: input.excerpt,
    body: input.body,
    category: input.category,
    tags: input.tags,
    coverColor: input.coverColor,
    authorName: input.authorName,
    publishedAt: input.publishedAt,
    featured: input.featured,
    relatedCourseIds: input.relatedCourseIds,
  };

  const db = getDb();
  if (!db) return await store.unshift(article);

  await db.insert(schema.newsArticles).values({
    id,
    title: article.title,
    excerpt: article.excerpt,
    body: article.body ?? null,
    category: article.category,
    tags: article.tags,
    coverColor: article.coverColor,
    authorName: article.authorName,
    publishedAt: article.publishedAt,
    featured: article.featured ?? false,
    relatedCourseIds: article.relatedCourseIds ?? [],
  });
  return article;
}

export async function updateNews(
  id: string,
  patch: UpdateNewsInput,
): Promise<NewsArticle | null> {
  const db = getDb();
  if (!db) {
    return await store.update(
      (n) => n.id === id,
      (n) => ({ ...n, ...patch }) as NewsArticle,
    );
  }

  const update: Partial<typeof schema.newsArticles.$inferInsert> = {};
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.excerpt !== undefined) update.excerpt = patch.excerpt;
  if (patch.body !== undefined) update.body = patch.body;
  if (patch.category !== undefined) update.category = patch.category;
  if (patch.tags !== undefined) update.tags = patch.tags;
  if (patch.coverColor !== undefined) update.coverColor = patch.coverColor;
  if (patch.authorName !== undefined) update.authorName = patch.authorName;
  if (patch.publishedAt !== undefined) update.publishedAt = patch.publishedAt;
  if (patch.featured !== undefined) update.featured = patch.featured;
  if (patch.relatedCourseIds !== undefined) update.relatedCourseIds = patch.relatedCourseIds;

  if (Object.keys(update).length === 0) return await findNews(id);

  const rows = await db
    .update(schema.newsArticles)
    .set(update)
    .where(eq(schema.newsArticles.id, id))
    .returning();
  return rows[0] ? rowToArticle(rows[0]) : null;
}

export async function deleteNews(id: string): Promise<boolean> {
  const db = getDb();
  if (!db) return await store.remove((n) => n.id === id);
  const rows = await db
    .delete(schema.newsArticles)
    .where(eq(schema.newsArticles.id, id))
    .returning({ id: schema.newsArticles.id });
  return rows.length > 0;
}

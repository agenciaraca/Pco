import { eq, desc } from 'drizzle-orm';
import { getDb, schema } from '../db/client';
import { podcasts as seed } from '../../src/app/data/seed';
import type { PodcastEpisode } from '../../src/app/types/schema';

function rowToEpisode(r: typeof schema.podcasts.$inferSelect): PodcastEpisode {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    durationMinutes: r.durationMinutes,
    publishedAt: r.publishedAt,
    coverColor: r.coverColor,
    audioUrl: r.audioUrl ?? undefined,
    relatedCourseIds: r.relatedCourseIds ?? [],
    relatedModuleIds: r.relatedModuleIds ?? [],
  };
}

export async function listPodcasts(): Promise<PodcastEpisode[]> {
  const db = getDb();
  if (!db) return seed;
  const rows = await db
    .select()
    .from(schema.podcasts)
    .orderBy(desc(schema.podcasts.publishedAt));
  if (rows.length === 0) return seed;
  return rows.map(rowToEpisode);
}

export async function findPodcast(id: string): Promise<PodcastEpisode | null> {
  const db = getDb();
  if (!db) return seed.find((p) => p.id === id) ?? null;
  const rows = await db.select().from(schema.podcasts).where(eq(schema.podcasts.id, id));
  if (rows.length === 0) {
    const fromSeed = seed.find((p) => p.id === id);
    return fromSeed ?? null;
  }
  return rowToEpisode(rows[0]);
}

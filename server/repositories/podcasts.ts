import { eq, desc } from 'drizzle-orm';
import { getDb, schema } from '../db/client';
import { JsonStore } from '../db/json-store';
import { podcasts as defaults } from '../../src/app/data/seed';
import type { PodcastEpisode } from '../../src/app/types/schema';
import type { CreatePodcastInput, UpdatePodcastInput } from '../../shared/schemas';

const store = new JsonStore<PodcastEpisode>('podcasts.json', () =>
  defaults.map((d) => ({
    ...d,
    relatedCourseIds: [...(d.relatedCourseIds ?? [])],
    relatedModuleIds: [...(d.relatedModuleIds ?? [])],
  })),
);

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
    tags: (r as { tags?: string[] }).tags,
  };
}

function newId() {
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function listPodcasts(): Promise<PodcastEpisode[]> {
  const db = getDb();
  if (!db) return await store.getAll();
  const rows = await db
    .select()
    .from(schema.podcasts)
    .orderBy(desc(schema.podcasts.publishedAt));
  if (rows.length === 0) return await store.getAll();
  return rows.map(rowToEpisode);
}

export async function findPodcast(id: string): Promise<PodcastEpisode | null> {
  const db = getDb();
  if (!db) return await store.findOne((p) => p.id === id);
  const rows = await db.select().from(schema.podcasts).where(eq(schema.podcasts.id, id));
  if (rows.length === 0) return await store.findOne((p) => p.id === id);
  return rowToEpisode(rows[0]);
}

export async function createPodcast(input: CreatePodcastInput): Promise<PodcastEpisode> {
  const id = newId();
  const ep: PodcastEpisode = {
    id,
    title: input.title,
    description: input.description,
    durationMinutes: input.durationMinutes,
    publishedAt: input.publishedAt,
    coverColor: input.coverColor,
    audioUrl: input.audioUrl || undefined,
    relatedCourseIds: input.relatedCourseIds,
    relatedModuleIds: input.relatedModuleIds,
    tags: input.tags,
  };

  const db = getDb();
  if (!db) return await store.unshift(ep);

  await db.insert(schema.podcasts).values({
    id,
    title: ep.title,
    description: ep.description,
    durationMinutes: ep.durationMinutes,
    publishedAt: ep.publishedAt,
    coverColor: ep.coverColor,
    audioUrl: ep.audioUrl ?? null,
    relatedCourseIds: ep.relatedCourseIds ?? [],
    relatedModuleIds: ep.relatedModuleIds ?? [],
  });
  return ep;
}

export async function updatePodcast(
  id: string,
  patch: UpdatePodcastInput,
): Promise<PodcastEpisode | null> {
  const db = getDb();
  if (!db) {
    return await store.update(
      (p) => p.id === id,
      (p) => ({ ...p, ...patch }) as PodcastEpisode,
    );
  }

  const update: Partial<typeof schema.podcasts.$inferInsert> = {};
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.durationMinutes !== undefined) update.durationMinutes = patch.durationMinutes;
  if (patch.publishedAt !== undefined) update.publishedAt = patch.publishedAt;
  if (patch.coverColor !== undefined) update.coverColor = patch.coverColor;
  if (patch.audioUrl !== undefined) update.audioUrl = patch.audioUrl || null;
  if (patch.relatedCourseIds !== undefined) update.relatedCourseIds = patch.relatedCourseIds;
  if (patch.relatedModuleIds !== undefined) update.relatedModuleIds = patch.relatedModuleIds;

  if (Object.keys(update).length === 0) return await findPodcast(id);

  const rows = await db
    .update(schema.podcasts)
    .set(update)
    .where(eq(schema.podcasts.id, id))
    .returning();
  return rows[0] ? rowToEpisode(rows[0]) : null;
}

export async function deletePodcast(id: string): Promise<boolean> {
  const db = getDb();
  if (!db) return await store.remove((p) => p.id === id);
  const rows = await db
    .delete(schema.podcasts)
    .where(eq(schema.podcasts.id, id))
    .returning({ id: schema.podcasts.id });
  return rows.length > 0;
}

// Engagement do aluno com podcasts — listened/favorite por (userId, episodeId).

import { JsonStore } from '../db/json-store';

export interface PodcastEngagement {
  userId: string;
  episodeId: string;
  listened: boolean;
  favorite: boolean;
  updatedAt: string;
}

const store = new JsonStore<PodcastEngagement>('podcast-engagement.json', () => []);

export async function listForUser(userId: string): Promise<PodcastEngagement[]> {
  return await store.filter((e) => e.userId === userId);
}

export async function get(
  userId: string,
  episodeId: string,
): Promise<PodcastEngagement | null> {
  return await store.findOne((e) => e.userId === userId && e.episodeId === episodeId);
}

export async function upsert(
  userId: string,
  episodeId: string,
  patch: { listened?: boolean; favorite?: boolean },
): Promise<PodcastEngagement> {
  const now = new Date().toISOString();
  const existing = await get(userId, episodeId);
  if (existing) {
    return (await store.update(
      (e) => e.userId === userId && e.episodeId === episodeId,
      (e) => ({ ...e, ...patch, updatedAt: now }),
    ))!;
  }
  const entry: PodcastEngagement = {
    userId,
    episodeId,
    listened: patch.listened ?? false,
    favorite: patch.favorite ?? false,
    updatedAt: now,
  };
  await store.unshift(entry);
  return entry;
}

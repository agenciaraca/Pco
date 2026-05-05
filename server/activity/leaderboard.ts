// Leaderboard de alunos por engajamento — agrega lessonProgress dentro de
// uma janela temporal e ranqueia por aulas concluídas. Inclui distinct active
// days como proxy de "streak".

import * as progressRepo from '../repositories/progress';
import * as usersStore from '../auth/users-store';
import * as achievementsStore from '../achievements/store';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  userEmail: string;
  lessonsCompleted: number;
  activeDays: number;
  achievements: number;
  score: number; // ranking weight
}

export interface LeaderboardResult {
  range: { from: string; to: string; days: number };
  total: number;
  entries: LeaderboardEntry[];
}

/**
 * Computa score:
 *   lessons * 10 + activeDays * 5 + achievements * 2
 *
 * Pesos escolhidos pra valorizar consistência (activeDays) sem deixar quem
 * fez 50 aulas num dia disparar tanto. Achievements entram como tie-breaker.
 */
function computeScore(
  lessons: number,
  activeDays: number,
  achievements: number,
): number {
  return lessons * 10 + activeDays * 5 + achievements * 2;
}

const DAY_MS = 24 * 60 * 60_000;

export async function buildLeaderboard(
  days = 30,
  limit = 20,
): Promise<LeaderboardResult> {
  const clampedDays = Math.max(1, Math.min(days, 365));
  const clampedLimit = Math.max(1, Math.min(limit, 200));
  const now = Date.now();
  const fromMs = now - clampedDays * DAY_MS;

  const allProgress = await progressRepo.listAll();
  const inWindow = allProgress.filter(
    (p) => new Date(p.completedAt).getTime() >= fromMs,
  );

  // Agrega por userId
  const byUser = new Map<
    string,
    { lessons: number; activeDays: Set<string> }
  >();
  for (const p of inWindow) {
    const cur = byUser.get(p.userId) ?? {
      lessons: 0,
      activeDays: new Set<string>(),
    };
    cur.lessons++;
    cur.activeDays.add(p.completedAt.slice(0, 10));
    byUser.set(p.userId, cur);
  }

  if (byUser.size === 0) {
    return {
      range: {
        from: new Date(fromMs).toISOString(),
        to: new Date(now).toISOString(),
        days: clampedDays,
      },
      total: 0,
      entries: [],
    };
  }

  // Lookup users + achievements em paralelo (cache simples)
  const users = await usersStore.listUsers();
  const userMap = new Map(users.map((u) => [u.id, u]));
  const allAchievements = await achievementsStore.listAll();
  const achievementsByUser = new Map<string, number>();
  for (const a of allAchievements) {
    achievementsByUser.set(a.userId, (achievementsByUser.get(a.userId) ?? 0) + 1);
  }

  const entries: LeaderboardEntry[] = [];
  for (const [userId, agg] of byUser.entries()) {
    const user = userMap.get(userId);
    if (!user) continue;
    if (user.role !== 'student') continue;
    const achievements = achievementsByUser.get(userId) ?? 0;
    const activeDays = agg.activeDays.size;
    entries.push({
      rank: 0, // preenchido depois
      userId,
      userName: user.name,
      userEmail: user.email,
      lessonsCompleted: agg.lessons,
      activeDays,
      achievements,
      score: computeScore(agg.lessons, activeDays, achievements),
    });
  }

  entries.sort((a, b) => b.score - a.score);
  for (let i = 0; i < entries.length; i++) {
    entries[i]!.rank = i + 1;
  }

  return {
    range: {
      from: new Date(fromMs).toISOString(),
      to: new Date(now).toISOString(),
      days: clampedDays,
    },
    total: entries.length,
    entries: entries.slice(0, clampedLimit),
  };
}

/**
 * Posição do user específico no leaderboard global do período (sem cap de limit).
 */
export async function getUserRank(
  userId: string,
  days = 30,
): Promise<{
  rank: number;
  total: number;
  entry?: LeaderboardEntry;
}> {
  const r = await buildLeaderboard(days, 9999);
  const idx = r.entries.findIndex((e) => e.userId === userId);
  if (idx < 0) return { rank: 0, total: r.total };
  return { rank: idx + 1, total: r.total, entry: r.entries[idx] };
}

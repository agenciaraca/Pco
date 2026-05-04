// Histórico de conversas com Tutor — persiste em data/tutor-history.json.
// Formato: array de turnos, cada turno tem userId, prompt, response, ts.

import crypto from 'node:crypto';
import { JsonStore } from '../db/json-store';

export interface TutorTurn {
  id: string;
  userId: string;
  prompt: string;
  response: string;
  provider: string | null;
  model: string | null;
  ts: string;
}

const MAX_PER_USER = 200; // cap por usuário pra evitar crescimento descontrolado
const store = new JsonStore<TutorTurn>('tutor-history.json', () => []);

function newId(): string {
  return `t-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

export async function recordTurn(input: Omit<TutorTurn, 'id' | 'ts'>): Promise<TutorTurn> {
  const turn: TutorTurn = {
    id: newId(),
    ts: new Date().toISOString(),
    ...input,
  };
  await store.unshift(turn);

  // Truncamento por user — mantém os mais recentes
  const all = await store.getAll();
  const userTurns = all.filter((t) => t.userId === turn.userId);
  if (userTurns.length > MAX_PER_USER) {
    const userIdsToRemove = userTurns.slice(MAX_PER_USER).map((t) => t.id);
    const remainders = all.filter((t) => !userIdsToRemove.includes(t.id));
    await store.setAll(remainders);
  }
  return turn;
}

export async function listAll(): Promise<TutorTurn[]> {
  return await store.getAll();
}

export interface TutorUsageStats {
  totalTurns: number;
  uniqueUsers: number;
  byDay: Array<{ day: string; count: number }>;
  topUsers: Array<{ userId: string; count: number }>;
}

export async function usageStats(days = 30): Promise<TutorUsageStats> {
  const all = await listAll();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const filtered = all.filter((t) => new Date(t.ts).getTime() >= cutoff);

  const byDayMap = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    byDayMap.set(d.toISOString().slice(0, 10), 0);
  }
  const byUser = new Map<string, number>();
  const userSet = new Set<string>();
  for (const t of filtered) {
    const day = t.ts.slice(0, 10);
    byDayMap.set(day, (byDayMap.get(day) ?? 0) + 1);
    byUser.set(t.userId, (byUser.get(t.userId) ?? 0) + 1);
    userSet.add(t.userId);
  }
  const topUsers = Array.from(byUser.entries())
    .map(([userId, count]) => ({ userId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  return {
    totalTurns: filtered.length,
    uniqueUsers: userSet.size,
    byDay: Array.from(byDayMap.entries()).map(([day, count]) => ({ day, count })),
    topUsers,
  };
}

export async function listForUser(userId: string, limit = 50): Promise<TutorTurn[]> {
  const all = await store.getAll();
  return all
    .filter((t) => t.userId === userId)
    .slice(0, Math.max(1, Math.min(limit, MAX_PER_USER)));
}

export async function clearForUser(userId: string): Promise<number> {
  const all = await store.getAll();
  const remaining = all.filter((t) => t.userId !== userId);
  const removed = all.length - remaining.length;
  if (removed > 0) await store.setAll(remaining);
  return removed;
}

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

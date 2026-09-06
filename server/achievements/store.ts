// Achievements / badges. Concedidos automaticamente pela engine quando
// alunos atingem marcos. Cada badge é único por (userId, badgeId).

import crypto from 'node:crypto';
import { JsonStore } from '../db/json-store';

export type BadgeId =
  | 'first_lesson'
  | 'first_course'
  | 'streak_7'
  | 'streak_30'
  | 'three_courses'
  | 'tutor_helper';

export interface BadgeDef {
  id: BadgeId;
  name: string;
  description: string;
  icon: string; // emoji
}

export const BADGES: Record<BadgeId, BadgeDef> = {
  first_lesson: {
    id: 'first_lesson',
    name: 'Primeira aula',
    description: 'Concluiu a primeira aula no AVA.',
    icon: '🎯',
  },
  first_course: {
    id: 'first_course',
    name: 'Primeiro curso',
    description: 'Concluiu integralmente o primeiro curso.',
    icon: '🎓',
  },
  streak_7: {
    id: 'streak_7',
    name: 'Sequência de 7 dias',
    description: 'Acessou o AVA por 7 dias consecutivos.',
    icon: '🔥',
  },
  streak_30: {
    id: 'streak_30',
    name: 'Sequência de 30 dias',
    description: 'Acessou o AVA por 30 dias consecutivos.',
    icon: '⚡',
  },
  three_courses: {
    id: 'three_courses',
    name: 'Trilha completa',
    description: 'Concluiu 3 cursos.',
    icon: '🏆',
  },
  tutor_helper: {
    id: 'tutor_helper',
    name: 'Conversa com o tutor',
    description: 'Conversou pelo menos 10 vezes com o Tutor.',
    icon: '🤖',
  },
};

export interface AwardedBadge {
  id: string;
  userId: string;
  badgeId: BadgeId;
  awardedAt: string;
  meta?: Record<string, unknown>;
}

const store = new JsonStore<AwardedBadge>('achievements.json', () => []);

function newId(): string {
  return `bdg-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

export async function listForUser(userId: string): Promise<AwardedBadge[]> {
  const all = await store.filter((b) => b.userId === userId);
  return [...all].sort((a, b) => (b.awardedAt > a.awardedAt ? 1 : -1));
}

export async function listAll(): Promise<AwardedBadge[]> {
  return await store.getAll();
}

export async function hasBadge(userId: string, badgeId: BadgeId): Promise<boolean> {
  return !!(await store.findOne(
    (b) => b.userId === userId && b.badgeId === badgeId,
  ));
}

export async function grant(
  userId: string,
  badgeId: BadgeId,
  meta?: Record<string, unknown>,
): Promise<AwardedBadge | null> {
  if (await hasBadge(userId, badgeId)) return null;
  const entry: AwardedBadge = {
    id: newId(),
    userId,
    badgeId,
    awardedAt: new Date().toISOString(),
    meta,
  };
  await store.unshift(entry);
  return entry;
}

/**
 * Apaga tudo desta pessoa. Usado pelo expurgo de dados (LGPD, art. 18, VI).
 *
 * Devolve quantos registros saíram — "0 apagados" é resposta diferente de
 * "não consegui", e o relatório do expurgo precisa distinguir as duas.
 */
export async function clearForUser(userId: string): Promise<number> {
  const all = await store.getAll();
  const remaining = all.filter((x) => x.userId !== userId);
  const removed = all.length - remaining.length;
  if (removed > 0) await store.setAll(remaining);
  return removed;
}

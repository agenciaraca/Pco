// In-app notifications — uma entry por destinatário (fan-out na criação).

import crypto from 'node:crypto';
import { JsonStore } from '../db/json-store';
import * as usersStore from '../auth/users-store';

export type NotificationCategory = 'info' | 'success' | 'warning' | 'danger' | 'announcement';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  category: NotificationCategory;
  link?: string;
  createdAt: string;
  readAt: string | null;
  authorEmail?: string | null;
}

const store = new JsonStore<Notification>('notifications.json', () => []);

function newId(): string {
  return `n-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

export async function listForUser(userId: string, limit = 100): Promise<Notification[]> {
  const all = await store.getAll();
  return all
    .filter((n) => n.userId === userId)
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))
    .slice(0, limit);
}

export async function unreadCountForUser(userId: string): Promise<number> {
  const all = await store.getAll();
  return all.filter((n) => n.userId === userId && !n.readAt).length;
}

export async function markRead(userId: string, id: string): Promise<boolean> {
  const updated = await store.update(
    (n) => n.id === id && n.userId === userId,
    (n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() }),
  );
  return updated !== null;
}

export async function markAllRead(userId: string): Promise<number> {
  const now = new Date().toISOString();
  return store.mutate(
    (n) => n.userId === userId && !n.readAt,
    (n) => {
      n.readAt = now;
    },
  );
}

interface CreateOneInput {
  userId: string;
  title: string;
  body: string;
  category?: NotificationCategory;
  link?: string;
  authorEmail?: string | null;
}

export async function createOne(input: CreateOneInput): Promise<Notification> {
  const entry: Notification = {
    id: newId(),
    userId: input.userId,
    title: input.title,
    body: input.body,
    category: input.category ?? 'info',
    link: input.link,
    createdAt: new Date().toISOString(),
    readAt: null,
    authorEmail: input.authorEmail ?? null,
  };
  return await store.unshift(entry);
}

interface BroadcastInput {
  audience: 'all' | 'students' | 'admins' | 'user';
  userId?: string; // requerido se audience === 'user'
  title: string;
  body: string;
  category?: NotificationCategory;
  link?: string;
  authorEmail?: string | null;
}

export async function broadcast(input: BroadcastInput): Promise<number> {
  const allUsers = await usersStore.listUsers();
  const targets = allUsers
    .filter((u) => u.active)
    .filter((u) => {
      if (input.audience === 'all') return true;
      if (input.audience === 'students') return u.role === 'student';
      if (input.audience === 'admins') return u.role === 'admin' || u.role === 'superadmin';
      if (input.audience === 'user') return u.id === input.userId;
      return false;
    });
  if (input.audience === 'user' && targets.length === 0) return 0;
  for (const t of targets) {
    await createOne({
      userId: t.id,
      title: input.title,
      body: input.body,
      category: input.category,
      link: input.link,
      authorEmail: input.authorEmail,
    });
  }
  return targets.length;
}

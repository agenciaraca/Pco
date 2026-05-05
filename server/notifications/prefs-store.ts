// Preferências de notificação por usuário.
// Default: tudo opt-in (true). Usuário pode desativar broadcasts e reengajamento.
// E-mails transacionais (reset senha, pagamento confirmado, matrícula) SEMPRE vão.

import { JsonStore } from '../db/json-store';

export interface NotificationPrefs {
  userId: string;
  receiveBroadcasts: boolean;
  receiveReengagement: boolean;
  /** ISO timestamp até quando todas notificações in-app estão silenciadas; null = não. */
  snoozedUntil: string | null;
  updatedAt: string;
}

const store = new JsonStore<NotificationPrefs>('notification-prefs.json', () => []);

const DEFAULT_PREFS: Omit<NotificationPrefs, 'userId' | 'updatedAt'> = {
  receiveBroadcasts: true,
  receiveReengagement: true,
  snoozedUntil: null,
};

export async function getPrefs(userId: string): Promise<NotificationPrefs> {
  const existing = await store.findOne((p) => p.userId === userId);
  if (existing) return existing;
  return {
    userId,
    ...DEFAULT_PREFS,
    updatedAt: new Date(0).toISOString(),
  };
}

export async function setPrefs(
  userId: string,
  patch: Partial<
    Pick<NotificationPrefs, 'receiveBroadcasts' | 'receiveReengagement' | 'snoozedUntil'>
  >,
): Promise<NotificationPrefs> {
  const cur = await getPrefs(userId);
  const next: NotificationPrefs = {
    ...cur,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  const existing = await store.findOne((p) => p.userId === userId);
  if (existing) {
    await store.update(
      (p) => p.userId === userId,
      () => next,
    );
  } else {
    await store.unshift(next);
  }
  return next;
}

/** Para uso em batches: retorna set de userIds que NÃO querem broadcasts. */
export async function blockedFromBroadcasts(): Promise<Set<string>> {
  const all = await store.getAll();
  return new Set(all.filter((p) => !p.receiveBroadcasts).map((p) => p.userId));
}

export async function blockedFromReengagement(): Promise<Set<string>> {
  const all = await store.getAll();
  return new Set(all.filter((p) => !p.receiveReengagement).map((p) => p.userId));
}

export function isSnoozeActive(prefs: NotificationPrefs): boolean {
  if (!prefs.snoozedUntil) return false;
  return new Date(prefs.snoozedUntil).getTime() > Date.now();
}

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let prefsStore: typeof import('../server/notifications/prefs-store');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-snooze-'));
  process.env.DATA_DIR = tmpDir;
  prefsStore = await import('../server/notifications/prefs-store');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('isSnoozeActive', () => {
  it('false quando snoozedUntil é null', () => {
    expect(
      prefsStore.isSnoozeActive({
        userId: 'u1',
        receiveBroadcasts: true,
        receiveReengagement: true,
        snoozedUntil: null,
        updatedAt: new Date().toISOString(),
      }),
    ).toBe(false);
  });

  it('true quando snoozedUntil > now', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(
      prefsStore.isSnoozeActive({
        userId: 'u1',
        receiveBroadcasts: true,
        receiveReengagement: true,
        snoozedUntil: future,
        updatedAt: new Date().toISOString(),
      }),
    ).toBe(true);
  });

  it('false quando snoozedUntil já passou', () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(
      prefsStore.isSnoozeActive({
        userId: 'u1',
        receiveBroadcasts: true,
        receiveReengagement: true,
        snoozedUntil: past,
        updatedAt: new Date().toISOString(),
      }),
    ).toBe(false);
  });
});

describe('setPrefs persiste snoozedUntil', () => {
  it('round-trip persistência', async () => {
    const future = new Date(Date.now() + 5 * 60_000).toISOString();
    const r1 = await prefsStore.setPrefs('u-snz', { snoozedUntil: future });
    expect(r1.snoozedUntil).toBe(future);
    const r2 = await prefsStore.getPrefs('u-snz');
    expect(r2.snoozedUntil).toBe(future);
  });

  it('limpa snooze passando null', async () => {
    await prefsStore.setPrefs('u-snz2', {
      snoozedUntil: new Date(Date.now() + 60_000).toISOString(),
    });
    const r = await prefsStore.setPrefs('u-snz2', { snoozedUntil: null });
    expect(r.snoozedUntil).toBeNull();
  });

  it('default snoozedUntil = null para user novo', async () => {
    const r = await prefsStore.getPrefs('u-novo');
    expect(r.snoozedUntil).toBeNull();
    expect(r.receiveBroadcasts).toBe(true);
  });
});

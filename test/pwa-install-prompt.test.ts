// Tests do helper de install prompt PWA.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isDismissed,
  markDismissed,
  isStandalone,
  watchInstallPrompt,
  subscribe,
  promptInstall,
  isAvailable,
  _resetForTesting,
} from '../src/app/pwa/install-prompt';

const DISMISS_KEY = 'ava-pco-pwa-install-dismissed';

let storage: Record<string, string>;

beforeEach(() => {
  storage = {};
  Object.defineProperty(globalThis, 'window', {
    value: {
      localStorage: {
        getItem: (k: string) => storage[k] ?? null,
        setItem: (k: string, v: string) => {
          storage[k] = v;
        },
        removeItem: (k: string) => {
          delete storage[k];
        },
      },
      matchMedia: vi.fn().mockReturnValue({ matches: false }),
      navigator: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
    configurable: true,
    writable: true,
  });
  _resetForTesting();
});

afterEach(() => {
  Object.defineProperty(globalThis, 'window', {
    value: undefined,
    configurable: true,
    writable: true,
  });
});

describe('isDismissed', () => {
  it('false por padrao (sem entry)', () => {
    expect(isDismissed()).toBe(false);
  });

  it('true logo apos markDismissed', () => {
    markDismissed();
    expect(storage[DISMISS_KEY]).toBeTruthy();
    expect(isDismissed()).toBe(true);
  });

  it('expira apos 14 dias e remove entry', () => {
    storage[DISMISS_KEY] = String(Date.now() - 15 * 24 * 60 * 60 * 1000);
    expect(isDismissed()).toBe(false);
    expect(storage[DISMISS_KEY]).toBeUndefined();
  });

  it('false com valor invalido', () => {
    storage[DISMISS_KEY] = 'not-a-number';
    expect(isDismissed()).toBe(false);
  });
});

describe('isStandalone', () => {
  it('false por default', () => {
    expect(isStandalone()).toBe(false);
  });

  it('true via matchMedia display-mode standalone', () => {
    (globalThis.window.matchMedia as ReturnType<typeof vi.fn>).mockReturnValue({
      matches: true,
    });
    expect(isStandalone()).toBe(true);
  });

  it('true via navigator.standalone (iOS)', () => {
    (globalThis.window.navigator as Navigator & { standalone?: boolean }).standalone =
      true;
    expect(isStandalone()).toBe(true);
  });
});

describe('watchInstallPrompt + subscribe + promptInstall', () => {
  function fireEvent(name: string, evt: Partial<Event>): void {
    const calls = (
      globalThis.window.addEventListener as ReturnType<typeof vi.fn>
    ).mock.calls;
    const handler = calls.find((c) => c[0] === name)?.[1];
    if (handler) handler(evt);
  }

  it('captura beforeinstallprompt e notifica subscriber', () => {
    watchInstallPrompt();
    const cb = vi.fn();
    subscribe(cb);
    expect(cb).toHaveBeenCalledWith(false);
    cb.mockClear();

    const fakeEvent = {
      preventDefault: vi.fn(),
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    };
    fireEvent('beforeinstallprompt', fakeEvent as unknown as Event);

    expect(fakeEvent.preventDefault).toHaveBeenCalled();
    expect(cb).toHaveBeenCalledWith(true);
    expect(isAvailable()).toBe(true);
  });

  it('appinstalled limpa cached event', () => {
    watchInstallPrompt();
    const cb = vi.fn();
    subscribe(cb);
    cb.mockClear();
    fireEvent('beforeinstallprompt', {
      preventDefault: vi.fn(),
    } as unknown as Event);
    expect(cb).toHaveBeenLastCalledWith(true);
    fireEvent('appinstalled', {} as Event);
    expect(cb).toHaveBeenLastCalledWith(false);
    expect(isAvailable()).toBe(false);
  });

  it('promptInstall retorna unavailable sem cached event', async () => {
    expect(await promptInstall()).toBe('unavailable');
  });

  it('promptInstall accepted limpa cache, dismissed marca dismissed', async () => {
    watchInstallPrompt();
    fireEvent('beforeinstallprompt', {
      preventDefault: vi.fn(),
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    } as unknown as Event);
    const r1 = await promptInstall();
    expect(r1).toBe('accepted');
    expect(isAvailable()).toBe(false);

    fireEvent('beforeinstallprompt', {
      preventDefault: vi.fn(),
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'dismissed', platform: 'web' }),
    } as unknown as Event);
    const r2 = await promptInstall();
    expect(r2).toBe('dismissed');
    expect(storage[DISMISS_KEY]).toBeTruthy();
  });

  it('isAvailable false quando standalone', () => {
    watchInstallPrompt();
    fireEvent('beforeinstallprompt', {
      preventDefault: vi.fn(),
    } as unknown as Event);
    (globalThis.window.matchMedia as ReturnType<typeof vi.fn>).mockReturnValue({
      matches: true,
    });
    expect(isAvailable()).toBe(false);
  });

  it('isAvailable false quando dismissed', () => {
    watchInstallPrompt();
    fireEvent('beforeinstallprompt', {
      preventDefault: vi.fn(),
    } as unknown as Event);
    markDismissed();
    expect(isAvailable()).toBe(false);
  });
});

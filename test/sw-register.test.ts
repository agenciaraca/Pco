// Tests do helper de registro do service worker.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  registerServiceWorker,
  checkForWaitingWorker,
} from '../src/app/pwa/sw-register';

interface MockServiceWorker {
  state: string;
  postMessage: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
}

interface MockRegistration {
  installing: MockServiceWorker | null;
  waiting: MockServiceWorker | null;
  active: MockServiceWorker | null;
  addEventListener: ReturnType<typeof vi.fn>;
  _emit: (evt: string) => void;
}

let listeners: Record<string, Array<() => void>> = {};

function makeWorker(state = 'installing'): MockServiceWorker {
  const swListeners: Record<string, Array<() => void>> = {};
  const sw: MockServiceWorker = {
    state,
    postMessage: vi.fn(),
    addEventListener: vi.fn((evt: string, cb: () => void) => {
      (swListeners[evt] ??= []).push(cb);
    }),
  };
  // Permite trigger via _emit
  (sw as MockServiceWorker & { _emit: (evt: string) => void })._emit = (
    evt: string,
  ) => {
    swListeners[evt]?.forEach((cb) => cb());
  };
  return sw;
}

function makeRegistration(opts?: {
  installing?: MockServiceWorker;
  waiting?: MockServiceWorker;
}): MockRegistration {
  const regListeners: Record<string, Array<() => void>> = {};
  const reg: MockRegistration = {
    installing: opts?.installing ?? null,
    waiting: opts?.waiting ?? null,
    active: null,
    addEventListener: vi.fn((evt: string, cb: () => void) => {
      (regListeners[evt] ??= []).push(cb);
    }),
    _emit: (evt: string) => regListeners[evt]?.forEach((cb) => cb()),
  };
  return reg;
}

beforeEach(() => {
  listeners = {};
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      serviceWorker: {
        register: vi.fn(),
        getRegistration: vi.fn(),
        controller: { state: 'activated' },
        addEventListener: vi.fn((evt: string, cb: () => void) => {
          (listeners[evt] ??= []).push(cb);
        }),
      },
    },
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  Object.defineProperty(globalThis, 'navigator', {
    value: undefined,
    configurable: true,
    writable: true,
  });
});

describe('registerServiceWorker', () => {
  it('retorna null em ambiente sem serviceWorker', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {},
      configurable: true,
      writable: true,
    });
    const r = await registerServiceWorker();
    expect(r).toBeNull();
  });

  it('chama navigator.serviceWorker.register com scriptUrl default', async () => {
    const reg = makeRegistration();
    (globalThis.navigator.serviceWorker.register as ReturnType<
      typeof vi.fn
    >).mockResolvedValue(reg);
    const r = await registerServiceWorker();
    expect(r).not.toBeNull();
    expect(globalThis.navigator.serviceWorker.register).toHaveBeenCalledWith('/sw.js');
  });

  it('aceita scriptUrl customizado', async () => {
    const reg = makeRegistration();
    (globalThis.navigator.serviceWorker.register as ReturnType<
      typeof vi.fn
    >).mockResolvedValue(reg);
    await registerServiceWorker({ scriptUrl: '/service-worker.js' });
    expect(globalThis.navigator.serviceWorker.register).toHaveBeenCalledWith(
      '/service-worker.js',
    );
  });

  it('chama onUpdateAvailable quando SW vai installed e ha waiting', async () => {
    const installing = makeWorker('installing');
    const waiting = makeWorker('installed');
    const reg = makeRegistration({ installing, waiting });
    (globalThis.navigator.serviceWorker.register as ReturnType<
      typeof vi.fn
    >).mockResolvedValue(reg);

    const onUpdateAvailable = vi.fn();
    await registerServiceWorker({ onUpdateAvailable });

    // Trigger updatefound + statechange
    reg._emit('updatefound');
    installing.state = 'installed';
    (installing as MockServiceWorker & { _emit: (e: string) => void })._emit(
      'statechange',
    );

    expect(onUpdateAvailable).toHaveBeenCalledWith(waiting);
  });

  it('chama onControllerChange ao mudar controller', async () => {
    const reg = makeRegistration();
    (globalThis.navigator.serviceWorker.register as ReturnType<
      typeof vi.fn
    >).mockResolvedValue(reg);

    const onControllerChange = vi.fn();
    await registerServiceWorker({ onControllerChange });

    listeners['controllerchange']?.forEach((cb) => cb());
    expect(onControllerChange).toHaveBeenCalled();
  });

  it('activatePending posta SKIP_WAITING ao waiting worker', async () => {
    const waiting = makeWorker('installed');
    const reg = makeRegistration({ waiting });
    (globalThis.navigator.serviceWorker.register as ReturnType<
      typeof vi.fn
    >).mockResolvedValue(reg);

    const r = await registerServiceWorker();
    r!.activatePending();
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });
});

describe('checkForWaitingWorker', () => {
  it('retorna null sem registration', async () => {
    (globalThis.navigator.serviceWorker.getRegistration as ReturnType<
      typeof vi.fn
    >).mockResolvedValue(undefined);
    expect(await checkForWaitingWorker()).toBeNull();
  });
  it('retorna null sem waiting', async () => {
    const reg = makeRegistration();
    (globalThis.navigator.serviceWorker.getRegistration as ReturnType<
      typeof vi.fn
    >).mockResolvedValue(reg);
    expect(await checkForWaitingWorker()).toBeNull();
  });
  it('retorna waiting worker', async () => {
    const waiting = makeWorker('installed');
    const reg = makeRegistration({ waiting });
    (globalThis.navigator.serviceWorker.getRegistration as ReturnType<
      typeof vi.fn
    >).mockResolvedValue(reg);
    expect(await checkForWaitingWorker()).toBe(waiting);
  });
});

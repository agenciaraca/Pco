// useExperiment(id) — retorna variante atribuída ao usuário atual ou null.
// Atribuição vem do backend (hash determinístico). Cacheia em sessionStorage
// pra não pingar a cada render.
//
// Pra trackear conversão: importar trackConversion(experimentId).

import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';

const STORAGE_KEY = 'ava-pco-experiments';
let cache: Record<string, string> | null = null;
let fetching: Promise<Record<string, string>> | null = null;

function getSessionId(): string {
  try {
    let sid = sessionStorage.getItem('ava-pco-sid');
    if (!sid) {
      sid = `s-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem('ava-pco-sid', sid);
    }
    return sid;
  } catch {
    return 'anon';
  }
}

async function fetchAssignments(userId: string): Promise<Record<string, string>> {
  if (cache) return cache;
  if (fetching) return fetching;
  fetching = (async () => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, string>;
        cache = parsed;
        return parsed;
      }
    } catch {
      /* ignore */
    }
    const sid = getSessionId();
    const params = new URLSearchParams();
    if (userId) params.set('userId', userId);
    params.set('sessionId', sid);
    try {
      const r = await fetch(`/api/experiments/active?${params}`);
      if (!r.ok) return {};
      const data = (await r.json()) as { assignments: Record<string, string> };
      cache = data.assignments;
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data.assignments));
      } catch {
        /* ignore */
      }
      return data.assignments;
    } catch {
      return {};
    } finally {
      fetching = null;
    }
  })();
  return fetching;
}

/**
 * Hook que retorna a variante atribuída ao usuário atual pro experimento.
 * Retorna null se experimento não rodando, fora da janela de traffic, ou
 * antes do fetch resolver (loading).
 */
export function useExperiment(experimentId: string): string | null {
  const auth = useAuth();
  const userId = auth.user?.id ?? '';
  const [variant, setVariant] = useState<string | null>(
    cache ? cache[experimentId] ?? null : null,
  );

  useEffect(() => {
    let cancelled = false;
    void fetchAssignments(userId).then((a) => {
      if (!cancelled) setVariant(a[experimentId] ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [experimentId, userId]);

  return variant;
}

/** Reporta conversão (evento custom name opcional). */
export async function trackConversion(
  experimentId: string,
  eventName = 'converted',
  meta?: Record<string, unknown>,
): Promise<void> {
  try {
    const sid = getSessionId();
    const raw = localStorage.getItem('ava-pco-auth');
    const userId = raw ? (JSON.parse(raw) as { user?: { id?: string } } | null)?.user?.id ?? '' : '';
    await fetch(`/api/experiments/${encodeURIComponent(experimentId)}/track`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId, sessionId: sid, eventName, meta }),
    });
  } catch {
    /* silencioso */
  }
}

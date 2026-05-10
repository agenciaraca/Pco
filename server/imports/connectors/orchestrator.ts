// Orquestra a coleta de rows via API (WP/LD/WC) e devolve o mapa por entidade,
// pronto para alimentar runDryRun ou runReal.
//
// Comportamento gracioso quando uma entidade nao esta disponivel no site:
// 404 rest_no_route eh tratado como "skip" (nao falha o job inteiro).
// Outros erros ainda propagam normalmente.

import type { ImportConnection } from '../connections-store';
import type { ImportEntityType } from '../types';
import { fetchWpStudents } from './wp';
import {
  fetchLdCourses,
  fetchLdLessons,
  fetchLdTopics,
  fetchLdQuizzes,
  fetchLdQuestions,
  fetchLdGroups,
  fetchLdEnrollments,
  fetchLdProgress,
} from './ld';
import { fetchWcProducts, fetchWcOrders } from './wc';

export interface CollectOptions {
  entities: ImportEntityType[];
}

export interface SkippedEntity {
  entity: ImportEntityType;
  reason: string;
}

export interface CollectResult {
  rowsByEntity: Partial<Record<ImportEntityType, Array<Record<string, unknown>>>>;
  totalRows: number;
  perEntity: Partial<Record<ImportEntityType, number>>;
  /** Entidades nao disponiveis neste site (404 rest_no_route ou similar). */
  skipped: SkippedEntity[];
}

/**
 * Detecta se o erro indica que a entidade nao existe no site (plugin ausente
 * ou desativado). Inclui:
 * - HTTP 404 (rest_no_route do WP)
 * - HTTP 401/403 quando endpoint expoe rest_forbidden_for_post_type (plugin
 *   instalado mas REST off pra public)
 */
function isEntityUnavailable(err: unknown): { yes: boolean; reason: string } {
  // Duck typing pra capturar tanto ConnectorError quanto Error normal com
  // payload similar (evita issue de identity check entre modulos).
  const e = err as { status?: number; body?: unknown; message?: string };
  const status = typeof e?.status === 'number' ? e.status : null;
  const bodyStr =
    typeof e?.body === 'string'
      ? e.body
      : e?.body !== undefined
        ? JSON.stringify(e.body)
        : '';
  const msg = err instanceof Error ? err.message : String(err);

  if (status === 404) {
    if (bodyStr.includes('rest_no_route') || msg.includes('rest_no_route')) {
      return { yes: true, reason: 'endpoint nao disponivel neste site (404 rest_no_route)' };
    }
    return { yes: true, reason: 'endpoint retornou 404' };
  }
  if (status === 401 || status === 403) {
    if (bodyStr.includes('rest_post_invalid_type') || bodyStr.includes('rest_cannot_view')) {
      return {
        yes: true,
        reason: `endpoint sem permissao publica neste site (${status})`,
      };
    }
  }
  // Fallback: matching de message
  if (/HTTP 404/.test(msg) && /rest_no_route/.test(msg)) {
    return { yes: true, reason: 'endpoint nao disponivel neste site (404 rest_no_route)' };
  }
  return { yes: false, reason: '' };
}

async function tryFetch<T>(
  entity: ImportEntityType,
  fn: () => Promise<T[]>,
  skipped: SkippedEntity[],
): Promise<T[] | null> {
  try {
    return await fn();
  } catch (err) {
    const check = isEntityUnavailable(err);
    if (check.yes) {
      skipped.push({ entity, reason: check.reason });
      return null;
    }
    throw err;
  }
}

export async function collectFromApi(
  c: ImportConnection,
  opts: CollectOptions,
): Promise<CollectResult> {
  const rowsByEntity: CollectResult['rowsByEntity'] = {};
  const perEntity: CollectResult['perEntity'] = {};
  const skipped: SkippedEntity[] = [];
  let total = 0;

  const handlers: Array<[ImportEntityType, () => Promise<Array<Record<string, unknown>>>]> = [
    ['student', () => fetchWpStudents(c)],
    ['course', () => fetchLdCourses(c)],
    ['lesson', () => fetchLdLessons(c)],
    ['topic', () => fetchLdTopics(c)],
    ['quiz', () => fetchLdQuizzes(c)],
    ['question', () => fetchLdQuestions(c)],
    ['group', () => fetchLdGroups(c)],
    ['enrollment', () => fetchLdEnrollments(c)],
    ['progress', () => fetchLdProgress(c)],
    ['product', () => fetchWcProducts(c)],
    ['order', () => fetchWcOrders(c)],
  ];

  for (const [entity, fn] of handlers) {
    if (!opts.entities.includes(entity)) continue;
    const rows = await tryFetch(entity, fn, skipped);
    if (rows === null) continue;
    rowsByEntity[entity] = rows;
    perEntity[entity] = rows.length;
    total += rows.length;
  }

  return { rowsByEntity, totalRows: total, perEntity, skipped };
}

// Orquestra a coleta de rows via API (WP/LD/WC) e devolve o mapa por entidade,
// pronto para alimentar runDryRun ou runReal.

import type { ImportConnection } from '../connections-store';
import type { ImportEntityType } from '../types';
import { fetchWpStudents } from './wp';
import { fetchLdCourses, fetchLdLessons, fetchLdEnrollments } from './ld';
import { fetchWcProducts, fetchWcOrders } from './wc';

export interface CollectOptions {
  entities: ImportEntityType[];
}

export interface CollectResult {
  rowsByEntity: Partial<Record<ImportEntityType, Array<Record<string, unknown>>>>;
  totalRows: number;
  perEntity: Partial<Record<ImportEntityType, number>>;
}

export async function collectFromApi(
  c: ImportConnection,
  opts: CollectOptions,
): Promise<CollectResult> {
  const rowsByEntity: CollectResult['rowsByEntity'] = {};
  const perEntity: CollectResult['perEntity'] = {};
  let total = 0;

  if (opts.entities.includes('student')) {
    const r = await fetchWpStudents(c);
    rowsByEntity.student = r;
    perEntity.student = r.length;
    total += r.length;
  }
  if (opts.entities.includes('course')) {
    const r = await fetchLdCourses(c);
    rowsByEntity.course = r;
    perEntity.course = r.length;
    total += r.length;
  }
  if (opts.entities.includes('lesson')) {
    const r = await fetchLdLessons(c);
    rowsByEntity.lesson = r;
    perEntity.lesson = r.length;
    total += r.length;
  }
  if (opts.entities.includes('product')) {
    const r = await fetchWcProducts(c);
    rowsByEntity.product = r;
    perEntity.product = r.length;
    total += r.length;
  }
  if (opts.entities.includes('order')) {
    const r = await fetchWcOrders(c);
    rowsByEntity.order = r;
    perEntity.order = r.length;
    total += r.length;
  }
  if (opts.entities.includes('enrollment')) {
    const r = await fetchLdEnrollments(c);
    rowsByEntity.enrollment = r;
    perEntity.enrollment = r.length;
    total += r.length;
  }

  return { rowsByEntity, totalRows: total, perEntity };
}

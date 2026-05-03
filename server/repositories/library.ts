import { and, eq, sql, type SQL } from 'drizzle-orm';
import { getDb, schema } from '../db/client';
import { libraryItems as seed } from '../../src/app/data/seed';
import type { LibraryItem } from '../../src/app/types/schema';

interface Filter {
  type?: string;
  courseId?: string;
  mandatoryOnly?: boolean;
}

export async function listLibrary(filter: Filter = {}): Promise<LibraryItem[]> {
  const db = getDb();
  if (!db) {
    let list = seed;
    if (filter.type) list = list.filter((i) => i.type === filter.type);
    if (filter.courseId)
      list = list.filter((i) => i.relatedCourseIds?.includes(filter.courseId!));
    if (filter.mandatoryOnly) list = list.filter((i) => i.mandatory);
    return list;
  }

  const conds: SQL[] = [];
  if (filter.type) conds.push(eq(schema.libraryItems.type, filter.type));
  if (filter.mandatoryOnly) conds.push(eq(schema.libraryItems.mandatory, true));
  if (filter.courseId)
    conds.push(sql`${schema.libraryItems.relatedCourseIds} ? ${filter.courseId}`);

  const baseQuery = db.select().from(schema.libraryItems);
  const rows = await (conds.length > 0 ? baseQuery.where(and(...conds)) : baseQuery);

  if (rows.length === 0) {
    let list = seed;
    if (filter.type) list = list.filter((i) => i.type === filter.type);
    if (filter.courseId)
      list = list.filter((i) => i.relatedCourseIds?.includes(filter.courseId!));
    if (filter.mandatoryOnly) list = list.filter((i) => i.mandatory);
    return list;
  }

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    author: r.author,
    type: r.type as LibraryItem['type'],
    mandatory: r.mandatory,
    fileMockUrl: r.fileMockUrl,
    relatedCourseIds: r.relatedCourseIds ?? [],
    relatedModuleIds: r.relatedModuleIds ?? [],
    theme: r.theme ?? undefined,
  }));
}

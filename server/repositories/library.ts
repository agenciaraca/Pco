import { and, eq, sql, type SQL } from 'drizzle-orm';
import { getDb, schema } from '../db/client';
import { libraryItems as seed } from '../../src/app/data/seed';
import type { LibraryItem } from '../../src/app/types/schema';
import type { CreateLibraryInput, UpdateLibraryInput } from '../../shared/schemas';

interface Filter {
  type?: string;
  courseId?: string;
  mandatoryOnly?: boolean;
}

function rowToItem(r: typeof schema.libraryItems.$inferSelect): LibraryItem {
  return {
    id: r.id,
    title: r.title,
    author: r.author,
    type: r.type as LibraryItem['type'],
    mandatory: r.mandatory,
    fileMockUrl: r.fileMockUrl,
    relatedCourseIds: r.relatedCourseIds ?? [],
    relatedModuleIds: r.relatedModuleIds ?? [],
    theme: r.theme ?? undefined,
  };
}

function filterSeed(filter: Filter): LibraryItem[] {
  let list = seed;
  if (filter.type) list = list.filter((i) => i.type === filter.type);
  if (filter.courseId)
    list = list.filter((i) => i.relatedCourseIds?.includes(filter.courseId!));
  if (filter.mandatoryOnly) list = list.filter((i) => i.mandatory);
  return list;
}

function newId() {
  return `lib-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function listLibrary(filter: Filter = {}): Promise<LibraryItem[]> {
  const db = getDb();
  if (!db) return filterSeed(filter);

  const conds: SQL[] = [];
  if (filter.type) conds.push(eq(schema.libraryItems.type, filter.type));
  if (filter.mandatoryOnly) conds.push(eq(schema.libraryItems.mandatory, true));
  if (filter.courseId)
    conds.push(sql`${schema.libraryItems.relatedCourseIds} ? ${filter.courseId}`);

  const baseQuery = db.select().from(schema.libraryItems);
  const rows = await (conds.length > 0 ? baseQuery.where(and(...conds)) : baseQuery);
  if (rows.length === 0) return filterSeed(filter);

  return rows.map(rowToItem);
}

export async function findLibrary(id: string): Promise<LibraryItem | null> {
  const db = getDb();
  if (!db) return seed.find((i) => i.id === id) ?? null;
  const rows = await db
    .select()
    .from(schema.libraryItems)
    .where(eq(schema.libraryItems.id, id));
  if (rows.length === 0) return seed.find((i) => i.id === id) ?? null;
  return rowToItem(rows[0]);
}

export async function createLibrary(input: CreateLibraryInput): Promise<LibraryItem> {
  const id = newId();
  const item: LibraryItem = {
    id,
    title: input.title,
    author: input.author,
    type: input.type,
    mandatory: input.mandatory,
    fileMockUrl: input.fileMockUrl,
    relatedCourseIds: input.relatedCourseIds,
    relatedModuleIds: input.relatedModuleIds,
    theme: input.theme,
  };

  const db = getDb();
  if (!db) {
    seed.unshift(item);
    return item;
  }

  await db.insert(schema.libraryItems).values({
    id,
    title: item.title,
    author: item.author,
    type: item.type,
    mandatory: item.mandatory,
    fileMockUrl: item.fileMockUrl,
    relatedCourseIds: item.relatedCourseIds ?? [],
    relatedModuleIds: item.relatedModuleIds ?? [],
    theme: item.theme ?? null,
  });
  return item;
}

export async function updateLibrary(
  id: string,
  patch: UpdateLibraryInput,
): Promise<LibraryItem | null> {
  const db = getDb();
  if (!db) {
    const idx = seed.findIndex((i) => i.id === id);
    if (idx === -1) return null;
    seed[idx] = { ...seed[idx], ...patch } as LibraryItem;
    return seed[idx];
  }

  const update: Partial<typeof schema.libraryItems.$inferInsert> = {};
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.author !== undefined) update.author = patch.author;
  if (patch.type !== undefined) update.type = patch.type;
  if (patch.mandatory !== undefined) update.mandatory = patch.mandatory;
  if (patch.fileMockUrl !== undefined) update.fileMockUrl = patch.fileMockUrl;
  if (patch.relatedCourseIds !== undefined) update.relatedCourseIds = patch.relatedCourseIds;
  if (patch.relatedModuleIds !== undefined) update.relatedModuleIds = patch.relatedModuleIds;
  if (patch.theme !== undefined) update.theme = patch.theme ?? null;

  if (Object.keys(update).length === 0) return await findLibrary(id);

  const rows = await db
    .update(schema.libraryItems)
    .set(update)
    .where(eq(schema.libraryItems.id, id))
    .returning();
  return rows[0] ? rowToItem(rows[0]) : null;
}

export async function deleteLibrary(id: string): Promise<boolean> {
  const db = getDb();
  if (!db) {
    const idx = seed.findIndex((i) => i.id === id);
    if (idx === -1) return false;
    seed.splice(idx, 1);
    return true;
  }
  const rows = await db
    .delete(schema.libraryItems)
    .where(eq(schema.libraryItems.id, id))
    .returning({ id: schema.libraryItems.id });
  return rows.length > 0;
}

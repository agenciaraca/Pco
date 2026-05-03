import { and, eq, sql, type SQL } from 'drizzle-orm';
import { getDb, schema } from '../db/client';
import { JsonStore } from '../db/json-store';
import { libraryItems as defaults } from '../../src/app/data/seed';
import type { LibraryItem } from '../../src/app/types/schema';
import type { CreateLibraryInput, UpdateLibraryInput } from '../../shared/schemas';

interface Filter {
  type?: string;
  courseId?: string;
  mandatoryOnly?: boolean;
}

const store = new JsonStore<LibraryItem>('library.json', () =>
  defaults.map((d) => ({
    ...d,
    relatedCourseIds: [...(d.relatedCourseIds ?? [])],
    relatedModuleIds: [...(d.relatedModuleIds ?? [])],
  })),
);

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

function newId() {
  return `lib-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

async function applyFilter(items: LibraryItem[], filter: Filter): Promise<LibraryItem[]> {
  let list = items;
  if (filter.type) list = list.filter((i) => i.type === filter.type);
  if (filter.courseId) list = list.filter((i) => i.relatedCourseIds?.includes(filter.courseId!));
  if (filter.mandatoryOnly) list = list.filter((i) => i.mandatory);
  return list;
}

export async function listLibrary(filter: Filter = {}): Promise<LibraryItem[]> {
  const db = getDb();
  if (!db) {
    const all = await store.getAll();
    return await applyFilter(all, filter);
  }

  const conds: SQL[] = [];
  if (filter.type) conds.push(eq(schema.libraryItems.type, filter.type));
  if (filter.mandatoryOnly) conds.push(eq(schema.libraryItems.mandatory, true));
  if (filter.courseId)
    conds.push(sql`${schema.libraryItems.relatedCourseIds} ? ${filter.courseId}`);

  const baseQuery = db.select().from(schema.libraryItems);
  const rows = await (conds.length > 0 ? baseQuery.where(and(...conds)) : baseQuery);
  if (rows.length === 0) {
    const all = await store.getAll();
    return await applyFilter(all, filter);
  }
  return rows.map(rowToItem);
}

export async function findLibrary(id: string): Promise<LibraryItem | null> {
  const db = getDb();
  if (!db) return await store.findOne((i) => i.id === id);
  const rows = await db
    .select()
    .from(schema.libraryItems)
    .where(eq(schema.libraryItems.id, id));
  if (rows.length === 0) return await store.findOne((i) => i.id === id);
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
  if (!db) return await store.unshift(item);

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
    return await store.update(
      (i) => i.id === id,
      (i) => ({ ...i, ...patch }) as LibraryItem,
    );
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
  if (!db) return await store.remove((i) => i.id === id);
  const rows = await db
    .delete(schema.libraryItems)
    .where(eq(schema.libraryItems.id, id))
    .returning({ id: schema.libraryItems.id });
  return rows.length > 0;
}

// Filtros salvos (per-admin). Armazena scope (qual página/feature),
// filtros (record arbitrário) e nome dado pelo admin.

import crypto from 'node:crypto';
import { JsonStore } from '../db/json-store';

export type SavedSearchScope =
  | 'students'
  | 'orders'
  | 'imports'
  | 'activity'
  | 'rate-limits'
  | 'logs'
  | 'broadcasts';

export interface SavedSearch {
  id: string;
  ownerId: string;
  ownerEmail: string;
  scope: SavedSearchScope;
  name: string;
  filters: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

const store = new JsonStore<SavedSearch>('saved-searches.json', () => []);

function newId(): string {
  return `sv-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

export async function listForOwner(
  ownerId: string,
  scope?: SavedSearchScope,
): Promise<SavedSearch[]> {
  const all = await store.filter(
    (s) => s.ownerId === ownerId && (scope ? s.scope === scope : true),
  );
  return all.sort((a, b) => (a.name > b.name ? 1 : -1));
}

export interface CreateInput {
  ownerId: string;
  ownerEmail: string;
  scope: SavedSearchScope;
  name: string;
  filters: Record<string, unknown>;
}

export async function createSearch(input: CreateInput): Promise<SavedSearch> {
  const now = new Date().toISOString();
  const s: SavedSearch = {
    id: newId(),
    ownerId: input.ownerId,
    ownerEmail: input.ownerEmail,
    scope: input.scope,
    name: input.name,
    filters: input.filters,
    createdAt: now,
    updatedAt: now,
  };
  await store.unshift(s);
  return s;
}

export async function updateSearch(
  id: string,
  ownerId: string,
  patch: { name?: string; filters?: Record<string, unknown> },
): Promise<SavedSearch | null> {
  return await store.update(
    (s) => s.id === id && s.ownerId === ownerId,
    (s) => ({
      ...s,
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.filters !== undefined ? { filters: patch.filters } : {}),
      updatedAt: new Date().toISOString(),
    }),
  );
}

export async function deleteSearch(
  id: string,
  ownerId: string,
): Promise<boolean> {
  const all = await store.getAll();
  const keep = all.filter((s) => !(s.id === id && s.ownerId === ownerId));
  if (keep.length === all.length) return false;
  await store.setAll(keep);
  return true;
}

// Repository de produtos (cursos/sessões/pacotes pra venda).

import crypto from 'node:crypto';
import { JsonStore } from '../db/json-store';
import type { Product } from './types';

const store = new JsonStore<Product>('payment-products.json', () => []);

function newId(): string {
  return `prod-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

export async function listAll(): Promise<Product[]> {
  return await store.getAll();
}

export async function listActive(): Promise<Product[]> {
  return await store.filter((p) => p.active);
}

export async function findById(id: string): Promise<Product | null> {
  return await store.findOne((p) => p.id === id);
}

export async function findByCourseId(courseId: string): Promise<Product | null> {
  return await store.findOne(
    (p) => p.kind === 'course' && p.refId === courseId && p.active,
  );
}

interface CreateInput {
  kind: Product['kind'];
  refId?: string | null;
  name: string;
  description?: string;
  priceCents: number;
  currency?: string;
  active?: boolean;
  metadata?: Record<string, unknown>;
}

export async function createProduct(input: CreateInput): Promise<Product> {
  const now = new Date().toISOString();
  const p: Product = {
    id: newId(),
    kind: input.kind,
    refId: input.refId ?? null,
    name: input.name,
    description: input.description,
    priceCents: input.priceCents,
    currency: input.currency ?? 'BRL',
    active: input.active ?? true,
    metadata: input.metadata,
    createdAt: now,
    updatedAt: now,
  };
  await store.unshift(p);
  return p;
}

interface UpdateInput {
  kind?: Product['kind'];
  refId?: string | null;
  name?: string;
  description?: string;
  priceCents?: number;
  currency?: string;
  active?: boolean;
  metadata?: Record<string, unknown>;
}

export async function updateProduct(id: string, patch: UpdateInput): Promise<Product | null> {
  return await store.update(
    (p) => p.id === id,
    (p) => ({
      ...p,
      ...(patch.kind !== undefined ? { kind: patch.kind } : {}),
      ...(patch.refId !== undefined ? { refId: patch.refId } : {}),
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.priceCents !== undefined ? { priceCents: patch.priceCents } : {}),
      ...(patch.currency !== undefined ? { currency: patch.currency } : {}),
      ...(patch.active !== undefined ? { active: patch.active } : {}),
      ...(patch.metadata !== undefined ? { metadata: patch.metadata } : {}),
      updatedAt: new Date().toISOString(),
    }),
  );
}

export async function deleteProduct(id: string): Promise<boolean> {
  return await store.remove((p) => p.id === id);
}

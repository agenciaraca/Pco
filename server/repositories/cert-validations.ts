// Contador de validações públicas de certificado.
// Cada acesso a /api/certificates/validate/:code incrementa.

import { JsonStore } from '../db/json-store';

export interface ValidationStat {
  code: string;
  count: number;
  lastAt: string;
  firstAt: string;
}

const store = new JsonStore<ValidationStat>('cert-validations.json', () => []);

export async function recordValidation(code: string): Promise<void> {
  const now = new Date().toISOString();
  const existing = await store.findOne((v) => v.code === code);
  if (existing) {
    await store.update(
      (v) => v.code === code,
      (v) => ({ ...v, count: v.count + 1, lastAt: now }),
    );
  } else {
    await store.unshift({ code, count: 1, firstAt: now, lastAt: now });
  }
}

export async function listAll(): Promise<ValidationStat[]> {
  return await store.getAll();
}

export async function getByCode(code: string): Promise<ValidationStat | null> {
  return await store.findOne((v) => v.code === code);
}

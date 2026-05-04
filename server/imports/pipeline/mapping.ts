// Mapping engine — aplica field map (source → target + transforms) sobre uma row.
// O resultado é um objeto "normalized" pronto para validação.

import { applyTransforms } from './transforms';
import type { ImportEntityConfig, ImportFieldMapping } from '../types';

/**
 * Aplica mapping em uma única row.
 * Retorna o objeto target + lista de erros de mapping (campos required vazios, etc.).
 */
export function applyMapping(
  row: Record<string, unknown>,
  config: ImportEntityConfig,
): { value: Record<string, unknown>; errors: Array<{ field: string; message: string }> } {
  const out: Record<string, unknown> = {};
  const errors: Array<{ field: string; message: string }> = [];

  for (const m of config.mappings) {
    const raw = row[m.source];
    let v: unknown = raw;
    if ((v === undefined || v === null || v === '') && m.defaultValue !== undefined) {
      v = m.defaultValue;
    }
    v = applyTransforms(v, m.transforms);
    if (
      m.required &&
      (v === undefined || v === null || (typeof v === 'string' && v.trim() === ''))
    ) {
      errors.push({
        field: m.target,
        message: `Campo obrigatório '${m.target}' (origem '${m.source}') ausente.`,
      });
    }
    out[m.target] = v;
  }

  return { value: out, errors };
}

/** Mapping default (1:1 source==target) — útil para CSVs já com cabeçalhos canônicos. */
export function buildIdentityMapping(fields: string[]): ImportFieldMapping[] {
  return fields.map((f) => ({
    source: f,
    target: f,
    required: false,
    transforms: ['trim'],
  }));
}

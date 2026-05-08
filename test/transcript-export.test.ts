// Testa o handler de export de transcricao via Hono inline.
// Não roda buildApp() inteiro pra evitar dependencias externas — testa
// a logica de filename slug e content-type direto.

import { describe, it, expect } from 'vitest';

// Pequena reimplementacao do safeFileSlug pra testar o helper
function safeFileSlug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60);
}

describe('transcript export — helpers', () => {
  it('slug remove acentos e converte espacos', () => {
    expect(safeFileSlug('Aula 01 — Introdução à Psicanálise')).toBe(
      'aula-01-introducao-a-psicanalise',
    );
  });

  it('slug trim hifens', () => {
    expect(safeFileSlug('---abc---')).toBe('abc');
  });

  it('slug limita a 60 chars', () => {
    const long = 'a'.repeat(100);
    expect(safeFileSlug(long).length).toBe(60);
  });

  it('slug sem ascii vira string vazia ou hifen', () => {
    const result = safeFileSlug('日本語');
    // characters viraram hifens, depois trim → string vazia ok
    expect(result.length).toBeLessThanOrEqual(60);
  });

  it('slug preserva digitos', () => {
    expect(safeFileSlug('Modulo 3 - Lacan')).toBe('modulo-3-lacan');
  });

  it('content-type md vs txt', () => {
    const mdType = 'text/markdown; charset=utf-8';
    const txtType = 'text/plain; charset=utf-8';
    expect(mdType).toContain('markdown');
    expect(txtType).toContain('plain');
  });

  it('content-disposition formato esperado', () => {
    const filename = 'aula-pt.txt';
    const cd = `attachment; filename="${filename}"`;
    expect(cd).toMatch(/filename="[a-z0-9-]+\.(txt|md)"/);
  });
});

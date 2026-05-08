import { describe, it, expect } from 'vitest';

// Reimplementacao das fns inline pra testar a logica de highlight
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightText(text: string, query: string): Array<{ text: string; match: boolean }> {
  if (!query.trim()) return [{ text, match: false }];
  const re = new RegExp(`(${escapeRegex(query.trim())})`, 'gi');
  const parts = text.split(re);
  return parts.map((p, i) => ({ text: p, match: i % 2 === 1 }));
}

describe('transcript search highlight', () => {
  it('query vazia retorna texto inteiro sem match', () => {
    const r = highlightText('Sigmund Freud', '');
    expect(r).toEqual([{ text: 'Sigmund Freud', match: false }]);
  });

  it('match unico no meio do texto', () => {
    const r = highlightText('A teoria de Freud é central.', 'Freud');
    expect(r).toHaveLength(3);
    expect(r[0]).toEqual({ text: 'A teoria de ', match: false });
    expect(r[1]).toEqual({ text: 'Freud', match: true });
    expect(r[2]).toEqual({ text: ' é central.', match: false });
  });

  it('match multiplo case-insensitive', () => {
    const r = highlightText('lacan, Lacan, LACAN', 'lacan');
    const matches = r.filter((p) => p.match);
    expect(matches).toHaveLength(3);
  });

  it('escapa special regex chars (parens, dot)', () => {
    const r = highlightText('teste (Lacan) versus', '(Lacan)');
    const matches = r.filter((p) => p.match);
    expect(matches).toHaveLength(1);
    expect(matches[0].text).toBe('(Lacan)');
  });

  it('escapa . literal', () => {
    const r = highlightText('e.g. exemplo', 'e.g.');
    const matches = r.filter((p) => p.match);
    expect(matches).toHaveLength(1);
    expect(matches[0].text).toBe('e.g.');
  });

  it('preserva texto original quando junta partes', () => {
    const original =
      'Freud desenvolveu a psicanálise. Lacan reinventou. Freud ainda é referência.';
    const r = highlightText(original, 'freud');
    const reconstruction = r.map((p) => p.text).join('');
    expect(reconstruction).toBe(original);
  });

  it('query whitespace is trimmed', () => {
    const r = highlightText('Freud aqui', '  Freud  ');
    const matches = r.filter((p) => p.match);
    expect(matches).toHaveLength(1);
    expect(matches[0].text).toBe('Freud');
  });

  it('query so com espacos = sem highlight', () => {
    const r = highlightText('algum texto', '   ');
    expect(r).toEqual([{ text: 'algum texto', match: false }]);
  });

  it('escapeRegex protege $ e [', () => {
    expect(escapeRegex('R$ 100')).toBe('R\\$ 100');
    expect(escapeRegex('a[b]c')).toBe('a\\[b\\]c');
  });
});

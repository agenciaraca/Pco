import { describe, it, expect } from 'vitest';
import { buildCsv, csvResponse } from '../server/export/csv';

const BOM = '﻿';

describe('export/csv', () => {
  it('buildCsv inicia com BOM UTF-8', () => {
    const out = buildCsv([{ a: 1 }], [{ key: 'a', label: 'A' }]);
    expect(out.startsWith(BOM)).toBe(true);
  });

  it('separa linhas com CRLF (Excel BR friendly)', () => {
    const out = buildCsv(
      [{ a: 1 }, { a: 2 }],
      [{ key: 'a', label: 'A' }],
    );
    expect(out).toBe(`${BOM}A\r\n1\r\n2`);
  });

  it('escapa células contendo vírgula', () => {
    const out = buildCsv(
      [{ name: 'Smith, John' }],
      [{ key: 'name', label: 'Name' }],
    );
    expect(out).toContain('"Smith, John"');
  });

  it('escapa aspas duplas dobrando', () => {
    const out = buildCsv(
      [{ q: 'ele disse "olá"' }],
      [{ key: 'q', label: 'Q' }],
    );
    expect(out).toContain('"ele disse ""olá"""');
  });

  it('escapa quebra de linha', () => {
    const out = buildCsv(
      [{ note: 'linha1\nlinha2' }],
      [{ key: 'note', label: 'Nota' }],
    );
    expect(out).toContain('"linha1\nlinha2"');
  });

  it('null e undefined viram string vazia', () => {
    const out = buildCsv(
      [{ a: null, b: undefined, c: 'ok' }],
      [
        { key: 'a', label: 'A' },
        { key: 'b', label: 'B' },
        { key: 'c', label: 'C' },
      ],
    );
    expect(out).toBe(`${BOM}A,B,C\r\n,,ok`);
  });

  it('Date é serializado como ISO', () => {
    const d = new Date('2025-01-15T10:30:00Z');
    const out = buildCsv(
      [{ created: d }],
      [{ key: 'created', label: 'Criado' }],
    );
    expect(out).toContain('2025-01-15T10:30:00.000Z');
  });

  it('object é serializado via JSON.stringify (com escape de aspas)', () => {
    const out = buildCsv(
      [{ meta: { foo: 'bar' } }],
      [{ key: 'meta', label: 'Meta' }],
    );
    expect(out).toContain('"{""foo"":""bar""}"');
  });

  it('column.map permite computação derivada', () => {
    const out = buildCsv(
      [{ first: 'João', last: 'Silva' }],
      [
        {
          key: 'name',
          label: 'Nome',
          map: (r) => `${r.first} ${r.last}`,
        },
      ],
    );
    expect(out).toContain('João Silva');
  });

  it('rows vazias só geram cabeçalho', () => {
    const out = buildCsv(
      [] as Array<{ a: string }>,
      [{ key: 'a', label: 'A' }],
    );
    expect(out).toBe(`${BOM}A`);
  });

  it('csvResponse retorna headers corretos', async () => {
    const res = csvResponse('A,B\r\n1,2', 'test.csv');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/csv');
    expect(res.headers.get('Content-Disposition')).toContain('attachment');
    expect(res.headers.get('Content-Disposition')).toContain('test.csv');
    expect(await res.text()).toBe('A,B\r\n1,2');
  });

  it('número e boolean são stringificados', () => {
    const out = buildCsv(
      [{ n: 42, ok: true, no: false }],
      [
        { key: 'n', label: 'N' },
        { key: 'ok', label: 'OK' },
        { key: 'no', label: 'NO' },
      ],
    );
    expect(out).toBe(`${BOM}N,OK,NO\r\n42,true,false`);
  });
});

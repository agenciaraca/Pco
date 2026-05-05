import { describe, it, expect } from 'vitest';
import { parseCsv, parseCsvBuffer } from '../server/imports/connectors/csv';

describe('CSV parser RFC 4180', () => {
  it('parse básico com header + linhas', () => {
    const csv = 'name,email\nJoão,joao@x.com\nMaria,maria@x.com';
    const r = parseCsv(csv);
    expect(r.headers).toEqual(['name', 'email']);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toEqual({ name: 'João', email: 'joao@x.com' });
    expect(r.rows[1]).toEqual({ name: 'Maria', email: 'maria@x.com' });
  });

  it('detecta separador ponto-e-vírgula automaticamente', () => {
    const csv = 'a;b;c\n1;2;3';
    const r = parseCsv(csv);
    expect(r.separator).toBe(';');
    expect(r.rows[0]).toEqual({ a: '1', b: '2', c: '3' });
  });

  it('aspas duplas escapam vírgulas internas', () => {
    const csv = 'name,note\n"Silva, João","Olá, mundo"';
    const r = parseCsv(csv);
    expect(r.rows[0]).toEqual({ name: 'Silva, João', note: 'Olá, mundo' });
  });

  it('aspas duplas duplicadas escapam aspa literal', () => {
    const csv = 'q\n"Ele disse ""oi"""';
    const r = parseCsv(csv);
    expect(r.rows[0]).toEqual({ q: 'Ele disse "oi"' });
  });

  it('multilinha dentro de aspas é preservada', () => {
    const csv = 'name,note\nJoão,"linha 1\nlinha 2"';
    const r = parseCsv(csv);
    expect(r.rows[0]?.note).toBe('linha 1\nlinha 2');
  });

  it('aceita CRLF como quebra de linha', () => {
    const csv = 'a,b\r\n1,2\r\n3,4';
    const r = parseCsv(csv);
    expect(r.rows).toHaveLength(2);
  });

  it('linhas vazias são ignoradas', () => {
    const csv = 'a,b\n\n1,2\n\n';
    const r = parseCsv(csv);
    expect(r.rows).toHaveLength(1);
  });

  it('parseCsvBuffer remove BOM UTF-8', () => {
    const buf = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from('a,b\n1,2'),
    ]);
    const r = parseCsvBuffer(buf);
    expect(r.headers).toEqual(['a', 'b']);
    expect(r.rows[0]).toEqual({ a: '1', b: '2' });
  });
});

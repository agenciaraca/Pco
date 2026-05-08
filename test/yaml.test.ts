// Tests do conversor JSON -> YAML minimo (server/http/yaml.ts).

import { describe, it, expect } from 'vitest';
import { jsonToYaml } from '../server/http/yaml';

describe('jsonToYaml', () => {
  it('converte primitivos', () => {
    expect(jsonToYaml('hello')).toBe('hello\n');
    expect(jsonToYaml(42)).toBe('42\n');
    expect(jsonToYaml(true)).toBe('true\n');
    expect(jsonToYaml(null)).toBe('null\n');
  });

  it('quota strings que precisam', () => {
    expect(jsonToYaml('123')).toContain('"123"');
    expect(jsonToYaml('true')).toContain('"true"');
    expect(jsonToYaml('a: b')).toContain('"a: b"');
    expect(jsonToYaml('')).toBe('""\n');
  });

  it('converte objeto simples', () => {
    const out = jsonToYaml({ name: 'API', version: 1 });
    expect(out).toContain('name: API');
    expect(out).toContain('version: 1');
  });

  it('converte objeto aninhado com indent', () => {
    const out = jsonToYaml({
      info: { title: 'X', version: '1.0' },
    });
    expect(out).toMatch(/info:\n {2}title: X\n {2}version:/);
  });

  it('converte arrays de strings com indent', () => {
    const out = jsonToYaml({ tags: ['a', 'b', 'c'] });
    expect(out).toContain('tags:\n  - a\n  - b\n  - c');
  });

  it('converte arrays de objetos', () => {
    const out = jsonToYaml({
      servers: [
        { url: 'https://x', description: 'prod' },
        { url: 'http://y', description: 'dev' },
      ],
    });
    // Cada item deve começar com "  - url:..." (2 spaces indent + "- ")
    expect(out).toMatch(/servers:\n {2}- url: https:\/\/x/);
    expect(out).toMatch(/- url: http:\/\/y/);
  });

  it('arrays/objetos vazios', () => {
    expect(jsonToYaml([])).toBe('[]\n');
    expect(jsonToYaml({})).toBe('{}\n');
  });

  it('aceita keys com . - @ e $', () => {
    const out = jsonToYaml({ '@type': 'X', 'a.b': 'y', 'with-dash': 1 });
    expect(out).toContain('@type: X');
    expect(out).toContain('a.b: y');
    expect(out).toContain('with-dash: 1');
  });

  it('quota keys que comecam com / ou numeros', () => {
    const out = jsonToYaml({ '/v1/me': 1, '200': 'ok' });
    expect(out).toContain('"/v1/me": 1');
    expect(out).toContain('"200": ok');
  });

  it('formato OpenAPI 3 plausivel (campos basicos)', () => {
    const spec = {
      openapi: '3.0.3',
      info: { title: 'AVA', version: '0.1.0' },
      paths: {
        '/v1/me': {
          get: {
            summary: 'Token info',
            responses: { '200': { description: 'ok' } },
          },
        },
      },
    };
    const yaml = jsonToYaml(spec);
    expect(yaml).toContain('openapi: "3.0.3"');
    expect(yaml).toMatch(/info:\n {2}title: AVA/);
    expect(yaml).toContain('"/v1/me":');
    expect(yaml).toContain('"200":');
    expect(yaml).toContain('description: ok');
  });
});

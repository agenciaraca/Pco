import { describe, it, expect } from 'vitest';
import { applyMapping, buildIdentityMapping } from '../server/imports/pipeline/mapping';
import type { ImportEntityConfig } from '../server/imports/types';

function cfg(mappings: ImportEntityConfig['mappings']): ImportEntityConfig {
  return {
    entity: 'student',
    enabled: true,
    mappings,
    conflictStrategy: 'update',
    matchKeys: ['email'],
  };
}

describe('imports/pipeline/mapping', () => {
  it('applyMapping copia source → target', () => {
    const r = applyMapping(
      { user_email: 'a@b.com' },
      cfg([
        {
          source: 'user_email',
          target: 'email',
          required: true,
          transforms: [],
        },
      ]),
    );
    expect(r.value.email).toBe('a@b.com');
    expect(r.errors).toEqual([]);
  });

  it('aplica transforms na ordem', () => {
    const r = applyMapping(
      { name: '  João  ' },
      cfg([
        {
          source: 'name',
          target: 'displayName',
          required: false,
          transforms: ['trim'],
        },
      ]),
    );
    expect(r.value.displayName).toBe('João');
  });

  it('campo required vazio gera erro', () => {
    const r = applyMapping(
      { user_email: '' },
      cfg([
        {
          source: 'user_email',
          target: 'email',
          required: true,
          transforms: [],
        },
      ]),
    );
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]!.field).toBe('email');
    expect(r.errors[0]!.message).toContain('obrigatório');
  });

  it('campo required ausente da row gera erro', () => {
    const r = applyMapping(
      { outra: 'x' },
      cfg([
        {
          source: 'user_email',
          target: 'email',
          required: true,
          transforms: [],
        },
      ]),
    );
    expect(r.errors).toHaveLength(1);
  });

  it('defaultValue preenche quando vazio', () => {
    const r = applyMapping(
      { status: '' },
      cfg([
        {
          source: 'status',
          target: 'status',
          required: false,
          transforms: [],
          defaultValue: 'ativo',
        },
      ]),
    );
    expect(r.value.status).toBe('ativo');
  });

  it('defaultValue não sobrescreve valor existente', () => {
    const r = applyMapping(
      { status: 'em_risco' },
      cfg([
        {
          source: 'status',
          target: 'status',
          required: false,
          transforms: [],
          defaultValue: 'ativo',
        },
      ]),
    );
    expect(r.value.status).toBe('em_risco');
  });

  it('required apenas com whitespace é considerado vazio', () => {
    const r = applyMapping(
      { user_email: '   ' },
      cfg([
        {
          source: 'user_email',
          target: 'email',
          required: true,
          transforms: [],
        },
      ]),
    );
    expect(r.errors).toHaveLength(1);
  });

  it('required false nunca lança erro', () => {
    const r = applyMapping(
      { foo: '' },
      cfg([
        {
          source: 'foo',
          target: 'foo',
          required: false,
          transforms: [],
        },
      ]),
    );
    expect(r.errors).toEqual([]);
  });

  it('aplica transforms compostos', () => {
    const r = applyMapping(
      { price: '49,90' },
      cfg([
        {
          source: 'price',
          target: 'priceCents',
          required: false,
          transforms: ['parse_money'],
        },
      ]),
    );
    expect(r.value.priceCents).toBe(4990);
  });

  it('buildIdentityMapping gera 1:1 com trim default', () => {
    const r = buildIdentityMapping(['email', 'name']);
    expect(r).toHaveLength(2);
    expect(r[0]!.source).toBe('email');
    expect(r[0]!.target).toBe('email');
    expect(r[0]!.required).toBe(false);
    expect(r[0]!.transforms).toEqual(['trim']);
  });

  it('vários mappings em paralelo', () => {
    const r = applyMapping(
      { e: 'a@b.com', n: 'João' },
      cfg([
        { source: 'e', target: 'email', required: true, transforms: [] },
        { source: 'n', target: 'name', required: false, transforms: [] },
      ]),
    );
    expect(r.value.email).toBe('a@b.com');
    expect(r.value.name).toBe('João');
    expect(r.errors).toEqual([]);
  });
});

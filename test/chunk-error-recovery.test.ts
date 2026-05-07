import { describe, it, expect } from 'vitest';
import { _internal } from '../src/app/monitoring/chunk-error-recovery';

const { isChunkLoadError } = _internal;

describe('isChunkLoadError', () => {
  it('detecta mensagem padrão do Vite', () => {
    expect(
      isChunkLoadError(
        new Error('Failed to fetch dynamically imported module: /assets/Foo-abc.js'),
      ),
    ).toBe(true);
  });

  it('detecta mensagem de import script', () => {
    expect(
      isChunkLoadError(new Error('Importing a module script failed.')),
    ).toBe(true);
  });

  it('detecta variante Firefox', () => {
    expect(
      isChunkLoadError(
        new Error('error loading dynamically imported module: foo.js'),
      ),
    ).toBe(true);
  });

  it('detecta padrão webpack/older bundlers', () => {
    expect(isChunkLoadError(new Error('Loading chunk 42 failed.'))).toBe(true);
    expect(isChunkLoadError(new Error('Loading CSS chunk 7 failed.'))).toBe(true);
  });

  it('não detecta erros não-relacionados', () => {
    expect(isChunkLoadError(new Error('Network error'))).toBe(false);
    expect(isChunkLoadError(new Error('TypeError: undefined is not a function'))).toBe(false);
    expect(isChunkLoadError(new Error('404 Not Found'))).toBe(false);
  });

  it('aceita string como reason', () => {
    expect(
      isChunkLoadError('Failed to fetch dynamically imported module'),
    ).toBe(true);
    expect(isChunkLoadError('outra coisa')).toBe(false);
  });

  it('aceita objeto plain com message', () => {
    expect(
      isChunkLoadError({ message: 'Failed to fetch dynamically imported module' }),
    ).toBe(true);
  });

  it('reason null/undefined retorna false', () => {
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });

  it('reason sem message retorna false', () => {
    expect(isChunkLoadError({})).toBe(false);
    expect(isChunkLoadError(123)).toBe(false);
  });
});

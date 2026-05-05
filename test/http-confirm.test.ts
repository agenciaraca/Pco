import { describe, it, expect } from 'vitest';
import { confirmMatches } from '../server/http/confirm';

describe('http/confirm — two-step delete', () => {
  it('match exato é true', () => {
    expect(confirmMatches('Curso X', 'Curso X')).toBe(true);
  });

  it('case-insensitive', () => {
    expect(confirmMatches('curso x', 'Curso X')).toBe(true);
    expect(confirmMatches('USUARIO@EMAIL.COM', 'usuario@email.com')).toBe(true);
  });

  it('normaliza espaços extras', () => {
    expect(confirmMatches('  Curso   X  ', 'Curso X')).toBe(true);
  });

  it('strings diferentes retornam false', () => {
    expect(confirmMatches('Curso Y', 'Curso X')).toBe(false);
  });

  it('vazio em qualquer lado retorna false', () => {
    expect(confirmMatches('', 'Curso X')).toBe(false);
    expect(confirmMatches('Curso X', '')).toBe(false);
    expect(confirmMatches('', '')).toBe(false);
  });
});

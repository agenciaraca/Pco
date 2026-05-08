// Testes do script scripts/update-coverage-badge.mjs.
// Importamos as funções puras (colorForPct, buildBadge, applyBadge, readPct)
// para validar a lógica sem tocar no FS.

import { describe, it, expect } from 'vitest';
// @ts-expect-error — JS module sem .d.ts; importado via ESM funcional em runtime
import * as mod from '../scripts/update-coverage-badge.mjs';

const { colorForPct, buildBadge, applyBadge, readPct } = mod as {
  colorForPct: (pct: number) => string;
  buildBadge: (pct: number) => string;
  applyBadge: (readme: string, pct: number) => string;
  readPct: (summary: unknown) => number;
};

describe('coverage badge script', () => {
  describe('colorForPct', () => {
    it.each([
      [95, 'brightgreen'],
      [80, 'brightgreen'],
      [79.9, 'green'],
      [70, 'green'],
      [69.9, 'yellowgreen'],
      [60, 'yellowgreen'],
      [50, 'yellow'],
      [45, 'orange'],
      [10, 'red'],
      [0, 'red'],
    ])('pct=%s → %s', (pct, expected) => {
      expect(colorForPct(pct)).toBe(expected);
    });
  });

  describe('buildBadge', () => {
    it('arredonda e usa cor correta', () => {
      expect(buildBadge(72.4)).toBe(
        '![Coverage](https://img.shields.io/badge/coverage-72%25-green)',
      );
    });
    it('usa brightgreen para 80+', () => {
      expect(buildBadge(85)).toBe(
        '![Coverage](https://img.shields.io/badge/coverage-85%25-brightgreen)',
      );
    });
    it('aceita 0 sem quebrar', () => {
      expect(buildBadge(0)).toBe(
        '![Coverage](https://img.shields.io/badge/coverage-0%25-red)',
      );
    });
  });

  describe('applyBadge', () => {
    it('substitui badge existente preservando o resto', () => {
      const readme = [
        '# Projeto',
        '![Tests](https://img.shields.io/badge/tests-100-green)',
        '![Coverage](https://img.shields.io/badge/coverage-50%25-yellow)',
        '',
        'Conteúdo abaixo.',
      ].join('\n');
      const next = applyBadge(readme, 75);
      expect(next).toContain('coverage-75%25-green');
      expect(next).not.toContain('coverage-50%25');
      expect(next).toContain('Conteúdo abaixo.');
    });

    it('insere badge depois do badge Tests quando não existe ainda', () => {
      const readme = [
        '# Projeto',
        '![Tests](https://img.shields.io/badge/tests-100-green)',
        '',
        'Conteúdo.',
      ].join('\n');
      const next = applyBadge(readme, 65);
      const lines = next.split('\n');
      const testsIdx = lines.findIndex((l: string) => l.startsWith('![Tests]'));
      const covIdx = lines.findIndex((l: string) => l.startsWith('![Coverage]'));
      expect(covIdx).toBe(testsIdx + 1);
      expect(lines[covIdx]).toContain('coverage-65%25-yellowgreen');
    });

    it('insere após primeira linha quando Tests não existe', () => {
      const readme = '# Projeto\n\nConteúdo.\n';
      const next = applyBadge(readme, 90);
      const lines = next.split('\n');
      expect(lines[0]).toBe('# Projeto');
      expect(lines[1]).toContain('coverage-90%25-brightgreen');
    });
  });

  describe('readPct', () => {
    it('extrai total.statements.pct', () => {
      expect(readPct({ total: { statements: { pct: 71.42 } } })).toBe(71.42);
    });
    it('lança quando ausente', () => {
      expect(() => readPct({ total: {} })).toThrow(/total\.statements\.pct/);
      expect(() => readPct(null)).toThrow();
      expect(() => readPct({ total: { statements: { pct: 'foo' } } })).toThrow();
    });
  });
});

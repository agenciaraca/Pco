// Hook genérico de sort para tabelas client-side.
// Aceita rows + função de extração de valor por field; retorna rows ordenadas
// + helpers para SortableTh.

import { useMemo, useState, useCallback } from 'react';

export type SortDirection = 'asc' | 'desc';

export interface UseTableSortResult<T> {
  rows: T[];
  field: string | null;
  direction: SortDirection;
  toggleSort: (field: string) => void;
  setSort: (field: string, direction?: SortDirection) => void;
}

/**
 * Hook de sort client-side.
 * @param data lista original (não mutada)
 * @param getValue função (row, field) → primitive (string|number|Date)
 *                 usada pra comparar. Retornar null/undefined empurra pro fim.
 * @param initialField campo padrão
 * @param initialDirection direção padrão (default 'asc')
 */
export function useTableSort<T>(
  data: T[],
  getValue: (row: T, field: string) => unknown,
  initialField: string | null = null,
  initialDirection: SortDirection = 'asc',
): UseTableSortResult<T> {
  const [field, setField] = useState<string | null>(initialField);
  const [direction, setDirection] = useState<SortDirection>(initialDirection);

  const toggleSort = useCallback((next: string) => {
    setField((prev) => {
      if (prev === next) {
        setDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setDirection('asc');
      return next;
    });
  }, []);

  const setSort = useCallback((next: string, dir?: SortDirection) => {
    setField(next);
    if (dir) setDirection(dir);
  }, []);

  const rows = useMemo(() => {
    if (!field) return data;
    const sorted = [...data];
    sorted.sort((a, b) => {
      const av = getValue(a, field);
      const bv = getValue(b, field);
      const aNull = av === undefined || av === null || av === '';
      const bNull = bv === undefined || bv === null || bv === '';
      if (aNull && bNull) return 0;
      if (aNull) return 1; // null sempre no fim
      if (bNull) return -1;
      // numérico
      if (typeof av === 'number' && typeof bv === 'number') {
        return direction === 'asc' ? av - bv : bv - av;
      }
      // Date string ISO
      if (typeof av === 'string' && typeof bv === 'string') {
        // Tenta comparação numérica se ambas só dígitos
        const cmp = av.localeCompare(bv, 'pt-BR', { numeric: true, sensitivity: 'base' });
        return direction === 'asc' ? cmp : -cmp;
      }
      // boolean: false < true
      if (typeof av === 'boolean' && typeof bv === 'boolean') {
        return direction === 'asc' ? Number(av) - Number(bv) : Number(bv) - Number(av);
      }
      // Fallback: converte pra string
      const as = String(av);
      const bs = String(bv);
      const cmp = as.localeCompare(bs, 'pt-BR', { numeric: true, sensitivity: 'base' });
      return direction === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [data, field, direction, getValue]);

  return { rows, field, direction, toggleSort, setSort };
}

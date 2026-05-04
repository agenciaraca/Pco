// Helper de export CSV genérico (RFC 4180-ish, com BOM UTF-8 para Excel BR).

const BOM = '﻿';

function escape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s =
    typeof v === 'string'
      ? v
      : v instanceof Date
        ? v.toISOString()
        : typeof v === 'object'
          ? JSON.stringify(v)
          : String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildCsv<T>(
  rows: T[],
  columns: Array<{ key: keyof T | string; label: string; map?: (r: T) => unknown }>,
): string {
  const lines: string[] = [];
  lines.push(columns.map((c) => escape(c.label)).join(','));
  for (const r of rows) {
    lines.push(
      columns
        .map((c) => escape(c.map ? c.map(r) : (r as Record<string, unknown>)[c.key as string]))
        .join(','),
    );
  }
  return BOM + lines.join('\r\n');
}

export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

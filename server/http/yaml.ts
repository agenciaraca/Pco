// Conversao minimo JSON -> YAML para servir openapi.yaml. Suporta os
// tipos que aparecem em uma spec OpenAPI: object, array, string, number,
// boolean, null. Nao implementa anchors, multi-line strings preservadas
// como block style.

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

const NEEDS_QUOTE_RE = /^[-?:,\[\]{}#&*!|>'"%@`]|^[0-9]|: |[\n\t]|^(true|false|null|yes|no|on|off|~)$/i;

function quoteString(s: string): string {
  if (s === '') return '""';
  if (NEEDS_QUOTE_RE.test(s) || /\s$/.test(s) || /\\/.test(s) || /^\s/.test(s)) {
    return JSON.stringify(s);
  }
  return s;
}

function isPlainObject(v: unknown): v is Record<string, Json> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function emit(value: Json, indent: number): string {
  const pad = '  '.repeat(indent);
  if (value === null) return 'null\n';
  if (typeof value === 'boolean') return `${value}\n`;
  if (typeof value === 'number') return `${value}\n`;
  if (typeof value === 'string') return `${quoteString(value)}\n`;

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]\n';
    let out = '\n';
    for (const item of value) {
      if (isPlainObject(item) || Array.isArray(item)) {
        const inner = emit(item, indent + 1);
        // Para item bloco: "- " + primeiro item de chave/valor.
        const lines = inner.replace(/^\n/, '').split('\n').filter((l) => l !== '');
        if (lines.length === 0) out += `${pad}- {}\n`;
        else {
          out += `${pad}- ${lines[0].slice((indent + 1) * 2)}\n`;
          for (const l of lines.slice(1)) out += `${l}\n`;
        }
      } else {
        out += `${pad}- ${emit(item, 0)}`;
      }
    }
    return out;
  }

  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    if (keys.length === 0) return '{}\n';
    let out = '\n';
    for (const k of keys) {
      const v = value[k];
      const keyStr = /^[A-Za-z_$@][A-Za-z0-9_\-/.$@]*$/.test(k) ? k : JSON.stringify(k);
      if (isPlainObject(v) || Array.isArray(v)) {
        out += `${pad}${keyStr}:${emit(v, indent + 1)}`;
      } else {
        out += `${pad}${keyStr}: ${emit(v, 0)}`;
      }
    }
    return out;
  }

  return `${String(value)}\n`;
}

export function jsonToYaml(value: unknown): string {
  const out = emit(value as Json, 0);
  return out.replace(/^\n/, '');
}

// Parser CSV RFC 4180 puro — sem dependências.
// - Auto-detect separador (`,` ou `;`)
// - Suporta BOM UTF-8
// - Suporta CRLF e LF
// - Aspas duplas escapam aspa: ""
// - Multi-linha dentro de células com aspas

export interface ParseResult {
  headers: string[];
  rows: Array<Record<string, string>>;
  separator: ',' | ';';
  totalLines: number;
  errors: Array<{ line: number; message: string }>;
}

/** Remove BOM se presente. */
function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function detectSeparator(headerLine: string): ',' | ';' {
  const commas = (headerLine.match(/,/g) ?? []).length;
  const semis = (headerLine.match(/;/g) ?? []).length;
  return semis > commas ? ';' : ',';
}

/**
 * Parse uma linha CSV respeitando aspas. Retorna campos.
 * O input pode incluir \n internos quando dentro de aspas.
 */
function parseRow(input: string, sep: string): { fields: string[]; consumed: number } {
  const fields: string[] = [];
  let i = 0;
  let cur = '';
  let inQuotes = false;
  while (i < input.length) {
    const c = input[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (input[i + 1] === '"') {
          cur += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cur += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === sep) {
      fields.push(cur);
      cur = '';
      i += 1;
      continue;
    }
    if (c === '\r') {
      if (input[i + 1] === '\n') {
        fields.push(cur);
        return { fields, consumed: i + 2 };
      }
      fields.push(cur);
      return { fields, consumed: i + 1 };
    }
    if (c === '\n') {
      fields.push(cur);
      return { fields, consumed: i + 1 };
    }
    cur += c;
    i += 1;
  }
  fields.push(cur);
  return { fields, consumed: i };
}

export function parseCsv(rawInput: string): ParseResult {
  const text = stripBom(rawInput);
  const errors: ParseResult['errors'] = [];
  if (!text.trim()) {
    return { headers: [], rows: [], separator: ',', totalLines: 0, errors };
  }

  // Detecta separador a partir da primeira linha (sem se preocupar com aspas)
  const firstNl = text.indexOf('\n');
  const headerSlice = firstNl === -1 ? text : text.slice(0, firstNl);
  const separator = detectSeparator(headerSlice);

  // Parse cabeçalho
  const headerParse = parseRow(text, separator);
  let cursor = headerParse.consumed;
  const headers = headerParse.fields.map((h) => h.trim());

  // Verifica duplicatas no header
  const dupCheck = new Set<string>();
  for (const h of headers) {
    if (dupCheck.has(h)) errors.push({ line: 1, message: `Cabeçalho duplicado: ${h}` });
    dupCheck.add(h);
  }

  const rows: Array<Record<string, string>> = [];
  let lineNum = 2;
  while (cursor < text.length) {
    // Pula linhas em branco totalmente
    if (text[cursor] === '\n' || text[cursor] === '\r') {
      if (text[cursor] === '\r' && text[cursor + 1] === '\n') cursor += 2;
      else cursor += 1;
      lineNum += 1;
      continue;
    }
    const slice = text.slice(cursor);
    const parse = parseRow(slice, separator);
    cursor += parse.consumed;
    // Linha completamente vazia? (campo único '')
    if (parse.fields.length === 1 && parse.fields[0] === '') {
      lineNum += 1;
      continue;
    }
    if (parse.fields.length !== headers.length) {
      errors.push({
        line: lineNum,
        message: `Esperado ${headers.length} colunas, encontrado ${parse.fields.length}`,
      });
      // Ainda assim cria objeto com o que veio
    }
    const obj: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      obj[headers[i]!] = parse.fields[i] ?? '';
    }
    rows.push(obj);
    lineNum += 1;
  }

  return { headers, rows, separator, totalLines: lineNum - 1, errors };
}

/** Helper pra converter um Buffer/string vindo de upload em ParseResult. */
export function parseCsvBuffer(buf: Buffer): ParseResult {
  return parseCsv(buf.toString('utf8'));
}

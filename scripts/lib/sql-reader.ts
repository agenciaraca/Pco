/**
 * Streaming SQL dump reader.
 * Reads a MySQL/MariaDB dump file, extracts INSERT statements
 * for specified tables, and returns rows as typed objects.
 *
 * Handles multi-line strings, escaped quotes, and semicolons inside values.
 */

import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

export type Row = Record<string, string | number | null>;

function parseSqlValue(raw: string): string | number | null {
  if (raw === 'NULL') return null;
  if (raw.startsWith("'")) {
    const inner = raw.slice(1, -1);
    return inner
      .replace(/\\'/g, "'")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\0/g, '\0');
  }
  if (/^-?\d+$/.test(raw)) return parseInt(raw, 10);
  if (/^-?\d+\.\d+([eE][+-]?\d+)?$/.test(raw)) return parseFloat(raw);
  return raw;
}

function extractTuples(valuesStr: string): string[][] {
  const tuples: string[][] = [];
  let i = 0;
  const len = valuesStr.length;

  while (i < len) {
    while (i < len && valuesStr[i] !== '(') i++;
    if (i >= len) break;
    i++;

    const values: string[] = [];
    let current = '';
    let inString = false;
    let depth = 0;

    while (i < len) {
      const ch = valuesStr[i];

      if (inString) {
        if (ch === '\\') {
          current += ch;
          i++;
          if (i < len) { current += valuesStr[i]; i++; }
          continue;
        }
        if (ch === "'") {
          // Check for '' (escaped quote in some dumps)
          if (i + 1 < len && valuesStr[i + 1] === "'") {
            current += "''";
            i += 2;
            continue;
          }
          current += ch;
          inString = false;
          i++;
          continue;
        }
        current += ch;
        i++;
        continue;
      }

      if (ch === "'") { current += ch; inString = true; i++; continue; }
      if (ch === '(') { depth++; current += ch; i++; continue; }
      if (ch === ')') {
        if (depth > 0) { depth--; current += ch; i++; continue; }
        values.push(current.trim());
        tuples.push(values);
        i++;
        break;
      }
      if (ch === ',' && depth === 0) {
        values.push(current.trim());
        current = '';
        i++;
        continue;
      }
      current += ch;
      i++;
    }
  }

  return tuples;
}

function parseColumnList(insertPrefix: string): string[] | null {
  const match = insertPrefix.match(/\(([^)]+)\)/);
  if (!match) return null;
  return match[1].split(',').map(c => c.trim().replace(/`/g, ''));
}

/**
 * Count unescaped single quotes in a string to track in/out of SQL strings.
 */
function countUnescapedQuotes(line: string): number {
  let count = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === "'") {
      // Check if escaped by backslash
      let backslashes = 0;
      let j = i - 1;
      while (j >= 0 && line[j] === '\\') { backslashes++; j--; }
      if (backslashes % 2 === 0) {
        // Check for '' double quote escape
        if (i + 1 < line.length && line[i + 1] === "'") {
          i++; // skip the pair — they cancel out
        } else {
          count++;
        }
      }
    }
  }
  return count;
}

export async function readSqlDump(
  filePath: string,
  tables: string[],
  onProgress?: (table: string, rowCount: number) => void
): Promise<Map<string, Row[]>> {
  const result = new Map<string, Row[]>();
  for (const t of tables) result.set(t, []);

  const tableSet = new Set(tables);
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });

  let currentInsert = '';
  let currentTable = '';
  let currentColumns: string[] | null = null;
  let collecting = false;
  let quoteBalance = 0;

  for await (const line of rl) {
    if (!collecting) {
      if (line.startsWith('--') || line.startsWith('/*') || line.trim() === '') continue;

      const insertMatch = line.match(/^INSERT INTO `([^`]+)`/);
      if (insertMatch) {
        const tableName = insertMatch[1];
        if (tableSet.has(tableName)) {
          currentTable = tableName;
          currentColumns = parseColumnList(line);

          // Find VALUES — may or may not have trailing space
          let valIdx = line.indexOf(' VALUES ');
          let valOffset = 8;
          if (valIdx === -1) {
            valIdx = line.indexOf(' VALUES');
            valOffset = 7;
          }

          if (valIdx === -1) {
            // No VALUES keyword on this line at all — just collect
            collecting = true;
            currentInsert = '';
            quoteBalance = 0;
            continue;
          }

          const afterValues = line.substring(valIdx + valOffset).trim();
          if (!afterValues || afterValues === '') {
            // VALUES is at end of line — data starts on next line
            collecting = true;
            currentInsert = '';
            quoteBalance = 0;
            continue;
          }

          // VALUES + data on same line
          quoteBalance = countUnescapedQuotes(afterValues);
          if (quoteBalance % 2 === 0 && afterValues.endsWith(';')) {
            processInsert(afterValues.replace(/;\s*$/, ''), currentTable, currentColumns, result, onProgress);
            quoteBalance = 0;
            currentTable = '';
            currentColumns = null;
          } else {
            collecting = true;
            currentInsert = afterValues;
          }
        }
      }
      continue;
    }

    // Collecting continuation lines
    if (currentInsert) {
      currentInsert += '\n' + line;
    } else {
      currentInsert = line;
    }
    quoteBalance += countUnescapedQuotes(line);

    // Statement ends when quotes are balanced and line ends with ;
    if (quoteBalance % 2 === 0 && line.trimEnd().endsWith(';')) {
      processInsert(currentInsert.replace(/;\s*$/, ''), currentTable, currentColumns, result, onProgress);
      collecting = false;
      currentInsert = '';
      currentTable = '';
      currentColumns = null;
      quoteBalance = 0;
    }
  }

  return result;
}

function processInsert(
  valuesStr: string,
  tableName: string,
  columns: string[] | null,
  result: Map<string, Row[]>,
  onProgress?: (table: string, rowCount: number) => void
): void {
  const rows = result.get(tableName)!;
  const tuples = extractTuples(valuesStr);

  for (const tuple of tuples) {
    const row: Row = {};
    if (columns) {
      for (let j = 0; j < columns.length && j < tuple.length; j++) {
        row[columns[j]] = parseSqlValue(tuple[j]);
      }
    } else {
      for (let j = 0; j < tuple.length; j++) {
        row[`col${j}`] = parseSqlValue(tuple[j]);
      }
    }
    rows.push(row);
  }

  if (onProgress) onProgress(tableName, rows.length);
}

export async function readTable(filePath: string, tableName: string): Promise<Row[]> {
  const result = await readSqlDump(filePath, [tableName]);
  return result.get(tableName) || [];
}

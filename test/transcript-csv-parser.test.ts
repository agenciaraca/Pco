import { describe, it, expect } from 'vitest';

// Reimplementacao da fn pra testar isolado (mantida em sync com AdminTranscripts.tsx)
function parseCsvRows(raw: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let buf = '';
  let inQuotes = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (inQuotes) {
      if (ch === '"') {
        if (raw[i + 1] === '"') {
          buf += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        buf += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        cur.push(buf);
        buf = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && raw[i + 1] === '\n') i++;
        cur.push(buf);
        if (cur.some((c) => c !== '')) rows.push(cur);
        cur = [];
        buf = '';
      } else {
        buf += ch;
      }
    }
  }
  if (buf || cur.length > 0) {
    cur.push(buf);
    if (cur.some((c) => c !== '')) rows.push(cur);
  }
  return rows;
}

function parseCsv(raw: string): Array<{ lessonId: string; lang: string; text: string }> {
  const rows = parseCsvRows(raw);
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idIdx = header.findIndex((h) =>
    ['lesson_id', 'lessonid', 'lesson', 'id'].includes(h),
  );
  const langIdx = header.findIndex((h) => ['lang', 'language', 'idioma'].includes(h));
  const textIdx = header.findIndex((h) =>
    ['text', 'texto', 'transcript', 'transcricao', 'transcrição', 'content'].includes(h),
  );
  if (idIdx < 0 || langIdx < 0 || textIdx < 0) return [];
  const out: Array<{ lessonId: string; lang: string; text: string }> = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length < 3) continue;
    const lessonId = (r[idIdx] ?? '').trim();
    const lang = (r[langIdx] ?? '').trim().toLowerCase();
    const text = r[textIdx] ?? '';
    if (lessonId && lang) out.push({ lessonId, lang, text });
  }
  return out;
}

describe('CSV parser de transcrições', () => {
  it('parse simples sem quotes', () => {
    const csv = 'lesson_id,lang,text\nl-1,pt,Texto\nl-2,en,Text';
    const r = parseCsv(csv);
    expect(r).toEqual([
      { lessonId: 'l-1', lang: 'pt', text: 'Texto' },
      { lessonId: 'l-2', lang: 'en', text: 'Text' },
    ]);
  });

  it('aceita aliases lessonId / language / texto', () => {
    const csv = 'lessonId,language,texto\nl-1,PT,Olá';
    const r = parseCsv(csv);
    expect(r).toEqual([{ lessonId: 'l-1', lang: 'pt', text: 'Olá' }]);
  });

  it('texto com virgula entre aspas', () => {
    const csv = 'lesson_id,lang,text\nl-1,pt,"Texto, com virgula"';
    const r = parseCsv(csv);
    expect(r[0].text).toBe('Texto, com virgula');
  });

  it('texto com quebra de linha entre aspas', () => {
    const csv = 'lesson_id,lang,text\nl-1,pt,"Linha 1\nLinha 2"';
    const r = parseCsv(csv);
    expect(r[0].text).toBe('Linha 1\nLinha 2');
  });

  it('escape de aspas duplas ""', () => {
    const csv = 'lesson_id,lang,text\nl-1,pt,"diz ""olá"""';
    const r = parseCsv(csv);
    expect(r[0].text).toBe('diz "olá"');
  });

  it('CRLF como separador de linha', () => {
    const csv = 'lesson_id,lang,text\r\nl-1,pt,T1\r\nl-2,en,T2';
    const r = parseCsv(csv);
    expect(r).toHaveLength(2);
  });

  it('skip linhas vazias', () => {
    const csv = 'lesson_id,lang,text\n\nl-1,pt,T1\n\n\nl-2,en,T2';
    const r = parseCsv(csv);
    expect(r).toHaveLength(2);
  });

  it('CSV sem header reconhecido = vazio', () => {
    const csv = 'foo,bar,baz\n1,2,3';
    expect(parseCsv(csv)).toEqual([]);
  });

  it('CSV sem dados (so header) = vazio', () => {
    expect(parseCsv('lesson_id,lang,text')).toEqual([]);
  });

  it('header em portugues funciona', () => {
    const csv = 'id,idioma,transcricao\nl-1,pt,Conteudo';
    const r = parseCsv(csv);
    expect(r).toEqual([{ lessonId: 'l-1', lang: 'pt', text: 'Conteudo' }]);
  });
});

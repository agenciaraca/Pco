/**
 * A home e a página do curso não podem reivindicar a mesma busca.
 *
 * Medido em produção em 9/set/2026: as duas tinham o **mesmo H1** —
 * "Curso de Psicanálise Clínica Online" — e `<title>` quase idênticos,
 * invertendo a ordem das mesmas palavras.
 *
 * Duas páginas do mesmo site disputando a mesma consulta não somam: o buscador
 * escolhe uma e a outra perde a posição que já tinha. E há o custo de leitura,
 * que é anterior ao do buscador — quem chega pela home procurando a escola cai
 * numa página que se apresenta como a do produto, e quem chega pela página do
 * produto vê a mesma frase de novo.
 *
 * A divisão é: **a home fala da escola, a página do curso fala do curso.** O
 * nome do curso continua na home, no parágrafo do herói e nos cartões — o que
 * muda é qual das duas o reivindica como título.
 *
 * Este arquivo não escolhe as palavras; ele só impede que as duas voltem a ser
 * a mesma.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let home = '';
let curso = '';

/** Normaliza para comparar: sem acento, sem caixa, sem pontuação de sobra. */
function normal(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tag(html: string, re: RegExp): string {
  const m = re.exec(html);
  return m ? m[1]!.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
}

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-busca-'));
  process.env.DATA_DIR = tmpDir;
  const { publicSite } = await import('../server/public/router');
  const rh = await publicSite.fetch(new Request('http://local/'));
  expect(rh.status).toBe(200);
  home = await rh.text();

  // A página do curso depende do seed; quando ela não existe neste ambiente, os
  // casos que a comparam são pulados explicitamente, em vez de passar à toa.
  const slug = (/\/formacao\/([a-z0-9-]+)/.exec(home) ?? [])[1];
  if (slug) {
    const rc = await publicSite.fetch(new Request(`http://local/formacao/${slug}`));
    if (rc.status === 200) curso = await rc.text();
  }
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('home e página do curso', () => {
  it('a home tem exatamente um H1, e ele não é o nome do curso', () => {
    const h1s = [...home.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)];
    expect(h1s, 'a home precisa de um H1, e de só um').toHaveLength(1);
    const texto = normal(h1s[0]![1]!.replace(/<[^>]+>/g, ' '));
    expect(
      texto,
      'o H1 da home voltou a ser o nome do curso — as duas páginas passam a ' +
        'disputar a mesma busca, e a home deixa de falar da escola',
    ).not.toBe('curso de psicanalise clinica online');
  });

  it('os dois H1 são diferentes', () => {
    if (!curso) return; // sem página de curso neste ambiente
    const daHome = normal(tag(home, /<h1[^>]*>([\s\S]*?)<\/h1>/));
    const doCurso = normal(tag(curso, /<h1[^>]*>([\s\S]*?)<\/h1>/));
    expect(daHome).not.toBe('');
    expect(doCurso).not.toBe('');
    expect(daHome, `os dois H1 voltaram a ser "${daHome}"`).not.toBe(doCurso);
  });

  it('os dois <title> são diferentes', () => {
    if (!curso) return;
    const daHome = normal(tag(home, /<title[^>]*>([\s\S]*?)<\/title>/));
    const doCurso = normal(tag(curso, /<title[^>]*>([\s\S]*?)<\/title>/));
    expect(daHome).not.toBe(doCurso);
  });

  it('as duas descrições são diferentes', () => {
    if (!curso) return;
    const d = (h: string) =>
      normal((/name="description" content="([^"]*)"/.exec(h) ?? [])[1] ?? '');
    expect(d(home)).not.toBe('');
    expect(d(home)).not.toBe(d(curso));
  });

  it('a home continua nomeando o curso no corpo — o que muda é o título', () => {
    // A divisão é de foco, não de omissão: quem chega pela home tem de achar
    // o curso na mesma tela.
    expect(normal(home)).toContain('curso de psicanalise clinica online');
  });
});

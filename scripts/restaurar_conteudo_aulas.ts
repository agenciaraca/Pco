/**
 * Devolve ao banco o conteúdo integral das aulas.
 *
 * O que aconteceu: a importação do WordPress capturou o conteúdo completo de
 * cada aula E uma descrição cortada em 500 caracteres. Como a tabela `lessons`
 * não tinha coluna para o conteúdo, só a descrição truncada chegou ao Postgres.
 * Produção lê do Postgres, então o aluno lê meia frase — enquanto o texto
 * inteiro dorme em `data/courses.json`, 3,7 MB, desde maio.
 *
 * Este script lê aquele arquivo e preenche `lessons.content`. Casa por id de
 * aula, que é estável entre o arquivo e o banco (ambos vieram do mesmo import).
 *
 * É aditivo e idempotente: nunca apaga conteúdo, nunca toca em `description`, e
 * rodar duas vezes não muda nada na segunda. Por padrão só relata — para gravar,
 * passe `--aplicar`.
 *
 * Uso (no VPS, dentro de ~/ava-pco):
 *   DATABASE_URL=... npx tsx scripts/restaurar_conteudo_aulas.ts            # simula
 *   DATABASE_URL=... npx tsx scripts/restaurar_conteudo_aulas.ts --aplicar  # grava
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getDb, schema } from '../server/db/client';
import { eq, sql } from 'drizzle-orm';

const APLICAR = process.argv.includes('--aplicar');
const DATA_DIR = process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data');
const log = (m: string) => console.log(`[conteudo] ${m}`);

interface AulaJson {
  id?: unknown;
  title?: unknown;
  content?: unknown;
  description?: unknown;
}

interface ModuloJson {
  lessons?: unknown;
}

interface CursoJson {
  id?: unknown;
  title?: unknown;
  modules?: unknown;
}

function comoTexto(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** Extrai (id da aula → conteúdo) de todos os cursos do arquivo. */
function conteudoPorAula(cursos: CursoJson[]): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const curso of cursos) {
    const modulos = Array.isArray(curso.modules) ? (curso.modules as ModuloJson[]) : [];
    for (const m of modulos) {
      const aulas = Array.isArray(m.lessons) ? (m.lessons as AulaJson[]) : [];
      for (const a of aulas) {
        const id = comoTexto(a.id);
        const conteudo = comoTexto(a.content);
        if (id && conteudo.trim().length > 0) mapa.set(id, conteudo);
      }
    }
  }
  return mapa;
}

async function main(): Promise<void> {
  const db = getDb();
  if (!db) {
    log('sem DATABASE_URL — este script grava no Postgres.');
    process.exitCode = 1;
    return;
  }

  const arquivo = path.join(DATA_DIR, 'courses.json');
  let bruto: string;
  try {
    bruto = await fs.readFile(arquivo, 'utf-8');
  } catch {
    log(`não encontrei ${arquivo}`);
    process.exitCode = 1;
    return;
  }

  const parsed = JSON.parse(bruto) as unknown;
  const cursos = (
    Array.isArray(parsed) ? parsed : ((parsed as { items?: unknown }).items ?? [])
  ) as CursoJson[];
  log(`${cursos.length} curso(s) no arquivo`);

  const conteudos = conteudoPorAula(cursos);
  const totalChars = [...conteudos.values()].reduce((s, c) => s + c.length, 0);
  log(`${conteudos.size} aula(s) com conteúdo · ${totalChars.toLocaleString('pt-BR')} caracteres`);

  const noBanco = await db
    .select({
      id: schema.lessons.id,
      courseId: schema.lessons.courseId,
      content: schema.lessons.content,
      description: schema.lessons.description,
    })
    .from(schema.lessons);
  log(`${noBanco.length} aula(s) no banco`);

  let jaTinha = 0;
  let semCorrespondente = 0;
  const aGravar: Array<{ id: string; conteudo: string; ganho: number }> = [];

  for (const linha of noBanco) {
    const conteudo = conteudos.get(linha.id);
    if (!conteudo) {
      semCorrespondente++;
      continue;
    }
    // Conteúdo já gravado não é sobrescrito: pode ter sido editado pelo admin
    // depois, e o arquivo é de maio.
    if (linha.content && linha.content.trim().length > 0) {
      jaTinha++;
      continue;
    }
    aGravar.push({
      id: linha.id,
      conteudo,
      ganho: conteudo.length - (linha.description?.length ?? 0),
    });
  }

  log('');
  log(`a gravar:            ${aGravar.length}`);
  log(`já tinham conteúdo:  ${jaTinha}`);
  log(`sem par no arquivo:  ${semCorrespondente}`);
  if (aGravar.length > 0) {
    const ganhoTotal = aGravar.reduce((s, a) => s + Math.max(0, a.ganho), 0);
    log(`texto devolvido:     ${ganhoTotal.toLocaleString('pt-BR')} caracteres a mais`);
  }

  if (!APLICAR) {
    log('');
    log('SIMULAÇÃO — nada foi gravado. Repita com --aplicar.');
    return;
  }

  let gravadas = 0;
  for (const a of aGravar) {
    await db
      .update(schema.lessons)
      .set({ content: a.conteudo })
      .where(eq(schema.lessons.id, a.id));
    gravadas++;
    if (gravadas % 100 === 0) log(`  ${gravadas}/${aGravar.length}...`);
  }

  const [conferencia] = (await db
    .select({
      comConteudo: sql<number>`count(*) FILTER (WHERE content IS NOT NULL AND content <> '')::int`,
      total: sql<number>`count(*)::int`,
    })
    .from(schema.lessons)) as Array<{ comConteudo: number; total: number }>;

  log('');
  log(`GRAVADO: ${gravadas} aula(s).`);
  log(`No banco agora: ${conferencia.comConteudo} de ${conferencia.total} aulas com conteúdo.`);
}

void main();

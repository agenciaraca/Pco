/**
 * Aplica a um curso o conteúdo de venda verbatim vindo do protótipo de design.
 *
 * O texto é do dono, revisado por ele, e entrou no protótipo aprovado
 * (`docs/design/data/site.js`). Foi recortado para `scripts/conteudo/<slug>.json`
 * contendo **só conteúdo** — de propósito ficaram de fora:
 *
 * - **preço, parcelas** — moram no produto (`/admin/produtos`), não no curso.
 *   O protótipo traz R$ 1.497 como dado de maquete; gravar isso como se fosse
 *   preço criaria uma oferta que ninguém decidiu.
 * - **módulos, aulas, horas** — são a estrutura real do curso. O protótipo diz
 *   "12 módulos · 60 aulas · 560 horas"; o curso em produção tem a contagem
 *   dele. Número de catálogo se conta, não se declara.
 *
 * Seco por padrão: sem `--commit` ele só mostra o que mudaria.
 *
 *   npx tsx scripts/aplicar_conteudo_curso.ts psicanalise-clinica
 *   npx tsx scripts/aplicar_conteudo_curso.ts psicanalise-clinica --commit
 *
 * Contra produção, exporte antes o `DATABASE_URL` do banco certo.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as coursesRepo from '../server/repositories/courses';

async function main() {
  const slug = process.argv[2];
  const commit = process.argv.includes('--commit');
  if (!slug) {
    console.error('uso: aplicar_conteudo_curso.ts <slug> [--commit]');
    process.exit(1);
  }

  const arquivo = resolve(process.cwd(), 'scripts/conteudo', `${slug}.json`);
  let conteudo: Record<string, unknown>;
  try {
    conteudo = JSON.parse(readFileSync(arquivo, 'utf-8'));
  } catch {
    console.error(`sem conteúdo versionado para "${slug}" (esperava ${arquivo})`);
    process.exit(1);
  }

  const cursos = await coursesRepo.listCourses();
  const curso = cursos.find((c) => (c as unknown as { slug?: string }).slug === slug);
  if (!curso) {
    console.error(`curso "${slug}" não existe nesta base (${cursos.length} cursos lidos).`);
    process.exit(1);
  }

  const atual = curso as unknown as Record<string, unknown>;
  const tamanho = (v: unknown) =>
    Array.isArray(v) ? `${v.length} itens` : typeof v === 'string' ? `${v.length} car.` : String(v);

  console.log(`curso: ${String(atual.title)} (id ${String(atual.id)})\n`);
  for (const [k, v] of Object.entries(conteudo)) {
    const antes = atual[k];
    const mudou = JSON.stringify(antes) !== JSON.stringify(v);
    console.log(
      `  ${mudou ? '~' : '='} ${k.padEnd(18)} ${String(antes === undefined ? '—' : tamanho(antes)).padEnd(12)} -> ${tamanho(v)}`,
    );
  }

  if (!commit) {
    console.log('\nensaio. nada gravado. rode de novo com --commit para aplicar.');
    return;
  }

  await coursesRepo.updateCourse(String(atual.id), conteudo as never);
  console.log('\ngravado.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

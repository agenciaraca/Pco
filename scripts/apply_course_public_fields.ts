/**
 * Aplica os campos da PÁGINA PÚBLICA de venda (site SSR `/formacao/:slug`) a
 * partir de `scripts/course-public-fields.json`.
 *
 *   npx tsx scripts/apply_course_public_fields.ts            # dry-run (padrão)
 *   npx tsx scripts/apply_course_public_fields.ts --apply    # grava
 *
 * Passa pelo repositório de cursos, não por SQL cru — assim funciona igual no
 * backend Postgres e no fallback JSON, e o roteamento coluna-x-`meta` fica com
 * quem é dono dele (`pickMetaFields`).
 *
 * Valida cada objeto contra `updateCourseSchema` ANTES de gravar. O Zod aqui
 * não é cinto de segurança redundante: os limites (tldr 600, bullet 200, faq
 * 2000) são exatamente o tipo de coisa que se estoura escrevendo texto, e um
 * campo rejeitado sumiria em silêncio.
 *
 * Idempotente: rodar de novo com o mesmo JSON não muda nada.
 */
import 'dotenv/config';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { updateCourseSchema } from '../shared/schemas';
import * as coursesRepo from '../server/repositories/courses';

const APPLY = process.argv.includes('--apply');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = path.join(HERE, 'course-public-fields.json');

type Fields = Record<string, unknown>;

/** Comparação estrutural — evita reescrever curso já idêntico ao desejado. */
function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

async function main(): Promise<void> {
  const raw = JSON.parse(await fs.readFile(SOURCE, 'utf8')) as Record<string, Fields>;
  const wanted = Object.entries(raw).filter(([slug]) => !slug.startsWith('_'));

  const courses = await coursesRepo.listCourses();
  const bySlug = new Map(courses.map((c) => [c.slug ?? c.id, c]));

  console.log(`fonte: ${path.relative(process.cwd(), SOURCE)}`);
  console.log(`modo : ${APPLY ? 'APLICAR (grava)' : 'dry-run (só mostra)'}`);
  console.log(`cursos no banco: ${courses.length} · no arquivo: ${wanted.length}\n`);

  let changed = 0;
  let skipped = 0;
  let failed = 0;

  for (const [slug, fields] of wanted) {
    const course = bySlug.get(slug);
    if (!course) {
      console.error(`✗ ${slug}: curso não encontrado — nada aplicado`);
      failed++;
      continue;
    }

    const parsed = updateCourseSchema.safeParse(fields);
    if (!parsed.success) {
      console.error(`✗ ${slug}: reprovado na validação`);
      for (const issue of parsed.error.issues) {
        console.error(`    ${issue.path.join('.') || '(raiz)'}: ${issue.message}`);
      }
      failed++;
      continue;
    }

    const current = course as unknown as Fields;
    const diff = Object.entries(parsed.data as Fields).filter(
      ([k, v]) => !sameValue(current[k], v),
    );

    if (diff.length === 0) {
      console.log(`· ${slug}: já está como o arquivo pede`);
      skipped++;
      continue;
    }

    console.log(`→ ${slug}: ${diff.length} campo(s)`);
    for (const [k, v] of diff) {
      const before = current[k] === undefined ? '(vazio)' : JSON.stringify(current[k]).slice(0, 60);
      const after = Array.isArray(v) ? `${v.length} item(ns)` : JSON.stringify(v).slice(0, 60);
      console.log(`    ${k}: ${before} → ${after}`);
    }

    if (APPLY) {
      const saved = await coursesRepo.updateCourse(course.id, parsed.data);
      if (!saved) {
        console.error(`  ✗ ${slug}: updateCourse devolveu null`);
        failed++;
        continue;
      }
      // Relê para confirmar que persistiu de verdade. Este script existe por
      // causa de um bug em que a gravação retornava 200 e descartava os campos.
      const after = (await coursesRepo.findCourse(course.id)) as unknown as Fields | null;
      const lost = diff.filter(([k, v]) => !sameValue(after?.[k], v)).map(([k]) => k);
      if (lost.length) {
        console.error(`  ✗ ${slug}: NÃO persistiu — ${lost.join(', ')}`);
        console.error('    a coluna `courses.meta` existe no banco? (migration 0002)');
        failed++;
        continue;
      }
      console.log('  ✓ gravado e confirmado na releitura');
    }
    changed++;
  }

  console.log(
    `\nresumo: ${changed} com mudança · ${skipped} já em dia · ${failed} com erro` +
      (APPLY ? '' : '\n(dry-run — rode com --apply para gravar)'),
  );
  if (failed) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

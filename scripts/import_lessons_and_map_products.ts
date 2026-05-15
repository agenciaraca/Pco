/**
 * Completa a migração: persiste os 6 cursos LD com módulos/aulas em
 * courses.json e mapeia os 5 produtos WC para os cursos correspondentes.
 *
 * Lê o raw do collect anterior em data/migration/<ts>/raw/portal.json e
 * raw/psi.json. Reusa o último timestamp por default.
 *
 * Uso:
 *   npx tsx scripts/import_lessons_and_map_products.ts [--raw=<dir>] [--dry-run]
 *
 * Decisão: usa o external_course_id LD (numérico, ex: "14839") como
 * course.id no AVA. Isso garante que os 4710 enrollments existentes (que
 * já apontam pra "14839", "8887", "8748", "12245", "13256", "14958") não
 * precisam ser remapeados.
 *
 * Mapeamento produto WC → curso LD por heurística de título (LD pluginsdo portal não preencheram meta `_related_course`).
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const RAW_DIR_ARG = argv.find((a) => a.startsWith('--raw='))?.slice('--raw='.length);
const DRY_RUN = argv.includes('--dry-run');

const log = (m: string) => console.log(`[lessons-products] ${m}`);

// ---------- Tipos enxutos ----------

interface PortalRaw {
  rowsByEntity: {
    course?: Array<Record<string, unknown>>;
    lesson?: Array<Record<string, unknown>>;
    topic?: Array<Record<string, unknown>>;
  };
}

interface PsiRaw {
  rowsByEntity: {
    product?: Array<Record<string, unknown>>;
  };
}

interface Lesson {
  id: string;
  moduleId: string;
  courseId: string;
  title: string;
  durationMinutes: number;
  description?: string;
  isMandatory: boolean;
  order: number;
  status?: 'pending' | 'in_progress' | 'completed' | 'available';
}

interface Module {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  order: number;
  lessons: Lesson[];
}

interface Course {
  id: string;
  slug: string;
  title: string;
  shortTitle: string;
  description: string;
  coverColor: string;
  modules: Module[];
  totalHours: number;
  certificateAvailable: boolean;
  tags?: string[];
}

// ---------- Helpers ----------

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

function asString(v: unknown): string {
  return v == null ? '' : String(v);
}

function asNumber(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// Cor por curso (paleta PCO)
const COURSE_COLOR: Record<string, string> = {
  '14839': '#0097B2', // Psicanálise master — azul principal
  '8887': '#FE9002', // Super Aluno — laranja
  '8748': '#063B49', // Hipnoterapia — azul profundo
  '12245': '#0CC0DF', // Terapia Familiar — ciano
  '13256': '#5CE1E6', // Junguiana — ciano claro
  '14958': '#0097B2', // Treinamento PCO — azul
};

// Heurística product WC → external_course_id LD
function mapProductToCourse(productName: string): string | null {
  const n = productName.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (n.includes('psicanalise') || n.includes('psican')) return '14839';
  if (n.includes('hipno')) return '8748';
  if (n.includes('terapia familiar') || n.includes('sistemica')) return '12245';
  if (n.includes('junguiana') || n.includes('analitica')) return '13256';
  if (n.includes('super aluno')) return '8887';
  if (n.includes('treinamento')) return '14958';
  return null; // Certificado, Extensão etc — sem curso vinculado direto
}

// ---------- Main ----------

async function findLatestRaw(): Promise<string> {
  const root = path.resolve(process.cwd(), 'data/migration');
  const entries = await fs.readdir(root);
  const dumps = entries.filter((e) => /^\d{4}-\d{2}-\d{2}T/.test(e));
  if (dumps.length === 0) throw new Error('Nenhum dump em data/migration/ — rode --collect-only antes');
  dumps.sort();
  return path.join(root, dumps[dumps.length - 1]!);
}

async function main(): Promise<void> {
  const rawDir = RAW_DIR_ARG
    ? path.resolve(process.cwd(), RAW_DIR_ARG)
    : await findLatestRaw();
  log(`raw em: ${rawDir}`);

  const portal: PortalRaw = JSON.parse(
    await fs.readFile(path.join(rawDir, 'raw', 'portal.json'), 'utf8'),
  );
  const psi: PsiRaw = JSON.parse(
    await fs.readFile(path.join(rawDir, 'raw', 'psi.json'), 'utf8'),
  );

  const ldCourses = portal.rowsByEntity.course ?? [];
  const ldLessons = portal.rowsByEntity.lesson ?? [];
  const ldTopics = portal.rowsByEntity.topic ?? [];
  const wcProducts = psi.rowsByEntity.product ?? [];

  log(`raw counts: courses=${ldCourses.length} lessons=${ldLessons.length} topics=${ldTopics.length} products=${wcProducts.length}`);

  // 1) Indexar tópicos por lesson_external_id (cada aula tem N tópicos)
  const topicsByLesson = new Map<string, Array<Record<string, unknown>>>();
  for (const t of ldTopics) {
    const lid = asString(t.lesson_external_id);
    if (!lid) continue;
    if (!topicsByLesson.has(lid)) topicsByLesson.set(lid, []);
    topicsByLesson.get(lid)!.push(t);
  }

  // 2) Indexar aulas por course_external_id
  const lessonsByCourse = new Map<string, Array<Record<string, unknown>>>();
  for (const l of ldLessons) {
    const cid = asString(l.course_external_id);
    if (!cid) continue;
    if (!lessonsByCourse.has(cid)) lessonsByCourse.set(cid, []);
    lessonsByCourse.get(cid)!.push(l);
  }

  // 3) Construir Course[] no formato AVA
  const newCourses: Course[] = [];
  for (const co of ldCourses) {
    const externalId = asString(co.external_course_id);
    const title = stripHtml(asString(co.title)) || `Curso ${externalId}`;
    const slug = asString(co.slug) || slugify(title);
    const lessonsRaw = lessonsByCourse.get(externalId) ?? [];
    const sortedLessons = lessonsRaw.sort(
      (a, b) => asNumber(a.order) - asNumber(b.order),
    );

    // Decisão: um módulo único "Conteúdo Completo" agrupa todas as aulas.
    // Cada lesson tem como description o concat dos tópicos LD daquela aula.
    const lessons: Lesson[] = sortedLessons.map((l, idx) => {
      const lid = asString(l.external_lesson_id);
      const topics = (topicsByLesson.get(lid) ?? [])
        .sort((a, b) => asNumber(a.order) - asNumber(b.order));
      const topicSummary = topics
        .map((t) => stripHtml(asString(t.title)))
        .filter(Boolean)
        .slice(0, 30) // proteção
        .join(' · ');
      return {
        id: `lesson-${lid}`,
        moduleId: `mod-${externalId}`,
        courseId: externalId,
        title: stripHtml(asString(l.title)) || `Aula ${idx + 1}`,
        durationMinutes: 15, // valor genérico — LD não expõe duração direta
        description: topicSummary
          ? `Tópicos: ${topicSummary}`
          : stripHtml(asString(l.excerpt) || asString(l.content_html)).slice(0, 500),
        isMandatory: true,
        order: idx + 1,
        status: 'available',
      };
    });

    const module: Module = {
      id: `mod-${externalId}`,
      courseId: externalId,
      title: 'Conteúdo Completo',
      description: `Aulas do curso "${title}"`,
      order: 1,
      lessons,
    };

    const totalHours = Math.max(1, Math.round((lessons.length * 15) / 60));
    const description = stripHtml(asString(co.excerpt) || asString(co.content_html)).slice(0, 800);

    newCourses.push({
      id: externalId, // usa external LD id como interno
      slug,
      title,
      shortTitle: title.length > 40 ? title.slice(0, 37) + '...' : title,
      description: description || title,
      coverColor: COURSE_COLOR[externalId] ?? '#0097B2',
      modules: [module],
      totalHours,
      certificateAvailable: true,
      tags: ['importado-ld', `course-${externalId}`],
    });
  }

  log('cursos AVA gerados:');
  for (const c of newCourses) {
    const totalLessons = c.modules.reduce((acc, m) => acc + m.lessons.length, 0);
    log(`  ${c.id} (${c.title.slice(0, 50)}): ${totalLessons} aulas, ${c.totalHours}h`);
  }

  // 4) Mapping product → course
  const productMap: Record<string, { wcProductId: string; courseId: string | null; courseTitle: string | null }> = {};
  for (const p of wcProducts) {
    const pid = asString(p.external_product_id);
    const name = asString(p.name);
    const courseId = mapProductToCourse(name);
    const courseTitle = courseId ? newCourses.find((c) => c.id === courseId)?.title ?? null : null;
    productMap[pid] = {
      wcProductId: asString(p.wc_product_id),
      courseId,
      courseTitle,
    };
  }

  log('mapping product → curso:');
  for (const [pid, m] of Object.entries(productMap)) {
    const name = asString(wcProducts.find((p) => asString(p.external_product_id) === pid)?.name);
    log(`  ${pid} "${name.slice(0, 40)}" → ${m.courseId ?? '(sem curso)'}`);
  }

  // 5) Persistir
  if (DRY_RUN) {
    log('DRY_RUN=1 — não grava nada');
    return;
  }

  // 5a) courses.json — preserva cursos seed que não conflitam com LD ids
  const coursesPath = path.resolve(process.cwd(), 'data/courses.json');
  const existingCourses: Course[] = JSON.parse(await fs.readFile(coursesPath, 'utf8'));
  const ldIds = new Set(newCourses.map((c) => c.id));
  const keptSeed = existingCourses.filter((c) => !ldIds.has(c.id));
  const finalCourses = [...newCourses, ...keptSeed];
  await fs.writeFile(coursesPath, JSON.stringify(finalCourses, null, 2), 'utf8');
  log(`courses.json: ${finalCourses.length} cursos (${newCourses.length} LD + ${keptSeed.length} seed preservado)`);

  // 5b) data/migration/product-to-course-map.json
  const mapPath = path.resolve(process.cwd(), 'data/migration/product-to-course-map.json');
  await fs.writeFile(mapPath, JSON.stringify(productMap, null, 2), 'utf8');
  log(`product-to-course-map.json salvo em ${mapPath}`);

  // 5c) atualizar payment-products.json com refId
  const productsPath = path.resolve(process.cwd(), 'data/payment-products.json');
  const products = JSON.parse(await fs.readFile(productsPath, 'utf8')) as Array<{
    id: string;
    metadata?: { wcProductId?: string; externalProductId?: string };
    refId?: string | null;
    [k: string]: unknown;
  }>;
  let linked = 0;
  for (const p of products) {
    const wcId = p.metadata?.wcProductId ?? p.metadata?.externalProductId;
    if (!wcId) continue;
    const m = productMap[wcId];
    if (m?.courseId) {
      p.refId = m.courseId;
      linked++;
    }
  }
  await fs.writeFile(productsPath, JSON.stringify(products, null, 2), 'utf8');
  log(`payment-products.json: ${linked} produtos com refId atualizado`);

  log('==== concluído ====');
}

main().catch((err) => {
  console.error('[lessons-products] erro:', err);
  process.exit(1);
});

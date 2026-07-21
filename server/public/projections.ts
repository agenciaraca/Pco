/**
 * Camada de PROJEÇÃO PÚBLICA — o coração do isolamento público × restrito.
 *
 * Regra inviolável: nenhuma página pública recebe um row cru do banco. Tudo
 * passa por um whitelist explícito aqui. Assim é IMPOSSÍVEL vazar PII de aluno,
 * matrícula, custo interno, rascunho ou qualquer dado operacional para o front
 * público — mesmo que um campo novo apareça no modelo, ele só é exposto se for
 * adicionado de propósito a uma projeção.
 *
 * Gate de visibilidade pública de curso: `active !== false` E existe um produto
 * `kind='course'` ativo apontando para ele. Curso sem produto ativo ou marcado
 * inativo NUNCA aparece no site público (mesma regra do sitemap existente).
 */

import * as coursesRepo from '../repositories/courses';
import * as productsRepo from '../payments/products-repo';

type Product = Awaited<ReturnType<typeof productsRepo.listActive>>[number];

// ---- helpers de leitura segura (backend JSON ou DB, campos opcionais) ----
type Row = Record<string, unknown>;
const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() !== '' ? v : undefined;
const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;
const bool = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined);
const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [];

export function fmtBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export interface PublicCourseSummary {
  id: string;
  slug: string;
  title: string;
  shortTitle: string;
  description: string;
  coverImageUrl?: string;
  coverColor?: string;
  totalHours: number;
  tags: string[];
  badge?: string;
  tagline?: string;
  priceCents: number | null;
  priceFormatted: string | null;
  installments: number | null;
  installmentFormatted: string | null;
  priceNote?: string;
}

export interface PublicFaq {
  q: string;
  a: string;
}
export interface PublicCurriculumItem {
  n: string;
  title: string;
  desc: string;
}

export interface PublicCourse extends PublicCourseSummary {
  tldr?: string;
  level?: string;
  language: string;
  certificateAvailable: boolean;
  learningOutcomes: string[];
  forWhom: string[];
  faqs: PublicFaq[];
  curriculum: PublicCurriculumItem[];
  instructorName?: string;
  instructorBio?: string;
  instructorPhotoUrl?: string;
  modules?: number;
  lessons?: number;
}

/** Projeta um curso + produto no sumário público (whitelist). */
function toSummary(c: Row, product: Product | undefined): PublicCourseSummary {
  const priceCents = product ? (num((product as unknown as Row).priceCents) ?? null) : null;
  const installments = priceCents != null ? 12 : null;
  return {
    id: String(c.id),
    slug: str(c.slug) ?? String(c.id),
    title: str(c.title) ?? 'Curso',
    shortTitle: str(c.shortTitle) ?? str(c.title) ?? 'Curso',
    description: str(c.description) ?? '',
    coverImageUrl: str(c.coverImageUrl),
    coverColor: str(c.coverColor),
    totalHours: num(c.totalHours) ?? 0,
    tags: strArr(c.tags),
    badge: str(c.badge),
    tagline: str(c.tagline),
    priceCents,
    priceFormatted: priceCents != null ? fmtBRL(priceCents) : null,
    installments,
    installmentFormatted:
      priceCents != null && installments ? fmtBRL(Math.round(priceCents / installments)) : null,
    priceNote: str(c.priceNote) ?? 'condições no ato da matrícula',
  };
}

/** Projeta um curso na página pública completa (whitelist estendido). */
function toFull(c: Row, product: Product | undefined): PublicCourse {
  const faqsRaw = Array.isArray(c.faqs) ? (c.faqs as Row[]) : [];
  const currRaw = Array.isArray(c.curriculum) ? (c.curriculum as Row[]) : [];
  return {
    ...toSummary(c, product),
    tldr: str(c.tldr),
    level: str(c.level) ?? 'Formação profissional',
    language: str(c.language) ?? 'pt-BR',
    certificateAvailable: bool(c.certificateAvailable) ?? true,
    learningOutcomes: strArr(c.learningOutcomes),
    forWhom: strArr(c.forWhom),
    faqs: faqsRaw.map((f) => ({ q: str(f.q) ?? '', a: str(f.a) ?? '' })).filter((f) => f.q && f.a),
    curriculum: currRaw
      .map((m, i) => ({
        n: str(m.n) ?? String(i + 1).padStart(2, '0'),
        title: str(m.title) ?? '',
        desc: str(m.desc) ?? '',
      }))
      .filter((m) => m.title),
    instructorName: str(c.instructorName),
    instructorBio: str(c.instructorBio),
    instructorPhotoUrl: str(c.instructorPhotoUrl),
    modules: num(c.modules),
    lessons: num(c.lessons),
  };
}

/** Mapa courseId -> produto 'course' ativo. */
async function activeCourseProducts(): Promise<Map<string, Product>> {
  const products = await productsRepo.listActive();
  const map = new Map<string, Product>();
  for (const p of products) {
    const row = p as unknown as Row;
    if (row.kind === 'course' && str(row.refId) && row.active !== false) {
      map.set(String(row.refId), p);
    }
  }
  return map;
}

/** Cursos visíveis no site público (ativos + com produto ativo). */
export async function listPublicCourses(): Promise<PublicCourseSummary[]> {
  const [courses, productMap] = await Promise.all([
    coursesRepo.listCourses(),
    activeCourseProducts(),
  ]);
  return (courses as unknown as Row[])
    .filter((c) => c.active !== false && productMap.has(String(c.id)))
    .map((c) => toSummary(c, productMap.get(String(c.id))));
}

/** Página pública de um curso por slug. Retorna null se não for público. */
export async function getPublicCourseBySlug(slug: string): Promise<PublicCourse | null> {
  const [courses, productMap] = await Promise.all([
    coursesRepo.listCourses(),
    activeCourseProducts(),
  ]);
  const match = (courses as unknown as Row[]).find(
    (c) =>
      (str(c.slug) ?? String(c.id)) === slug && c.active !== false && productMap.has(String(c.id)),
  );
  if (!match) return null;
  return toFull(match, productMap.get(String(match.id)));
}

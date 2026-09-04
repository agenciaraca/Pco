/**
 * Camada de PROJEÇÃO PÚBLICA — o coração do isolamento público × restrito.
 *
 * Regra inviolável: nenhuma página pública recebe um row cru do banco. Tudo
 * passa por um whitelist explícito aqui. Assim é IMPOSSÍVEL vazar PII de aluno,
 * matrícula, custo interno, rascunho ou qualquer dado operacional para o front
 * público — mesmo que um campo novo apareça no modelo, ele só é exposto se for
 * adicionado de propósito a uma projeção.
 *
 * Gate de visibilidade pública de curso: ver `isPubliclyListed()` abaixo. O
 * produto ativo é OPCIONAL e só decide se a página mostra preço — não esconde
 * o curso. (Este cabeçalho já afirmou que o produto era obrigatório; nunca foi,
 * e a divergência entre comentário e código custou tempo em 16/ago/2026.)
 */

import { isPubliclyListed } from '../../shared/visibilidade';
import { parcelasPara, valorDaParcelaCents } from '../../shared/parcelamento';
import * as coursesRepo from '../repositories/courses';
import * as productsRepo from '../payments/products-repo';
import * as newsRepo from '../repositories/news';
import * as certificatesRepo from '../repositories/certificates';
import * as reviewsStore from '../reviews/store';

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

/**
 * Degradação graciosa: o site público NUNCA pode dar 500 por erro de leitura
 * (ex.: tabela ausente no DB). Loga e devolve o fallback.
 */
async function safe<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      `[public-site] leitura falhou (${label}):`,
      err instanceof Error ? err.message : err,
    );
    return fallback;
  }
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
  /**
   * Contagens, não conteúdo. Subiram do curso completo para o resumo em
   * 30/ago/2026, porque é o que faz o cartão da lista dizer algo: "12 módulos ·
   * 48 aulas · 20h" informa; um quadrado colorido com o título, não.
   *
   * Só o número atravessa — nenhum texto de aula entra aqui. Ver
   * `server/access/conteudo-aula.ts`.
   */
  modules: number;
  lessons: number;
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

export interface PublicHighlight {
  title: string;
  note?: string;
}
export interface PublicSection {
  title: string;
  subtitle?: string;
  paras: string[];
  cta: boolean;
}
export interface PublicJornadaItem {
  title: string;
  subtitle?: string;
  text: string;
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
  /**
   * Faixa de tempo para concluir, exibida como "Acesso 4-16 meses".
   *
   * NAO e o mesmo que `accessMonths`, que expira a matricula. Aqui e ritmo de
   * estudo declarado na pagina de venda; la e o portao que corta o acesso. Um
   * curso pode dizer "4 a 16 meses" e nao expirar nada.
   */
  monthsMin?: number;
  monthsMax?: number;
  highlights: PublicHighlight[];
  sections: PublicSection[];
  jornada: PublicJornadaItem[];
  promoNote?: string;
}

/** Projeta um curso + produto no sumário público (whitelist). */
function toSummary(c: Row, product: Product | undefined): PublicCourseSummary {
  const priceCents = product ? (num((product as unknown as Row).priceCents) ?? null) : null;
  // O número de parcelas sai de `shared/parcelamento.ts`, que é o mesmo módulo
  // lido pelo gateway. Era `12` fixo aqui, enquanto o pedido enviado ao
  // Pagar.me oferecia só 1x — a vitrine prometia o que o checkout não fazia.
  const installments = priceCents != null ? parcelasPara(priceCents) : null;

  // A origem varia: às vezes o curso traz os módulos como lista, às vezes só a
  // contagem já somada. Contar a lista quando ela existe, e cair no número
  // pronto quando não — o cartão não pode mostrar "0 módulos" por causa do
  // formato de quem chamou.
  const modulosLista = Array.isArray(c.modules) ? (c.modules as Row[]) : null;
  const modulos = modulosLista ? modulosLista.length : (num(c.modules) ?? 0);
  const aulas = modulosLista
    ? modulosLista.reduce(
        (total, m) => total + (Array.isArray(m.lessons) ? (m.lessons as unknown[]).length : 0),
        0,
      )
    : (num(c.lessons) ?? 0);

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
      priceCents != null && installments
        ? fmtBRL(valorDaParcelaCents(priceCents, installments))
        : null,
    priceNote: str(c.priceNote) ?? 'condições no ato da matrícula',
    modules: modulos,
    lessons: aulas,
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
    monthsMin: num(c.monthsMin),
    monthsMax: num(c.monthsMax),
    highlights: (Array.isArray(c.highlights) ? (c.highlights as Row[]) : [])
      .map((h) => ({ title: str(h.title) ?? '', note: str(h.note) }))
      .filter((h) => h.title),
    sections: (Array.isArray(c.sections) ? (c.sections as Row[]) : [])
      .map((x) => ({
        title: str(x.title) ?? '',
        subtitle: str(x.subtitle),
        paras: strArr(x.paras),
        cta: x.cta === true,
      }))
      .filter((x) => x.title && x.paras.length > 0),
    jornada: (Array.isArray(c.jornada) ? (c.jornada as Row[]) : [])
      .map((j) => ({
        title: str(j.title) ?? '',
        subtitle: str(j.subtitle),
        text: str(j.text) ?? '',
      }))
      .filter((j) => j.title && j.text),
    promoNote: str(c.promoNote),
  };
}

/**
 * Reexportado de `shared/visibilidade.ts`, que passou a ser a casa da regra.
 *
 * Ela vivia aqui, e o comentário dizia ser o portão único — mas o catálogo do
 * SPA nunca passou por ele: filtrava por "tem produto ativo", então curso
 * marcado `publicListed: false` sumia do site público e continuava na
 * prateleira do `/catalogo`. Movida para `shared/` para que servidor e
 * navegador leiam o mesmo código, em vez de duas regras que discordam.
 *
 * O reexport mantém o import antigo funcionando — aditivo, não destrutivo.
 */
export { isPubliclyListed };

/**
 * Números da home — medidos, nunca declarados.
 *
 * O protótipo aprovado traz uma barra com "+1000 alunos formados", "+7 anos de
 * mercado", "96% de satisfação" e o selo RNTP, e o hero repete "4,7/5 ·
 * avaliação dos alunos". Três desses quatro números não tinham medição atrás.
 *
 * Não é preciosismo: a mesma sessão que desenhou isso já tinha tirado quatro
 * estatísticas inventadas da página `/ava-pco`, com o motivo escrito no código
 * — em página de venda, afirmação de resultado a quem ainda vai comprar é
 * publicidade enganosa (CDC, art. 37). O que estava no site SSR passou batido
 * e continuou no ar.
 *
 * Então:
 * - **avaliação** sai das avaliações reais (só aluno matriculado avalia) e
 *   **anda com a base**: "4,8 · 37 avaliações". Sem avaliação, some.
 * - **formados** é a contagem de certificados emitidos. Sem certificado, some.
 * - **anos** vem de `ORG.founded`, calculado — não escrito à mão, senão
 *   envelhece sozinho.
 * - **96% de satisfação** não entra: não existe pesquisa de satisfação neste
 *   sistema. Número sem medição não vira meta; vira travessão, e em página de
 *   venda vira ausência.
 * - **aulas** conta as aulas dos cursos publicamente listados. Entrou em
 *   3/set/2026 porque a home afirmava "+100 aulas exclusivas" — número do site
 *   antigo, e **menor que a realidade**: são 590 aulas. Medir aqui é o caso
 *   raro em que a honestidade também vende melhor.
 */
export interface NumerosDoSite {
  /** Média e base das avaliações; null quando ninguém avaliou ainda. */
  avaliacao: { media: number; total: number } | null;
  /** Certificados emitidos; null quando nenhum foi emitido. */
  formados: number | null;
  /** Anos completos desde a fundação. */
  anos: number | null;
  /** Aulas nos cursos publicamente listados; null quando não há nenhuma. */
  aulas: number | null;
}

export async function numerosDoSite(fundadoEm?: string): Promise<NumerosDoSite> {
  const avaliacao = await safe(
    'reviews',
    async () => {
      const todas = await reviewsStore.listAll();
      const validas = todas.filter((r) => r.rating >= 1 && r.rating <= 5);
      if (validas.length === 0) return null;
      const soma = validas.reduce((acc, r) => acc + r.rating, 0);
      return {
        media: Math.round((soma / validas.length) * 10) / 10,
        total: validas.length,
      };
    },
    null as NumerosDoSite['avaliacao'],
  );

  const formados = await safe(
    'certificates',
    async () => {
      const todos = await certificatesRepo.listAllCertificates();
      const emitidos = todos.filter((c) => c.status === 'issued').length;
      return emitidos > 0 ? emitidos : null;
    },
    null as number | null,
  );

  const ano = Number(fundadoEm);
  const anos =
    Number.isFinite(ano) && ano > 1900 ? Math.max(0, new Date().getFullYear() - ano) : null;

  const aulas = await safe(
    'lessons',
    async () => {
      // Só o que o visitante pode de fato encontrar no site: contar o curso
      // interno de operadores inflaria o número com material que ninguém
      // compra.
      const cursos = (await coursesRepo.listCourses()) as unknown as Row[];
      const total = cursos
        .filter(isPubliclyListed)
        .reduce(
          (soma, c) =>
            soma +
            ((c.modules as Array<{ lessons?: unknown[] }> | undefined) ?? []).reduce(
              (s, m) => s + (m.lessons?.length ?? 0),
              0,
            ),
          0,
        );
      return total > 0 ? total : null;
    },
    null as number | null,
  );

  return { avaliacao, formados, anos, aulas };
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
  return safe(
    'courses',
    async () => {
      const [courses, productMap] = await Promise.all([
        coursesRepo.listCourses(),
        activeCourseProducts(),
      ]);
      // Produto/preço é opcional: se houver produto ativo vinculado, exibe
      // preço; senão, o curso aparece sem preço.
      return (courses as unknown as Row[])
        .filter(isPubliclyListed)
        .map((c) => toSummary(c, productMap.get(String(c.id))));
    },
    [],
  );
}

/** Página pública de um curso por slug. Retorna null se não for público. */
export async function getPublicCourseBySlug(slug: string): Promise<PublicCourse | null> {
  return safe(
    `course:${slug}`,
    async () => {
      const [courses, productMap] = await Promise.all([
        coursesRepo.listCourses(),
        activeCourseProducts(),
      ]);
      const match = (courses as unknown as Row[]).find(
        (c) => (str(c.slug) ?? String(c.id)) === slug && isPubliclyListed(c),
      );
      if (!match) return null;
      return toFull(match, productMap.get(String(match.id)));
    },
    null,
  );
}

/** Slug público de um curso ativo pelo id (p/ redirect 301 de URLs antigas). */
export async function getPublicCourseSlugById(id: string): Promise<string | null> {
  return safe(
    `courseSlug:${id}`,
    async () => {
      const courses = (await coursesRepo.listCourses()) as unknown as Row[];
      const match = courses.find((c) => String(c.id) === id && isPubliclyListed(c));
      return match ? (str(match.slug) ?? String(match.id)) : null;
    },
    null,
  );
}

// ============================ POSTS (blog) ============================

/** Slug estável derivado do título (posts importados não têm slug próprio). */
export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

export interface PublicPostSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category?: string;
  tags: string[];
  coverColor?: string;
  authorName: string;
  publishedAt: string;
  readingMinutes: number;
}
export interface PublicPost extends PublicPostSummary {
  /** Corpo já em HTML seguro para render (CSP bloqueia scripts/handlers inline). */
  bodyHtml: string;
  relatedCourseSlugs: string[];
}

function readingMinutes(text: string): number {
  const words = text
    .replace(/<[^>]+>/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** Corpo: se já vier com tags HTML mantém; senão quebra parágrafos por linha. */
function bodyToHtml(raw: string): string {
  if (/<\/?(p|h[1-6]|ul|ol|blockquote|div|br)\b/i.test(raw)) return raw;
  return raw
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

function toPostSummary(p: Row): PublicPostSummary {
  const title = str(p.title) ?? 'Artigo';
  return {
    id: String(p.id),
    slug: slugify(title) || String(p.id),
    title,
    excerpt: str(p.excerpt) ?? '',
    category: str(p.category),
    tags: strArr(p.tags),
    coverColor: str(p.coverColor),
    authorName: str(p.authorName) ?? 'Equipe PCO',
    publishedAt: str(p.publishedAt) ?? '',
    readingMinutes: readingMinutes(str(p.body) ?? str(p.excerpt) ?? ''),
  };
}

/** Posts públicos, mais recentes primeiro. */
export async function listPublicPosts(): Promise<PublicPostSummary[]> {
  return safe(
    'posts',
    async () => {
      const posts = (await newsRepo.listNews()) as unknown as Row[];
      return posts
        .map(toPostSummary)
        .filter((p) => p.title && p.publishedAt)
        .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
    },
    [],
  );
}

/** Post público por slug (deriva slug do título; primeiro match vence). */
export async function getPublicPostBySlug(slug: string): Promise<PublicPost | null> {
  return safe(
    `post:${slug}`,
    async () => {
      const posts = (await newsRepo.listNews()) as unknown as Row[];
      const match = posts.find((p) => (slugify(str(p.title) ?? '') || String(p.id)) === slug);
      if (!match) return null;
      const relatedIds = Array.isArray(match.relatedCourseIds)
        ? (match.relatedCourseIds as unknown[]).map(String)
        : [];
      let relatedCourseSlugs: string[] = [];
      if (relatedIds.length) {
        const courses = (await coursesRepo.listCourses()) as unknown as Row[];
        relatedCourseSlugs = courses
          .filter((c) => relatedIds.includes(String(c.id)) && isPubliclyListed(c))
          .map((c) => str(c.slug) ?? String(c.id));
      }
      return {
        ...toPostSummary(match),
        bodyHtml: bodyToHtml(str(match.body) ?? ''),
        relatedCourseSlugs,
      };
    },
    null,
  );
}

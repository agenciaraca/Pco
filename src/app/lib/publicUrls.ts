// URLs do site público (SSR, servido pelo Hono em server/public/router.ts).
//
// Essas rotas NÃO existem no React Router: são renderizadas no servidor, antes
// do fallback do SPA. Por isso os links para elas precisam ser <a href>, e não
// <Link to> — navegação client-side cairia no NotFound do SPA.

/**
 * Página pública de venda de um curso.
 *
 * Com slug conhecido aponta direto para a URL amigável `/formacao/:slug`.
 * Sem slug, usa `/curso-preview/:id`, que o servidor resolve com 301 para a
 * URL canônica (router.ts) — evita chutar um slug errado e cair no 404.
 */
export function publicCourseUrl(course: { id: string; slug?: string | null }): string {
  const slug = course.slug?.trim();
  return slug
    ? `/formacao/${encodeURIComponent(slug)}`
    : `/curso-preview/${encodeURIComponent(course.id)}`;
}

/** Listagem pública de formações. */
export const PUBLIC_COURSES_URL = '/formacoes';

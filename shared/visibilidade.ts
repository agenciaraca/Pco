/**
 * O portão de visibilidade pública de curso — agora de verdade único.
 *
 * A regra nasceu em `server/public/projections.ts` com um comentário que dizia
 * ser o "ÚNICO portão... todo caminho que expõe curso ao visitante anônimo —
 * catálogo, página de venda, redirect, sitemap, llms.txt — passa por aqui".
 * Isso valia para o site SSR e para `/public/checkout`. **Não valia para o
 * catálogo do SPA**, que filtrava por outro critério: "existe produto ativo
 * apontando para este curso".
 *
 * O efeito: um curso marcado `publicListed: false` sumia do site público e
 * tinha a compra barrada no checkout, mas continuava na prateleira do
 * `/catalogo`. Quem clicasse ali seria mandado para um checkout que responde
 * 404 — e a escola pensaria ter tirado o curso de venda.
 *
 * Duas regras vivendo em dois lugares acabam discordando. Por isso a função
 * mora aqui, onde servidor e navegador leem o mesmo código.
 */

/** O mínimo que a regra precisa saber. Aceita qualquer objeto mais rico. */
export interface CursoVisivel {
  /** O aluno matriculado consegue acessar o curso no LMS. */
  active?: boolean;
  /** O curso aparece para quem ainda não está matriculado. */
  publicListed?: boolean;
}

/**
 * Curso inativo fica fora do site — não faz sentido vender o que ninguém pode
 * cursar. `publicListed: false` tira só da vitrine, preservando o acesso de
 * quem já comprou.
 *
 * **Ausência de qualquer uma das flags vale `true`**: a regra é aditiva, e
 * nenhum curso existente muda de comportamento sem alguém marcar de propósito.
 */
export function isPubliclyListed(c: CursoVisivel | Record<string, unknown>): boolean {
  const r = c as CursoVisivel;
  return r.active !== false && r.publicListed !== false;
}

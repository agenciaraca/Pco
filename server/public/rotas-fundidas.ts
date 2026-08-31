/**
 * Rotas antigas que passaram a ter um dono único (30/ago/2026), e que por isso
 * respondem 301 para o endereço novo.
 *
 * O mapa morava dentro de `server/dev.ts`, fora do alcance de qualquer teste.
 * Isso escondeu um erro caro: o botão "Matricular-se" da página de venda
 * apontava para `/catalogo`, que passou a ser um 301 de volta para a lista de
 * cursos. O visitante que decidia comprar era devolvido ao catálogo — e o
 * `/checkout`, que funciona, não tinha um único link apontando para ele.
 *
 * Vive aqui para que `test/links-internos.test.ts` possa cobrar o que ninguém
 * cobrava: nenhum link do site pode apontar para um endereço que redireciona.
 */
export const ROTAS_FUNDIDAS: Record<string, string> = {
  '/catalogo': '/formacoes',
  '/comparar': '/formacoes',
  '/landing': '/ava-pco',
};

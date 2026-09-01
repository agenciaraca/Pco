/**
 * Decodifica entidades HTML em texto puro.
 *
 * Existe porque o WordPress devolve o título já **renderizado** — isto é,
 * escapado para HTML. Ele veio assim pela API do LearnDash, foi gravado assim,
 * e o React (que escapa de novo na hora de exibir, e faz certo) mostrava para
 * o aluno, na lista de aulas, coisas como:
 *
 *     A psicoterapia pode dar &#8220;errado&#8221;?
 *     2° Módulo &#8211; Epidemiologia
 *
 * O lugar de desfazer isso é na entrada, não na exibição: título é texto, e
 * quem guarda texto guarda texto. Desescapar na hora de mostrar exigiria
 * `dangerouslySetInnerHTML` em toda tela que exibe título — trocar um defeito
 * visual por uma porta de XSS.
 *
 * `&amp;` é desfeito **por último**, de propósito: `&amp;lt;` significa o texto
 * literal `&lt;`, e desfazer na ordem errada o transformaria em `<`.
 */
const NOMEADAS: Record<string, string> = {
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
  ldquo: '\u201c',
  rdquo: '\u201d',
  lsquo: '\u2018',
  rsquo: '\u2019',
  hellip: '\u2026',
  mdash: '\u2014',
  ndash: '\u2013',
};

export function decodificarEntidades(texto: string): string {
  if (!texto || !texto.includes('&')) return texto;

  const semNumericas = texto
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)));

  const semNomeadas = semNumericas.replace(/&([a-z]+);/gi, (inteiro, nome: string) => {
    const achou = NOMEADAS[nome.toLowerCase()];
    // Entidade que não conhecemos fica como está: inventar tradução seria pior
    // que deixar visível que há algo a traduzir.
    return achou ?? inteiro;
  });

  return semNomeadas.replace(/&amp;/gi, '&');
}

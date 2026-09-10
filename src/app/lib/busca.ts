/**
 * Comparação de texto para busca em tela, sem acento e sem caixa.
 *
 * ## Por que existe, e por que num arquivo só
 *
 * Em 10/set/2026 a importação do LMS antigo encheu duas telas de uma vez: a
 * biblioteca passou a ter 108 itens e os podcasts, 43. As duas ganharam campo
 * de busca no mesmo dia, e escrever a normalização duas vezes é exatamente o
 * que este projeto já viu dar errado em outros lugares — duas cópias da mesma
 * regra acabam discordando, e quem paga é quem está procurando.
 *
 * ## As duas coisas que a função tem de fazer, e a segunda é a que se esquece
 *
 * O acervo é de psicanálise: "Arquétipos", "Psicanálise", "Melancolia". No
 * celular quase ninguém digita o acento, então o **termo** precisa ser
 * normalizado. Mas o **alvo** também: quem digita `Arquétipos` com acento
 * deixaria de casar com um título já normalizado, e a busca falharia
 * justamente para quem escreveu certo.
 *
 * Por isso `combina()` normaliza os dois lados — e é ela que as telas usam, em
 * vez de chamarem `semAcento` por conta própria e esquecerem uma das pontas.
 */

/**
 * Minúsculas, sem acento, sem espaço nas bordas.
 *
 * `NFD` separa a letra do acento, e `[\u0300-\u036f]` é o bloco das marcas
 * combinantes que sobram. **O intervalo vai por escape de propósito:** com os
 * caracteres literais ele fica invisível no editor, e quem for mexer não vê o
 * que está apagando.
 */
export function semAcento(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * O termo aparece em algum dos campos?
 *
 * Termo vazio combina com tudo — quem não digitou nada não está filtrando, e
 * devolver lista vazia aí esconderia o acervo inteiro.
 */
export function combina(termo: string, ...campos: Array<string | undefined | null>): boolean {
  const t = semAcento(termo);
  if (!t) return true;
  return semAcento(campos.filter(Boolean).join(' ')).includes(t);
}

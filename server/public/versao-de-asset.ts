/**
 * A URL do script do site carrega a impressão digital do próprio script.
 *
 * **O defeito que isto fecha custou vendas, e não deu erro em lugar nenhum.**
 * O HTML do site é servido sem `Cache-Control` — cada visita traz a página
 * nova. O script vinha de `/_pub/site.js`, endereço FIXO, com
 * `max-age=3600`. Nas horas seguintes a um deploy que mexesse nos dois, o
 * navegador de quem já tinha visitado montava a página nova por cima do
 * script velho.
 *
 * Em 7/set/2026 o checkout passou a exigir data de nascimento e endereço. Quem
 * tinha o script anterior em cache via os campos novos na tela, preenchia, e o
 * script velho montava um corpo sem eles — o servidor respondia
 * *"Informe a data de nascimento"* sobre um campo visivelmente preenchido, no
 * exato momento de pagar. Não havia como a pessoa resolver aquilo, e não havia
 * erro em log nenhum: do lado do servidor era um 400 de validação como outro
 * qualquer.
 *
 * Com a impressão digital no endereço, uma página só pode rodar o script com
 * que foi servida: conteúdo diferente é URL diferente, e URL que o navegador
 * nunca viu ele vai buscar. É o mesmo que o Vite faz com o bundle do app.
 */
import { createHash } from 'node:crypto';

/** Oito hexadecimais bastam: o que se quer é que MUDE, não que seja único. */
export function impressaoDigital(conteudo: string): string {
  return createHash('sha256').update(conteudo, 'utf8').digest('hex').slice(0, 8);
}

/**
 * Monta `/_pub/v/<impressão>/site.js`.
 *
 * Duas escolhas de forma que não são gosto:
 *
 * - **A impressão vai no CAMINHO, não em `?v=`.** Proxy configurado para
 *   ignorar query string em arquivo estático serviria a cópia velha do mesmo
 *   jeito — e é justamente de proxy e de cache que se está falando aqui.
 * - **Ela é um SEGMENTO inteiro**, não um pedaço do nome do arquivo. O
 *   roteador casa parâmetro por segmento; `site.:v.js` não casa nada, e o
 *   sintoma seria um 404 no script do site inteiro.
 */
export function urlDoSiteJs(conteudo: string): string {
  return `/_pub/v/${impressaoDigital(conteudo)}/site.js`;
}

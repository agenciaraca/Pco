/**
 * Análise e supervisão são OPCIONAIS. Isto não é preferência de negócio: é o
 * que a lei exige, e por isso mora no código e não só no texto da página.
 *
 * Condicionar a venda de um curso à contratação de análise ou supervisão é
 * **venda casada** — prática expressamente vedada pelo Código de Defesa do
 * Consumidor:
 *
 * > Lei nº 8.078/1990 (CDC), art. 39, I — "É vedado ao fornecedor de produtos
 * > ou serviços, dentre outras práticas abusivas: I - condicionar o fornecimento
 * > de produto ou de serviço ao fornecimento de outro produto ou serviço, bem
 * > como, sem justa causa, a limites quantitativos".
 *
 * O mesmo ato é infração à ordem econômica pela Lei nº 12.529/2011, art. 36,
 * § 3º, XVIII — "subordinar a venda de um bem à aquisição de outro ou à
 * utilização de um serviço". E cláusula contratual que imponha essa condição é
 * nula de pleno direito pelo art. 51, IV, do CDC.
 *
 * Consequências práticas dentro do produto, que os testes cobram:
 *
 * 1. Concluir curso, receber certificado e manter matrícula **nunca** podem
 *    depender de sessão contratada.
 * 2. A oferta de sessões pode aparecer ao lado do curso, mas nunca como
 *    requisito, etapa obrigatória do percurso ou condição de progresso.
 * 3. Quem não contrata nada tem exatamente o mesmo acesso e o mesmo
 *    certificado de quem contrata.
 */

/** Texto curto para exibir junto de qualquer oferta de sessão. */
export const AVISO_OPCIONAL =
  'Análise pessoal, supervisão e orientação formativa são serviços opcionais, ' +
  'contratados à parte. Não são requisito para concluir nenhum curso da PCO ' +
  'nem para receber o certificado.';

/** A base legal, para a tela de políticas do admin e os Termos. */
export const BASE_LEGAL =
  'Condicionar a venda de um curso à contratação de análise ou supervisão ' +
  'configura venda casada, vedada pelo art. 39, I, do Código de Defesa do ' +
  'Consumidor (Lei nº 8.078/1990), e infração à ordem econômica pelo art. 36, ' +
  '§ 3º, XVIII, da Lei nº 12.529/2011. Cláusula nesse sentido é nula de pleno ' +
  'direito (CDC, art. 51, IV).';

/**
 * O que NUNCA pode depender de uma sessão contratada. Existe como lista
 * enumerada para que o teste possa percorrê-la — e para que qualquer um que
 * pense em criar essa dependência esbarre nela primeiro.
 */
export const NUNCA_CONDICIONADO = [
  'acesso ao curso',
  'progresso nas aulas',
  'conclusão do curso',
  'emissão do certificado',
  'validação do certificado',
] as const;

export type NuncaCondicionado = (typeof NUNCA_CONDICIONADO)[number];

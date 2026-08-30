/**
 * O endereço público do AVA, num lugar só.
 *
 * Existia copiado em treze pontos do servidor — cada rota de retorno de
 * pagamento, cada worker que monta link de e-mail — mais cinco lugares que
 * escreviam o domínio direto, sem nem olhar a variável de ambiente. Trocar de
 * domínio significava caçar todos e não esquecer nenhum; esquecer um significa
 * um e-mail com link morto ou um retorno de pagamento que não volta.
 *
 * Agora é uma linha de configuração: `PUBLIC_ORIGIN` no ambiente.
 *
 * O valor de reserva é o endereço atual. Ele existe para que o
 * desenvolvimento local e os testes não precisem configurar nada — não para
 * ser o que roda em produção. Em produção a variável é definida
 * explicitamente, e `test/origem-publica.test.ts` cobra que o literal não
 * volte a aparecer espalhado pelo servidor.
 */

/** Endereço usado quando `PUBLIC_ORIGIN` não está definida. */
export const ORIGEM_PUBLICA_PADRAO = 'https://ava.psicanaliseclinica.online';

/**
 * Origem pública, sem barra no fim — para que `${origemPublica()}/login`
 * nunca produza `//login`.
 */
export function origemPublica(): string {
  const bruta = process.env.PUBLIC_ORIGIN?.trim();
  const escolhida = bruta && bruta.length > 0 ? bruta : ORIGEM_PUBLICA_PADRAO;
  return escolhida.replace(/\/+$/, '');
}

/**
 * Só o host, sem protocolo. Usado na assinatura dos e-mails, onde escrever
 * `https://` no rodapé polui mais do que informa.
 */
export function hostPublico(): string {
  try {
    return new URL(origemPublica()).host;
  } catch {
    // Origem malformada na variável de ambiente: cair no padrão é melhor do
    // que derrubar o envio de e-mail por causa do rodapé.
    return new URL(ORIGEM_PUBLICA_PADRAO).host;
  }
}

/** Monta uma URL absoluta a partir de um caminho (`/login` → `https://…/login`). */
export function urlPublica(caminho: string): string {
  return `${origemPublica()}/${caminho.replace(/^\/+/, '')}`;
}

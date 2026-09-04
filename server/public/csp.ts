/** Hosts liberados pelas tags de marketing. Espelha o retorno de `hostsParaCsp()`. */
export interface HostsParaCsp {
  script: string[];
  img: string[];
  connect: string[];
  frame: string[];
}

/**
 * O host do player de vídeo. Não é "mais um domínio de terceiro": é onde mora
 * a aula.
 *
 * Ficou de fora da CSP por meses e o efeito foi caro de diagnosticar. `frame-src`
 * só era emitido quando havia tag de marketing cadastrada; sem tag, a diretiva
 * não existia e caía em `default-src 'self'` — então **o próprio site bloqueava
 * o player**, em todas as aulas, para todo aluno. Como a Vimeo também restringe
 * por domínio, o sintoma ("este conteúdo está bloqueado") foi lido durante dias
 * como problema da conta da Vimeo, e o conserto era aqui.
 */
export const HOST_DO_PLAYER = 'https://player.vimeo.com';

/**
 * De onde vem o áudio dos podcasts.
 *
 * `media-src` não era emitido, e sem ele o áudio cai em `default-src 'self'` —
 * ou seja, **a mesma parede que bloqueou o player de vídeo por meses**, com o
 * mesmo sintoma: um player que simplesmente não toca, sem erro visível na
 * tela, e cuja causa não está no player.
 *
 * Entrou antes de o player de áudio existir, de propósito. O bug do vídeo foi
 * caro justamente porque a diretiva faltante só apareceu depois de dias
 * procurando na conta da Vimeo; aqui a parede já está derrubada quando a
 * sprint do áudio começar.
 *
 * `blob:` é para áudio gerado ou trechos montados no cliente; `https:` cobre o
 * arquivo hospedado onde o admin cadastrar, que hoje é campo de texto livre.
 */
export const FONTES_DE_MIDIA = "'self' data: blob: https:";

/**
 * Monta a política de segurança de conteúdo.
 *
 * Mora fora do `dev.ts` pelo mesmo motivo que o mapa de rotas fundidas saiu de
 * lá: enquanto foi uma string montada dentro do servidor, ninguém tinha como
 * cobrar em teste o que ela precisa conter.
 *
 * Os hosts de marketing entram **apenas quando há tag cadastrada** — liberar
 * googletagmanager e facebook "por via das dúvidas" afrouxaria a política com
 * ninguém usando nada disso. `script-src` segue sem `'unsafe-inline'`, e é
 * isso que impede que uma tag de HTML customizado dentro do GTM vire execução
 * arbitrária aqui.
 */
export function montarCsp(extras: HostsParaCsp): string {
  const mais = (lista: string[]): string => (lista.length ? ' ' + lista.join(' ') : '');
  return (
    "default-src 'self'; " +
    `script-src 'self'${mais(extras.script)}; ` +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    `img-src 'self' data: blob: https:${mais(extras.img)}; ` +
    "font-src 'self' https://fonts.gstatic.com data:; " +
    `connect-src 'self' https:${mais(extras.connect)}; ` +
    // Sempre presente, com ou sem tag: o player é função do produto, não extra.
    `frame-src 'self' ${HOST_DO_PLAYER}${mais(extras.frame)}; ` +
    // Idem para o áudio. Ver `FONTES_DE_MIDIA`.
    `media-src ${FONTES_DE_MIDIA}; ` +
    "frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  );
}

/**
 * Os cabeçalhos de segurança, num lugar só — e aplicados nos DOIS modos.
 *
 * Até 3/set/2026 este bloco vivia dentro do `if (staticRoot)` do `server/dev.ts`.
 * Consequência: em `npm run dev` o site público SSR respondia **sem CSP, sem
 * HSTS, sem X-Frame-Options e sem Referrer-Policy** — e é justamente esse o
 * modo em que se desenvolve.
 *
 * Foi isso que tornou o bug do `frame-src` irreproduzível localmente: o player
 * funcionava na máquina de quem programava (nenhuma CSP para bloqueá-lo) e
 * falhava em produção. Dias de diagnóstico foram gastos na conta da Vimeo por
 * causa de um `if` que decidia, sem querer, quem tem política de segurança.
 *
 * A regra agora é: **quem serve HTML aplica isto**. Não há modo sem.
 */
export interface OpcoesDeSeguranca {
  /** Hosts liberados pelas tags de marketing, já resolvidos. */
  extras: HostsParaCsp;
  /**
   * `includeSubDomains` no HSTS.
   *
   * Desligado por padrão, e isso é temporário. Servindo o domínio principal, a
   * diretiva passa a valer para *todos* os subdomínios — inclusive `old.`, que
   * hospeda a loja e ainda não tem certificado válido. O efeito é brutal e
   * silencioso: quem abre o site principal fica um ano sem conseguir acessar a
   * loja, e o navegador não oferece "continuar assim mesmo" — HSTS não tem
   * escapatória por clique.
   */
  hstsIncluiSubdominios?: boolean;
}

/** Os pares cabeçalho/valor, para quem aplica. Só define o que ainda não existe. */
export function cabecalhosDeSeguranca(
  opcoes: OpcoesDeSeguranca,
): Array<[string, string]> {
  return [
    ['Content-Security-Policy', montarCsp(opcoes.extras)],
    [
      'Strict-Transport-Security',
      `max-age=31536000${opcoes.hstsIncluiSubdominios ? '; includeSubDomains' : ''}`,
    ],
    ['X-Frame-Options', 'DENY'],
    ['Referrer-Policy', 'strict-origin-when-cross-origin'],
    ['Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()'],
    ['X-Content-Type-Options', 'nosniff'],
  ];
}

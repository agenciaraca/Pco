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
    "frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  );
}

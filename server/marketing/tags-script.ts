/**
 * O trecho que carrega as tags — montado pelo servidor, servido same-origin.
 *
 * Três decisões que valem a leitura:
 *
 * 1. **Nada é inline.** A CSP do site é `script-src 'self'` e é assim que ela
 *    protege: nenhum script pode nascer de texto no HTML. Os trechos oficiais do
 *    Google e do Meta são inline por natureza, então aqui eles viram criação de
 *    `<script src>` a partir deste arquivo, que é servido de `/_pub/tags.js`.
 *    Consequência boa de lado: tag customizada de HTML dentro do GTM continua
 *    barrada pela CSP — o painel do GTM não vira porta de execução arbitrária.
 *
 * 2. **O identificador é interpolado, mas nunca cru.** Ele já passou pelo regex
 *    do schema; aqui passa por uma segunda peneira antes de virar string JS.
 *    Duas peneiras porque a primeira mora longe (shared/schemas.ts) e alguém
 *    pode gravar por outro caminho um dia.
 *
 * 3. **Consentimento primeiro.** Com `exigirConsentimento`, nada sobe antes do
 *    aceite; o aceite fica no navegador de quem visita, e o evento
 *    `pco:consentimento` acorda o carregamento sem recarregar a página.
 */

import type { TagsMarketing } from './tags-store';

/** Segunda peneira: só o que é seguro dentro de uma string JS. */
function limpo(v: string): string {
  return /^[A-Za-z0-9_-]{1,64}$/.test(v) ? v : '';
}

export function tagsScript(t: TagsMarketing): string {
  const gtm = t.ativo ? limpo(t.gtmId) : '';
  const ga4 = t.ativo ? limpo(t.ga4Id) : '';
  const pixel = t.ativo ? limpo(t.metaPixelId) : '';
  const precisaAceite = t.exigirConsentimento;

  // Sem nada configurado o arquivo não precisa nem existir: o servidor devolve
  // um no-op. Emitir o carregador inteiro "desligado por dentro" deixaria as
  // URLs dos provedores no HTML de quem não usa provedor nenhum.
  if (!gtm && !ga4 && !pixel) return '/* sem tag de marketing configurada */';

  return `
(function(){
  'use strict';
  var CFG = { gtm: ${JSON.stringify(gtm)}, ga4: ${JSON.stringify(ga4)}, pixel: ${JSON.stringify(pixel)}, aceite: ${precisaAceite} };
  if(!CFG.gtm && !CFG.ga4 && !CFG.pixel) return;
  var CHAVE = 'pco_consent';
  function consentiu(){ try { return localStorage.getItem(CHAVE) === 'sim'; } catch(e) { return false; } }
  function tag(src){ var s=document.createElement('script'); s.async=true; s.src=src; document.head.appendChild(s); }
  var carregou = false;
  function carregar(){
    if(carregou) return; carregou = true;
    window.dataLayer = window.dataLayer || [];
    function gtag(){ window.dataLayer.push(arguments); }
    window.gtag = window.gtag || gtag;
    if(CFG.gtm){
      window.dataLayer.push({'gtm.start': new Date().getTime(), event: 'gtm.js'});
      tag('https://www.googletagmanager.com/gtm.js?id=' + CFG.gtm);
    } else if(CFG.ga4){
      tag('https://www.googletagmanager.com/gtag/js?id=' + CFG.ga4);
      gtag('js', new Date());
      gtag('config', CFG.ga4, { anonymize_ip: true });
    }
    if(CFG.pixel){
      var f = window.fbq = function(){ f.callMethod ? f.callMethod.apply(f, arguments) : f.queue.push(arguments); };
      if(!window._fbq) window._fbq = f;
      f.push = f; f.loaded = true; f.version = '2.0'; f.queue = [];
      tag('https://connect.facebook.net/en_US/fbevents.js');
      f('init', CFG.pixel);
      f('track', 'PageView');
    }
  }
  if(!CFG.aceite || consentiu()) { carregar(); }
  document.addEventListener('pco:consentimento', carregar);
})();
`.trim();
}

/**
 * As metas de verificação de propriedade.
 *
 * Vão no `<head>` de toda página e **não dependem de consentimento**: não
 * carregam script, não gravam nada no navegador e não observam ninguém — são
 * uma string que o Google e o Meta leem para confirmar que o domínio é seu.
 */
export function metasDeVerificacao(t: TagsMarketing): string {
  const meta = (nome: string, valor: string): string => {
    const v = valor.trim();
    if (!v || !/^[A-Za-z0-9_-]{16,120}$/.test(v)) return '';
    return `<meta name="${nome}" content="${v}" />`;
  };
  return [
    meta('google-site-verification', t.googleSiteVerification),
    meta('facebook-domain-verification', t.facebookDomainVerification),
  ]
    .filter(Boolean)
    .join('\n    ');
}

/**
 * O `<noscript>` do GTM e do pixel.
 *
 * Sem JavaScript não há como pedir consentimento nem como respeitá-lo, então o
 * fallback só existe quando o site **não** exige aceite. Emitir a imagem de
 * rastreio para quem nunca pôde recusar seria contornar a própria regra.
 */
export function tagsNoscript(t: TagsMarketing): string {
  if (!t.ativo || t.exigirConsentimento) return '';
  const gtm = limpo(t.gtmId);
  const pixel = limpo(t.metaPixelId);
  const partes: string[] = [];
  if (gtm) {
    partes.push(
      `<iframe src="https://www.googletagmanager.com/ns.html?id=${gtm}" height="0" width="0" style="display:none;visibility:hidden" title="Google Tag Manager"></iframe>`,
    );
  }
  if (pixel) {
    partes.push(
      `<img height="1" width="1" style="display:none" alt="" src="https://www.facebook.com/tr?id=${pixel}&ev=PageView&noscript=1" />`,
    );
  }
  return partes.length ? `<noscript>${partes.join('')}</noscript>` : '';
}

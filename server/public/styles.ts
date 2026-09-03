/**
 * CSS do site público — inline no <head> (crítico, sem request externo:
 * bom para LCP/FCP e sem render-blocking). Tokens = fonte da verdade do design
 * handoff. Rebrand = trocar só --accent/--accent-ink/--accent-soft.
 *
 * Zero webfont (system-ui) → sem bloqueio de fonte nem CLS por swap.
 */
export const PUBLIC_CSS = `
*,*::before,*::after{box-sizing:border-box}
:root{
  --paper:#f9faf8;--surface:#fbfcfa;--surface-2:#eaece6;--raise:#fff;
  --ink:#101828;--ink-soft:#575c62;--ink-faint:#6f757c;
  --line:#dcdfd8;--line-soft:#e8eae4;
  --accent:#0097b2;--accent-ink:#007a91;--accent-soft:#d9eef4;--on-accent:#ffffff;
  /* Ciano claro e petróleo: existiam só no lado do aplicativo. Agora os dois
     lados leem os mesmos nomes — ver docs/design/tokens.css. */
  --accent-bright:#0cc0df;--accent-light:#5ce1e6;--brand-petroleo:#063b49;
  --wa:#25d366;
  --brand-deep:#0b7486;--on-deep:#eef3f1;
  --brand-orange:#ff914d;--brand-orange-ink:#d96a24;--brand-orange-soft:#ffe9db;--on-orange:#2b1608;
  /* Alias do laranja antigo, para não quebrar quem já usa --orange. */
  --orange:#ff914d;--orange-soft:#ffe9db;
  /* Degradê oficial: sempre do principal para o escuro, nunca invertido. */
  --brand-gradient:linear-gradient(118deg,#0097b2 0%,#008ba4 52%,#0b7486 100%);
  --brand-grad-topo:#0097b2;
  --cta-gradient:linear-gradient(118deg,#ff914d,#f07a2f);
  --good:#2f7d4f;--good-bg:#e0efe4;--good-line:#bcdcc6;
  --warn:#9a6a12;--warn-bg:#f5ead1;--warn-line:#e5d09a;
  --crit:#b0422f;--crit-bg:#f6e2dc;--crit-line:#e8bfb3;
  --radius-sm:9px;--radius:14px;--radius-lg:22px;
  --shadow:0 1px 2px rgba(20,25,30,.04),0 4px 16px rgba(20,25,30,.05);
  --shadow-lg:0 12px 34px rgba(11,116,134,.14);
  --wrap:1180px;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --paper:#101216;--surface:#181b20;--surface-2:#20242a;--raise:#1e2228;
  --ink:#e9ebe6;--ink-soft:#9ea4aa;--ink-faint:#6e747b;
  --accent-bright:#0cc0df;--accent-light:#5ce1e6;--brand-petroleo:#041f27;
  --line:#2b2f36;--line-soft:#242830;
  --accent:#4cc3d9;--accent-ink:#7fd8e8;--accent-soft:#102c33;--on-accent:#062229;
  --brand-deep:#0a5f6e;--on-deep:#eef3f1;
  --brand-orange:#ff914d;--brand-orange-ink:#ffab77;--brand-orange-soft:#33200f;--on-orange:#2b1608;
  --orange:#ff914d;--orange-soft:#33200f;
  --brand-gradient:linear-gradient(118deg,#0a7f95 0%,#0a7183 52%,#0a5f6e 100%);
  --brand-grad-topo:#0a7f95;
  --cta-gradient:linear-gradient(118deg,#ff914d,#f07a2f);
  --good:#5cbd83;--good-bg:#16281d;--good-line:#274a34;
  --warn:#d6a24c;--warn-bg:#2c2413;--warn-line:#4a3c1c;
  --crit:#e08066;--crit-bg:#2c1a14;--crit-line:#4d2c22;
  --shadow:0 1px 2px rgba(0,0,0,.3),0 6px 20px rgba(0,0,0,.28);
}}
:root[data-theme="dark"]{
  --paper:#101216;--surface:#181b20;--surface-2:#20242a;--raise:#1e2228;
  --ink:#e9ebe6;--ink-soft:#9ea4aa;--ink-faint:#6e747b;
  --accent-bright:#0cc0df;--accent-light:#5ce1e6;--brand-petroleo:#041f27;
  --line:#2b2f36;--line-soft:#242830;
  --accent:#4cc3d9;--accent-ink:#7fd8e8;--accent-soft:#102c33;--on-accent:#062229;
  --brand-deep:#0a5f6e;--on-deep:#eef3f1;
  --brand-orange:#ff914d;--brand-orange-ink:#ffab77;--brand-orange-soft:#33200f;--on-orange:#2b1608;
  --orange:#ff914d;--orange-soft:#33200f;
  --brand-gradient:linear-gradient(118deg,#0a7f95 0%,#0a7183 52%,#0a5f6e 100%);
  --brand-grad-topo:#0a7f95;
  --cta-gradient:linear-gradient(118deg,#ff914d,#f07a2f);
  --good:#5cbd83;--good-bg:#16281d;--good-line:#274a34;
  --warn:#d6a24c;--warn-bg:#2c2413;--warn-line:#4a3c1c;
  --crit:#e08066;--crit-bg:#2c1a14;--crit-line:#4d2c22;
  --shadow:0 1px 2px rgba(0,0,0,.3),0 6px 20px rgba(0,0,0,.28);
}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{animation-duration:.001ms!important;transition-duration:.001ms!important}}
body{margin:0;background:var(--paper);color:var(--ink);
  font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
  font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased}
img{max-width:100%;height:auto;display:block}
a{color:inherit;text-decoration:none}
h1,h2,h3{font-weight:800;letter-spacing:-.02em;line-height:1.12;margin:0;text-wrap:balance}
h1{font-size:clamp(34px,4.8vw,58px)}
h2{font-size:clamp(24px,3vw,34px)}
h3{font-size:clamp(18px,2vw,22px)}
p{margin:0}
.wrap{max-width:var(--wrap);margin:0 auto;padding:0 24px}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0}
.skip{position:absolute;left:-999px;top:8px;background:var(--accent);color:var(--on-accent);padding:10px 16px;border-radius:8px;z-index:200}
.skip:focus{left:12px}
:focus-visible{outline:2.5px solid var(--accent);outline-offset:2px;border-radius:4px}
.eyebrow{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;color:var(--ink-soft);
  background:var(--surface-2);border:1px solid var(--line);padding:6px 13px;border-radius:999px}
.lead{font-size:clamp(16px,1.6vw,19px);color:var(--ink-soft)}
.section{padding:clamp(48px,7vw,88px) 0}
.section-tight{padding:clamp(32px,4vw,56px) 0}
.card{background:var(--raise);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);padding:26px}
.grid{display:grid;gap:20px}
/* Botão — a medida e os cinco estados vêm de docs/design/pages/Componentes.dc.html.
   Antes daqui existiam três variantes e nenhum estado: desabilitado ficava
   igual a habilitado, carregando não existia e o foco era o contorno cru do
   :focus-visible global, em vez do anel macio do desenho. */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;
  border-radius:999px;padding:13px 24px;font-weight:700;font-size:15px;cursor:pointer;border:1.5px solid transparent;
  transition:transform .12s ease,filter .12s ease,background .15s ease,border-color .15s ease,color .15s ease;font-family:inherit}
.btn:hover{filter:brightness(1.05)}.btn:active{transform:translateY(1px)}
.btn:focus-visible{outline:3px solid var(--accent-soft);outline-offset:2px}
.btn[disabled],.btn[aria-disabled="true"]{opacity:.45;cursor:not-allowed;box-shadow:none!important;filter:none;transform:none}
.btn[data-carregando]{pointer-events:none}
.btn-spin{width:16px;height:16px;flex:none;border:2.5px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;
  animation:btn-spin 1s linear infinite}
.btn-outline .btn-spin,.btn-ghost .btn-spin{border-color:var(--line);border-top-color:var(--accent)}
@keyframes btn-spin{to{transform:rotate(360deg)}}
.btn-primary{background:var(--accent);color:var(--on-accent);box-shadow:0 8px 22px rgba(0,151,178,.28)}
.btn-primary:hover{background:var(--accent-ink);filter:none}
.btn-outline{background:transparent;border-color:var(--line);color:var(--ink)}
.btn-outline:hover{border-color:var(--accent);color:var(--accent-ink);filter:none}
/* Ghost: ação terciária. Faltava, e no lugar dela entrava outline — o que dava
   peso de ação secundária a link de apoio. */
.btn-ghost{background:transparent;color:var(--accent-ink);padding:13px 16px}
.btn-ghost:hover{background:var(--accent-soft);filter:none}
/* CTA de conversão (matrícula, checkout, entrar no AVA): degradê laranja.
   O laranja é detalhe de identidade — usado só onde há decisão de compra. */
.btn-cta{background:var(--cta-gradient);color:#fff;font-weight:700;box-shadow:0 10px 26px rgba(255,145,77,.32)}
.btn-cta:hover{filter:brightness(1.05)}
.btn-wa{background:var(--wa);color:#fff;box-shadow:0 8px 22px rgba(37,211,102,.3)}
.btn-wa svg{width:18px;height:18px;flex:none}
/* O desenho usa três tamanhos, não um: padrão (13/24), o par de CTAs da página
   do curso (14/26) e o do herói (17/34), que é o maior da casa. */
.btn-lg{padding:17px 34px;font-size:16px}
.btn-cta.btn-lg{box-shadow:0 12px 30px rgba(255,145,77,.4)}
.tag-categoria{color:var(--brand-orange-ink);text-transform:uppercase;letter-spacing:.06em;font-size:11.5px;font-weight:700;background:var(--brand-orange-soft);border-color:transparent}
.tag-chip{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:var(--ink-soft);
  background:var(--surface-2);border:1px solid var(--line-soft);padding:5px 11px;border-radius:8px}
/* ---- header ---- */
/* Cabeçalho no degradê da marca, igual ao do /ava-pco. Ver o comentário em
   layout.ts: eram duas identidades no mesmo domínio. */
.site-header{position:sticky;top:0;z-index:100;background:var(--brand-gradient);
  box-shadow:0 1px 2px rgba(16,24,40,.04),0 1px 3px rgba(16,24,40,.06)}
.site-header .bar{display:flex;align-items:center;justify-content:space-between;gap:18px;height:64px}
.brand{display:flex;align-items:center;flex:none}
.brand img{height:36px;width:auto;object-fit:contain;display:block}
.nav{display:flex;align-items:center;gap:2px}
.nav a{padding:8px 12px;border-radius:9px;font-weight:500;font-size:14px;color:rgba(255,255,255,.85);white-space:nowrap;transition:background .15s,color .15s}
.nav a:hover{background:rgba(255,255,255,.12);color:#fff}
.nav a[aria-current="page"]{background:rgba(255,255,255,.2);color:#fff}
.header-cta{display:flex;align-items:center;gap:8px;flex:none}
/* Carrinho: botão redondo com contorno, como no protótipo do cabeçalho. Era um
   emoji num retângulo — e emoji muda de desenho conforme o sistema de quem
   olha, então nunca é o desenho aprovado. */
.cart-link{position:relative;display:inline-flex;align-items:center;justify-content:center;
  width:40px;height:40px;border-radius:50%;border:1.5px solid rgba(255,255,255,.35);color:#fff}
.cart-link:hover{background:rgba(255,255,255,.15);color:#fff}
.cart-link svg{width:19px;height:19px;flex:none}
/* O protótipo põe a contagem em ciano; aqui a barra JÁ é o degradê ciano, e
   ciano sobre ciano some. Fica no laranja, que é a cor de comércio da marca. */
.cart-badge{position:absolute;top:-4px;right:-4px;min-width:19px;height:19px;padding:0 5px;border-radius:999px;
  background:var(--brand-orange);color:#fff;font-size:11.5px;font-weight:700;display:none;align-items:center;justify-content:center;line-height:1}
.cart-badge[data-count]:not([data-count="0"]){display:inline-flex}
/* Botões do topo: vivem sobre o degradê, então não usam as variantes claras. */
.btn-topo{background:transparent;border:1px solid rgba(255,255,255,.35);color:#fff;
  border-radius:999px;padding:8px 13px;font-size:14px;cursor:pointer;font-family:inherit;line-height:1}
.btn-topo:hover{background:rgba(255,255,255,.15)}
.btn-topo-cheio{background:#fff;color:var(--brand-deep);border-radius:999px;padding:9px 20px;
  font-weight:700;font-size:14.5px;border:0}
.btn-topo-cheio:hover{background:rgba(255,255,255,.9)}
/* CTA de conversão no topo. O protótipo do cabeçalho traz "Matricular-se" no
   degradê laranja; aqui ele é o único ponto laranja da barra, e é o que faltava:
   o topo de toda página levava só para o login, nunca para a compra. Menor que
   o .btn de corpo de página, para caber ao lado do menu. */
.btn-topo-cta{padding:10px 20px;font-size:14.5px;box-shadow:0 6px 18px rgba(255,145,77,.35)}
/* As duas portas — comprar e entrar — dentro do menu aberto, para as telas em
   que não cabem na barra. Escondidas por padrão; a media query as acende. */
.nav-cta,.nav-entrar{display:none}
.menu-toggle{display:none;background:none;border:1px solid rgba(255,255,255,.35);border-radius:9px;padding:8px 10px;cursor:pointer;color:#fff}
/* ---- hero deep ---- */
.hero-deep{background:var(--brand-gradient);color:var(--on-deep);position:relative}
.hero-deep .eyebrow{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.18);color:#dfeeea}
.hero-deep h1{color:#fff}
.hero-deep .lead{color:#cfe0dc}
/* ---- footer ---- */
.site-footer{background:var(--brand-gradient);color:var(--on-deep)}
.site-footer a{color:#cfe0dc}.site-footer a:hover{color:#fff}
.site-footer .cols{display:grid;grid-template-columns:1fr 1fr 1.3fr;gap:36px;padding:56px 0 40px;text-align:center;justify-items:center}
.site-footer .cols.cols-2{grid-template-columns:1fr 1fr;max-width:820px;margin:0 auto}
.rodape-col{display:flex;flex-direction:column;align-items:center;gap:9px;max-width:38ch}
.rodape-contato{display:inline-flex;align-items:center;gap:8px;font-size:14.5px;font-weight:600}
.rodape-contato svg{width:17px;height:17px;flex:none}
.ondinha{width:120px;height:8px;color:rgba(255,255,255,.45);margin:8px 0}
.rodape-rotulo{font-style:italic;font-size:13px;color:#bcd9e2;margin-top:6px}
.rodape-endereco{font-size:13.5px;color:#dceaef;line-height:1.5}
/* Selo RNTP: a imagem oficial, baixada do site da escola. O protótipo desenha
   um círculo com o texto "RNTP" porque não tinha o arquivo; desenhar à mão um
   selo de certificação é pior que não ter — parece o selo sem ser o selo. */
.selo-rntp{width:124px;height:124px;display:block;border-radius:50%;background:#fff;padding:7px;
  box-shadow:0 6px 20px rgba(0,0,0,.18)}
.selo-rntp img{width:100%;height:100%;object-fit:contain;display:block}
.rodape-social{display:flex;gap:10px;margin-top:16px}
.rodape-social a{width:38px;height:38px;border-radius:50%;display:inline-flex;align-items:center;
  justify-content:center;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.28);color:#fff}
.rodape-social a:hover{background:rgba(255,255,255,.26);color:#fff}
.rodape-social svg{width:18px;height:18px}
.rodape-privacidade{text-align:left;max-width:46ch;align-items:flex-start}
.rodape-privacidade p{font-size:12.8px;line-height:1.6;color:#dceaef;margin-bottom:8px}
.rodape-priv-titulo{font-weight:800;font-style:italic;font-size:13.5px;color:#fff}
.link-destaque{color:var(--brand-orange)!important;font-weight:600}
.link-destaque:hover{color:#ffb384!important}
.site-footer h4{font-size:13px;text-transform:uppercase;letter-spacing:.1em;color:#9fc0ba;margin:0 0 14px;font-weight:700}
.site-footer ul{list-style:none;margin:0;padding:0;display:grid;gap:9px;font-size:14.5px}
.site-footer .legal{border-top:1px solid rgba(255,255,255,.12);padding:20px 0;display:flex;flex-wrap:wrap;gap:8px 20px;justify-content:space-between;font-size:12.5px;color:#9fc0ba}
.disclaimer{background:var(--warn-bg);border:1px solid var(--warn-line);color:var(--ink);border-radius:12px;padding:14px 16px;font-size:13.5px;line-height:1.6}
.wa-float{position:fixed;right:20px;bottom:20px;width:56px;height:56px;border-radius:50%;background:#25d366;color:#0b3b1e;display:grid;place-items:center;box-shadow:0 6px 20px rgba(0,0,0,.25);z-index:90}
/* ---- divisor "pincel" ----
   Três camadas do mesmo tom em opacidades crescentes, com curvas longas e
   assimétricas. Serve para tirar o corte reto entre seções; a cor vem do
   fundo da seção SEGUINTE, senão o divisor aparece como faixa solta. */
.pincel{position:absolute;left:0;right:0;bottom:-1px;line-height:0;pointer-events:none;z-index:2}
.pincel svg{display:block;width:100%;height:clamp(60px,10vw,150px)}
/* Variante do rodapé: entra no fluxo (não absoluta) logo acima dele.
   NÃO leva scaleY(-1): as curvas já preenchem de baixo para cima, então a
   parte sólida encosta no rodapé e a borda ondulada fica virada para a página.
   Invertida, a parte sólida ia para cima e o divisor virava uma faixa solta.
   A margem superior vive aqui, e nao no rodape: la ela abriria um vao entre os
   dois. (Sem crase neste comentario: o CSS mora dentro de um template literal.) */
.pincel-topo{line-height:0;pointer-events:none;margin-top:64px}
.pincel-topo svg{display:block;width:100%;height:clamp(60px,10vw,150px)}
.tem-pincel{position:relative;overflow:hidden;padding-bottom:120px}
/* ---- foto de fundo do hero ----
   Bem tênue: a foto ambienta, o degradê da marca é que manda. Decorativa, por
   isso entra como background e não como <img> com texto alternativo. */
.hero-foto{position:absolute;inset:0;background-size:cover;background-position:center;opacity:.16;pointer-events:none}
.hero-veu{position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(180deg,rgba(11,116,134,.25),rgba(0,151,178,.05) 40%,rgba(11,116,134,.55))}
.hero-deep .wrap{position:relative;z-index:1}
/* ---- grade de cursos (desenho vindo do /catalogo) ---- */
.cursos-grade{display:grid;gap:20px;grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}
.curso-cartao{display:flex;flex-direction:column;background:var(--raise);border:1px solid var(--line);
  border-radius:var(--radius);box-shadow:var(--shadow);overflow:hidden;
  transition:box-shadow .2s ease,transform .2s ease}
.curso-cartao:hover{box-shadow:0 12px 32px rgba(6,59,73,.12),0 2px 6px rgba(16,24,40,.06);transform:translateY(-2px)}
.curso-capa{position:relative;height:158px;padding:18px;display:flex;flex:none}
.curso-capa .capa-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.curso-brilho{position:absolute;inset:0;
  background:radial-gradient(circle at 70% 20%,rgba(255,255,255,.22),transparent 60%)}
/* Véu por cima da foto: sem ele, capa clara come o texto branco. */
.curso-capa .capa-img+.curso-brilho{background:linear-gradient(180deg,rgba(6,59,73,.25),rgba(6,59,73,.72)),
  radial-gradient(circle at 70% 20%,rgba(255,255,255,.18),transparent 60%)}
.curso-capa-texto{position:relative;display:flex;flex-direction:column;justify-content:space-between;
  height:100%;width:100%;color:#fff;gap:10px}
.curso-etiqueta{align-self:flex-start;padding:3px 9px;border-radius:999px;background:rgba(255,255,255,.22);
  backdrop-filter:blur(4px);font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
.curso-capa-texto h3{font-size:20px;line-height:1.15;color:#fff;max-width:22ch}
.curso-selo{position:absolute;top:12px;right:12px;z-index:2;padding:3px 9px;border-radius:999px;
  background:var(--brand-orange);color:#fff;font-size:10.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase}
.curso-corpo{padding:18px;display:flex;flex-direction:column;gap:13px;flex:1}
.curso-desc{color:var(--ink-soft);font-size:14px;line-height:1.55;
  display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.curso-meta{display:flex;flex-wrap:wrap;gap:8px 16px;font-size:12.5px;color:var(--ink-soft)}
.curso-meta span{display:inline-flex;align-items:center;gap:6px}
.curso-meta span::before{content:'';width:5px;height:5px;border-radius:50%;background:var(--accent)}
.curso-rodape{margin-top:auto;padding-top:13px;border-top:1px solid var(--line-soft);
  display:flex;align-items:flex-end;justify-content:space-between;gap:12px}
.preco-rotulo{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-faint)}
.preco-valor{font-size:19px;font-weight:800;color:var(--ink);letter-spacing:-.02em}
.preco-consulte{font-size:15px;font-weight:700;color:var(--ink-soft)}
.preco-parcela{font-size:12px;color:var(--ink-faint);margin-top:2px}
.curso-acao{font-size:13.5px;font-weight:700;color:var(--accent);white-space:nowrap}
/* ---- utility layouts ---- */
.stack{display:grid;gap:16px}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:28px}
.three-col{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.prose p{margin:0 0 16px;color:var(--ink-soft)}
.prose h2{margin:34px 0 12px}
.prose ul{color:var(--ink-soft);padding-left:20px;margin:0 0 16px;display:grid;gap:7px}
.breadcrumb{font-size:13px;color:var(--ink-faint);display:flex;gap:8px;flex-wrap:wrap;padding:18px 0}
.breadcrumb a:hover{color:var(--accent)}
/* ---- aviso de cookies (só existe quando há tag esperando consentimento) ----
   "Recusar" tem o mesmo peso de "Aceitar": botão de recusa escondido é
   consentimento arrancado, não obtido. */
.consent{position:fixed;left:50%;transform:translateX(-50%);bottom:16px;z-index:150;
  width:min(720px,calc(100% - 32px));background:var(--raise);border:1px solid var(--line);
  border-radius:var(--radius);box-shadow:var(--shadow-lg);padding:18px 20px;
  display:flex;gap:18px;align-items:center;flex-wrap:wrap}
.consent p{font-size:14px;color:var(--ink-soft);line-height:1.55;flex:1;min-width:260px}
.consent a{color:var(--accent-ink);text-decoration:underline}
.consent-acoes{display:flex;gap:10px;flex:none}
.consent-acoes .btn{padding:11px 20px;font-size:14px}
@media (max-width:560px){.consent{bottom:0;border-radius:var(--radius) var(--radius) 0 0;width:100%}
  .consent-acoes{width:100%}.consent-acoes .btn{flex:1}}

/* ================= HOME (conteúdo do dono, desenho do protótipo) ================= */
/* Três pilares: Flexibilidade, Acessibilidade, Suporte. */
.pilares{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.pilar{background:var(--raise);border:1px solid var(--line-soft);border-radius:18px;padding:26px;
  box-shadow:var(--shadow)}
.pilar h3{font-size:19px;margin-bottom:8px}
.pilar p{font-size:14.5px;color:var(--ink-soft);line-height:1.6}
/* Faixa de chamada no degradê, com o pincel dissolvendo para a seção seguinte. */
.faixa-cta{background:var(--brand-gradient);color:#fff;position:relative;padding-bottom:clamp(60px,8vw,110px)}
.faixa-cta h2{color:#fff}
/* Depoimentos: aspas de verdade, nome e papel separados do texto. */
.depoimentos{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px}
.depo{margin:0;background:var(--raise);border:1px solid var(--line-soft);border-radius:18px;
  padding:26px 26px 22px;box-shadow:var(--shadow);display:flex;flex-direction:column;gap:16px}
.depo blockquote{margin:0;font-size:15.5px;line-height:1.65;color:var(--ink);position:relative;padding-top:36px}
/* Aspa decorativa com o caractere literal: escape CSS de quatro digitos nao
   sobrevive a esta string de template — some a contrabarra e sobra o "C". */
.depo blockquote::before{content:'“';position:absolute;top:0;left:-3px;font-size:58px;
  line-height:.75;color:var(--accent);opacity:.3;font-family:Georgia,'Times New Roman',serif}
.depo figcaption{display:flex;flex-direction:column;gap:2px;margin-top:auto}
.depo .nome{font-weight:700;color:var(--ink);font-size:15px}
.depo .papel{font-size:13px;color:var(--ink-faint)}
/* Bloco RNTP com o selo real ao lado do texto. */
.rntp-bloco{display:grid;grid-template-columns:auto 1fr;gap:36px;align-items:center}
.rntp-bloco .selo-rntp{width:150px;height:150px;box-shadow:var(--shadow-lg)}
/* Números DECLARADOS pela escola — separados dos medidos, e rotulados como tal. */
.numeros-declarados{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:24px;
  text-align:center;color:#fff}
.numeros-declarados .valor{font-size:clamp(34px,5vw,50px);font-weight:800;line-height:1.05}
.numeros-declarados .rotulo{color:#cfe0dc;font-size:15px;margin-top:6px}
.declarados-nota{margin-top:26px;color:#dceaef;font-size:15px;line-height:1.7;max-width:78ch}
/* A barra medida sobrevive, agora sobre fundo claro e dizendo que é medição. */
.barra-numeros-neutra{background:var(--surface-2);border:1px solid var(--line-soft);border-radius:18px;
  padding:24px;margin-top:12px}
.barra-numeros-neutra .valor{color:var(--ink)}
.barra-numeros-neutra .rotulo{color:var(--ink-soft)}
.barra-numeros-neutra .base{color:var(--ink-faint)}
@media (max-width:900px){
  .pilares{grid-template-columns:1fr}
  .rntp-bloco{grid-template-columns:1fr;justify-items:center;text-align:center;gap:24px}
}
@media (max-width:900px){
  .nav{display:none}.menu-toggle{display:inline-flex}
  .two-col,.three-col{grid-template-columns:1fr}
  .site-footer .cols{grid-template-columns:1fr 1fr;gap:28px}
  .nav.open{display:flex;position:absolute;top:64px;left:0;right:0;flex-direction:column;align-items:stretch;background:var(--brand-deep);padding:12px 24px;gap:2px}
  /* No celular a CTA sai da barra e entra no menu aberto — igual ao protótipo,
     que também não empilha CTA e login lado a lado em tela estreita. */
  .btn-topo-cta{display:none}
  .nav.open .nav-cta{display:block;margin-top:12px;text-align:center;background:var(--cta-gradient);
    color:#fff;font-weight:700;border-radius:999px;padding:13px 14px}
  .nav.open .nav-cta:hover{background:var(--cta-gradient);filter:brightness(1.05)}
}
/* Faixa apertada: o menu inteiro ainda aparece (só some abaixo de 900px), e
   agora divide a barra com carrinho, tema, "Entrar" e a CTA de matrícula. Em
   vez de esconder algo, tudo encolhe um degrau — é o que cabe sem cortar. */
@media (min-width:901px) and (max-width:1120px){
  .nav a{padding:8px 9px;font-size:13.5px}
  .btn-topo-cta{padding:9px 16px;font-size:14px}
  .btn-topo-cheio{padding:9px 15px;font-size:14px}
  .header-cta{gap:7px}
  .brand img{height:30px}
}
/* Último degrau antes de o menu virar hambúrguer (900px): aqui os seis itens
   ainda estão na barra e cada pixel conta. Medido: sem isto a barra estoura
   por 5px em 920. */
@media (min-width:901px) and (max-width:959px){
  .nav a{padding:8px 6px;font-size:13px}
  .btn-topo-cta{padding:9px 13px}
  .btn-topo-cheio{padding:9px 12px}
}
/* Abaixo de 560px a barra não comporta logo + carrinho + tema + "Entrar" +
   menu: o botão do menu saía pela direita da tela e ficava inalcançável.
   "Entrar" desce para dentro do menu, junto da CTA. */
@media (max-width:560px){
  .site-header .bar{gap:10px}
  .header-cta{gap:6px}
  .header-cta .btn-topo-cheio{display:none}
  .nav.open .nav-entrar{display:block;margin-top:10px;text-align:center;background:#fff;
    color:var(--brand-deep);font-weight:700;border-radius:999px;padding:12px 14px}
}
@media (max-width:860px){.site-footer .cols,.site-footer .cols.cols-2{grid-template-columns:1fr}.rodape-privacidade{text-align:center;align-items:center}}

/* ================= PAGINA DO CURSO (protótipo aprovado) =================
   Transposição de docs/design/pages/Curso.dc.html. O protótipo escreve tudo
   em style inline; aqui vira classe, que é o que a etapa 4 do plano pedia —
   "extrair o sistema visual como peças compartilhadas". Os valores são os do
   desenho, não aproximações.

   O protótipo usa um runtime próprio (sc-for / dc-import); o README do handoff
   manda NAO portá-lo, só recriar markup e estilo. É o que está aqui.
   (Sem crase neste comentario: o CSS mora dentro de um template literal.) */
.curso-wrap{max-width:1160px;margin:0 auto}
/* --- hero --- */
.curso-hero{position:relative;padding:70px 28px 130px;overflow:hidden;
  background-color:#0b7486;
  background-image:linear-gradient(135deg,rgba(0,151,178,.55),rgba(11,116,134,.9)),
    repeating-linear-gradient(135deg,rgba(255,255,255,.05) 0 14px,rgba(255,255,255,0) 14px 28px)}
.curso-hero-veu{position:absolute;inset:0;background:linear-gradient(120deg,rgba(8,68,79,.92),rgba(11,116,134,.78))}
.curso-hero .curso-wrap{position:relative;color:#fff}
.curso-trilha{font-size:13px;color:rgba(255,255,255,.7);margin-bottom:22px}
.curso-trilha a{color:rgba(255,255,255,.7)}
.curso-trilha a:hover{color:#fff}
.curso-trilha .atual{color:#fff}
.curso-pilula{display:inline-block;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.25);
  color:#fff;font-size:13px;font-weight:600;padding:7px 16px;border-radius:999px}
.curso-hero h1{font-size:clamp(32px,4.4vw,54px);margin:20px 0 14px;line-height:1.08;
  letter-spacing:-.8px;max-width:20ch;text-wrap:balance;color:#fff}
.curso-lema{font-size:clamp(17px,2vw,21px);color:rgba(255,255,255,.9);line-height:1.5;max-width:620px}
.curso-chips{display:flex;flex-wrap:wrap;gap:12px;margin-top:26px}
.curso-chips span{font-size:14px;font-weight:600;color:#fff;background:rgba(255,255,255,.12);
  padding:9px 16px;border-radius:999px}
/* --- corpo + coluna de matrícula --- */
.curso-layout{max-width:1160px;margin:0 auto;padding:60px 28px 90px;display:grid;
  grid-template-columns:1.6fr .9fr;gap:48px;align-items:start}
.curso-tldr{background:var(--accent-soft);border:1px solid rgba(0,151,178,.2);border-radius:18px;
  padding:24px 28px;margin-bottom:40px}
.curso-tldr .rotulo{font-size:12px;font-weight:700;color:var(--accent);letter-spacing:1px;
  text-transform:uppercase;margin-bottom:8px}
.curso-tldr p{font-size:16px;line-height:1.6;color:var(--ink);margin:0}
.curso-corpo h2{font-size:28px;color:var(--ink);margin-bottom:14px}
.curso-texto{font-size:17px;line-height:1.7;color:var(--ink-soft);margin-bottom:40px}
.curso-duas{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-bottom:44px}
.curso-duas h3{font-size:20px;color:var(--ink);margin-bottom:14px}
.curso-lista{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px}
.curso-lista li{display:flex;gap:10px;font-size:15.5px;color:var(--ink-soft);line-height:1.5}
.curso-lista .seta{color:#2e9377;font-weight:700}
.curso-lista svg{flex-shrink:0;margin-top:2px}
/* ementa */
.curso-ementa{display:flex;flex-direction:column;gap:10px;margin-bottom:44px}
.curso-ementa-item{display:flex;gap:16px;align-items:flex-start;background:var(--raise);
  border:1px solid var(--line-soft);border-radius:14px;padding:18px 22px}
.curso-ementa-n{flex-shrink:0;font-weight:700;color:var(--accent);font-size:15px;background:var(--accent-soft);
  width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center}
.curso-ementa-item .t{font-weight:700;color:var(--ink);font-size:16.5px}
.curso-ementa-item .d{font-size:14.5px;color:var(--ink-soft);margin-top:3px;line-height:1.5}
/* destaques */
.curso-destaques{display:flex;flex-direction:column;gap:14px;margin-bottom:44px}
.curso-destaque{background:var(--accent-soft);border:1px solid var(--line);border-radius:var(--radius);padding:20px 24px}
.curso-destaque .t{font-weight:700;color:var(--ink);font-size:16.5px;line-height:1.4}
.curso-destaque .n{font-size:12.5px;color:var(--ink-faint);margin-top:6px;line-height:1.5}
/* seções longas */
.curso-secao{margin-bottom:44px}
.curso-secao h2{font-size:26px;color:var(--ink);margin-bottom:6px;line-height:1.25}
.curso-secao .sub{font-weight:600;color:var(--accent-ink);font-size:16px;margin-bottom:10px}
.curso-secao p{font-size:16.5px;line-height:1.7;color:var(--ink-soft);margin:0 0 16px}
.curso-cta-par{display:flex;gap:12px;flex-wrap:wrap;margin-top:18px}
.curso-cta-par .btn{padding:14px 26px}
/* jornada */
.curso-jornada{display:flex;flex-direction:column;gap:18px;margin-bottom:44px}
.curso-jornada-item{background:var(--raise);border:1px solid var(--line);border-radius:var(--radius);
  box-shadow:var(--shadow);padding:28px}
.curso-jornada-item h3{font-size:20px;color:var(--ink);margin-bottom:4px}
.curso-jornada-item .sub{font-weight:600;color:var(--accent-ink);font-size:14.5px;margin-bottom:10px}
.curso-jornada-item p{font-size:15.5px;line-height:1.7;color:var(--ink-soft);margin:0}
/* FAQ */
.curso-faqs{display:flex;flex-direction:column;gap:12px;margin-bottom:40px}
.curso-faq{border:1px solid var(--line);border-radius:14px;overflow:hidden;background:var(--raise)}
.curso-faq>button{width:100%;text-align:left;background:none;border:0;cursor:pointer;padding:20px 24px;
  display:flex;justify-content:space-between;align-items:center;gap:16px;font-family:inherit}
.curso-faq>button span:first-child{font-weight:600;color:var(--ink);font-size:16.5px}
.curso-faq .mais{flex-shrink:0;color:var(--accent);font-size:24px;line-height:1;transition:transform .2s}
.curso-faq>button[aria-expanded="true"] .mais{transform:rotate(45deg)}
.curso-faq-corpo{max-height:0;overflow:hidden;transition:max-height .3s ease}
.curso-faq-corpo>div{padding:0 24px 22px;color:var(--ink-soft);font-size:15.5px;line-height:1.65}
/* letra miúda: regulamento + aviso de formação livre */
.curso-miudo{background:var(--paper);border:1px dashed var(--line);border-radius:14px;padding:20px 24px;
  font-size:13.5px;color:var(--ink-soft);line-height:1.6}
.curso-miudo .promo{display:block;margin-bottom:12px}
/* coluna de matrícula */
.curso-matricula{position:sticky;top:100px}
.curso-matricula .caixa{background:var(--raise);border:1px solid var(--line);border-radius:22px;padding:30px;
  box-shadow:0 16px 44px rgba(11,116,134,.1)}
.curso-invest{font-size:14px;color:var(--ink-soft)}
.curso-preco{font-size:40px;font-weight:700;color:var(--ink);line-height:1;margin:6px 0}
.curso-parcela{font-size:15px;color:var(--accent);font-weight:600}
.curso-preco-nota{font-size:13px;color:var(--ink-faint);margin-top:4px}
/* O botao principal da caixa e laranja quando ha preco e verde (WhatsApp)
   quando nao ha, entao a medida vive na .btn e nao na variante. */
.curso-matricula .caixa .btn{width:100%;margin-top:22px;padding:16px;font-size:16px}
.curso-matricula .caixa .btn-outline{margin-top:10px;padding:15px;border-color:var(--accent);color:var(--accent)}
.curso-duvida{display:block;text-align:center;margin-top:14px;font-size:14px;color:var(--ink-soft)}
.curso-duvida:hover{color:var(--accent)}
.curso-perks{border-top:1px solid var(--line-soft);margin-top:20px;padding-top:18px;
  display:flex;flex-direction:column;gap:10px}
.curso-perks div{display:flex;gap:10px;font-size:14px;color:var(--ink-soft)}
.curso-perks .ok{color:#2e9377}
.curso-arrependimento{text-align:center;font-size:12px;color:var(--ink-faint);margin-top:14px}
@media (max-width:960px){
  .curso-layout{grid-template-columns:1fr;gap:36px}
  .curso-matricula{position:static}
  .curso-duas{grid-template-columns:1fr}
}

/* ================= LISTA DE FORMACOES (protótipo aprovado) =================
   Transposição de docs/design/pages/Cursos.dc.html.

   A lista era grade de cartões (o desenho vindo do /catalogo). O protótipo
   aprovado troca por LINHAS largas: capa à esquerda, e à direita título,
   resumo, pastilhas, preço e as duas ações. Cabe muito mais informação por
   curso — que é o ponto, porque é aqui que a pessoa escolhe.
   As classes .curso-cartao continuam existindo: outras telas ainda as usam. */
.lista-topo{max-width:1160px;margin:0 auto;padding:60px 28px 20px}
.lista-trilha{font-size:13px;color:var(--ink-soft);margin-bottom:22px}
.lista-trilha .atual{color:var(--ink)}
.lista-topo h1{font-size:clamp(34px,4.6vw,56px);color:var(--ink);margin:14px 0 16px;
  line-height:1.08;letter-spacing:-.8px;max-width:18ch;text-wrap:balance}
.lista-topo .lead{font-size:18px;color:var(--ink-soft);line-height:1.6;max-width:640px}
.lista-cursos{max-width:1160px;margin:0 auto;padding:40px 28px 90px;
  display:flex;flex-direction:column;gap:26px}
.curso-linha{background:var(--raise);border:1px solid var(--line-soft);border-radius:24px;
  overflow:hidden;box-shadow:0 10px 34px var(--accent-soft);display:grid;grid-template-columns:.9fr 1.4fr}
.curso-linha-capa{min-height:240px;position:relative;display:block;
  background-color:#0b7486;
  background-image:linear-gradient(135deg,rgba(0,151,178,.55),rgba(11,116,134,.9)),
    repeating-linear-gradient(135deg,rgba(255,255,255,.05) 0 14px,rgba(255,255,255,0) 14px 28px)}
.curso-linha-capa img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.curso-linha-selo{position:absolute;top:18px;left:18px;z-index:2;background:rgba(255,255,255,.92);
  color:var(--ink);font-size:12px;font-weight:700;padding:6px 14px;border-radius:999px}
.curso-linha-corpo{padding:36px}
.curso-linha-titulo{font-size:28px;font-weight:700;color:var(--ink);line-height:1.15;display:block}
.curso-linha-titulo:hover{color:var(--accent)}
.curso-linha-resumo{font-size:16px;color:var(--ink-soft);line-height:1.6;margin:12px 0 18px}
.curso-linha-chips{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:22px}
.curso-linha-chips span{font-size:13px;font-weight:600;color:var(--ink);background:var(--accent-soft);
  padding:7px 14px;border-radius:999px}
.curso-linha-rodape{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.curso-linha-preco{font-size:26px;font-weight:700;color:var(--ink)}
.curso-linha-parcela{font-size:13px;color:var(--ink-soft)}
.curso-linha-acoes{display:flex;gap:10px;flex-wrap:wrap}
.curso-linha-acoes .btn{padding:13px 24px;font-size:15px}
/* bloco "Não sabe por onde começar?" */
.lista-ajuda{background:var(--raise);border-top:1px solid var(--line-soft);padding:70px 28px}
.lista-ajuda .dentro{max-width:820px;margin:0 auto;text-align:center}
.lista-ajuda h2{font-size:28px;color:var(--ink);margin-bottom:12px}
.lista-ajuda p{font-size:16px;color:var(--ink-soft);line-height:1.6;margin-bottom:24px}
@media (max-width:860px){
  .curso-linha{grid-template-columns:1fr}
  .curso-linha-capa{min-height:170px}
  .curso-linha-corpo{padding:26px}
}

/* ================= CHECKOUT (protótipo aprovado) =================
   Transposição de docs/design/pages/Checkout.dc.html — a estrutura e o estilo.

   O protótipo desenha campos de cartão (número, validade, CVV) e se anuncia
   como "ambiente de demonstração", com uma nota dizendo para plugar o gateway
   no lugar do finish(). O checkout real deste projeto é HOSPEDADO: o site
   coleta identificação e consentimento, cria o pedido e manda para a página do
   provedor. Nenhum dado de cartão passa por aqui, e é assim que fica — trazer
   os campos do protótipo criaria escopo de PCI que o projeto não tem e não
   quer. Por isso o passo 2 explica onde o pagamento acontece, em vez de
   simular um formulário que não é usado. */
.ck-wrap{max-width:1120px;margin:0 auto;padding:50px 28px 90px}
.ck-trilha{font-size:13px;color:var(--ink-soft);margin-bottom:18px}
.ck-trilha .atual{color:var(--ink)}
.ck-wrap h1{font-size:clamp(30px,4vw,44px);color:var(--ink);letter-spacing:-.6px;margin-bottom:8px}
.ck-sub{font-size:15px;color:var(--ink-soft);margin-bottom:34px}
.ck-layout{display:grid;grid-template-columns:1.5fr 1fr;gap:40px;align-items:start}
.ck-coluna{display:flex;flex-direction:column;gap:28px}
.ck-bloco{background:var(--raise);border:1px solid var(--line-soft);border-radius:20px;padding:30px}
.ck-bloco h2{font-size:19px;color:var(--ink);margin-bottom:20px}
.ck-campos{display:flex;flex-direction:column;gap:16px}
.ck-dupla{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.lbl{display:block;font-size:13px;font-weight:600;color:var(--ink);margin-bottom:6px}
/* Campo — mesma fonte do botão: Componentes.dc.html. O foco é anel macio sobre
   a borda de acento, não contorno que apaga a borda; e faltavam desabilitado e
   erro, então campo bloqueado e campo com erro ficavam iguais a campo normal.
   Erro nunca é só cor: a mensagem vai em .fi-erro, ao lado do estado. */
.fi{width:100%;padding:13px 15px;border:1.5px solid var(--line);border-radius:var(--radius-sm);
  background:var(--raise);color:var(--ink);font-size:15px;font-family:inherit;
  transition:border-color .15s ease,box-shadow .15s ease}
.fi:focus,.fi:focus-visible{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.fi[disabled],.fi[readonly]{background:var(--surface-2);color:var(--ink-faint);cursor:not-allowed}
.fi.err,.fi[aria-invalid="true"]{border-color:var(--crit);box-shadow:0 0 0 3px var(--crit-bg)}
.fi-erro{display:block;margin-top:6px;font-size:13px;font-weight:600;color:var(--crit)}
.fi::placeholder{color:var(--ink-faint)}
/* Onde o pagamento realmente acontece. */
.ck-provedor{display:flex;gap:16px;align-items:flex-start;background:var(--paper);
  border-radius:14px;padding:20px;font-size:14px;color:var(--ink-soft);line-height:1.6}
.ck-provedor .selo{width:44px;height:44px;border-radius:12px;flex:none;display:grid;place-items:center;
  background:var(--accent-soft);color:var(--accent)}
.ck-provedor .selo svg{width:22px;height:22px}
.ck-lgpd{display:flex;gap:12px;align-items:flex-start;font-size:14px;color:var(--ink-soft);
  line-height:1.5;cursor:pointer}
.ck-lgpd input{margin-top:3px;width:18px;height:18px;accent-color:var(--accent);flex:none}
.ck-lgpd a{color:var(--accent)}
.ck-erro{background:var(--crit-bg);border:1px solid var(--crit-line);color:var(--crit);
  border-radius:12px;padding:14px 18px;font-size:14px}
.ck-pagar{padding:18px;font-size:17px;width:100%}
.ck-nota{font-size:12px;color:var(--ink-faint);text-align:center;line-height:1.5}
/* resumo */
.ck-resumo{position:sticky;top:100px;background:var(--raise);border:1px solid var(--line);
  border-radius:22px;padding:30px;box-shadow:0 16px 44px var(--accent-soft)}
.ck-resumo h2{font-size:19px;color:var(--ink);margin-bottom:18px}
.ck-itens{display:flex;flex-direction:column;gap:14px;margin-bottom:18px}
.ck-item{display:flex;justify-content:space-between;gap:12px;font-size:15px}
.ck-item .nome{color:var(--ink-soft)}
.ck-item .valor{color:var(--ink);font-weight:600;white-space:nowrap}
.ck-total{border-top:1px solid var(--line-soft);padding-top:16px;display:flex;
  justify-content:space-between;align-items:baseline}
.ck-total .rotulo{font-weight:700;color:var(--ink)}
.ck-total .valor{font-size:26px;font-weight:700;color:var(--ink)}
.ck-garantias{margin-top:20px;display:flex;flex-direction:column;gap:10px}
.ck-garantias div{display:flex;gap:10px;font-size:13px;color:var(--ink-soft)}
.ck-garantias .ok{color:#2e9377}
@media (max-width:900px){
  .ck-layout{grid-template-columns:1fr;gap:28px}
  .ck-resumo{position:static}
  .ck-dupla{grid-template-columns:1fr}
}

/* ================= HOME (protótipo aprovado) =================
   Transposição de docs/design/pages/Home.dc.html: faixa de confiança no hero,
   bloco de afirmação com ladrilhos, barra de números, "por que escolher" em
   seis cartões numerados. */
.hero-confianca{display:flex;flex-wrap:wrap;gap:14px 26px;margin-top:26px;align-items:center}
.hero-confianca .item{display:inline-flex;align-items:center;gap:9px;font-size:13.5px;color:#dceaef}
.hero-confianca .estrelas{color:var(--brand-orange);letter-spacing:1px}
.hero-confianca .selo{display:inline-flex;align-items:center;justify-content:center;
  border:1px solid rgba(255,255,255,.4);border-radius:8px;padding:3px 9px;
  font-size:11.5px;font-weight:800;letter-spacing:.06em}
/* afirmação + ladrilhos */
.afirmacao{display:grid;grid-template-columns:1.1fr .9fr;gap:44px;align-items:center}
.afirmacao h2{font-size:clamp(22px,2.6vw,30px);color:var(--ink);line-height:1.35;
  letter-spacing:-.4px;max-width:24ch}
.afirmacao .maisinfo{display:inline-flex;align-items:center;gap:8px;margin-top:20px;
  font-weight:700;color:var(--accent);font-size:15px}
.afirmacao .maisinfo:hover{color:var(--accent-ink)}
.ladrilhos{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.ladrilho{border-radius:16px;min-height:132px;padding:18px;display:flex;align-items:flex-end;
  color:#fff;font-weight:700;font-size:15px;line-height:1.3;
  background-color:#0b7486;
  background-image:linear-gradient(135deg,rgba(0,151,178,.55),rgba(11,116,134,.9)),
    repeating-linear-gradient(135deg,rgba(255,255,255,.05) 0 14px,rgba(255,255,255,0) 14px 28px)}
/* barra de números */
.barra-numeros{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));
  gap:24px;text-align:center;color:var(--on-deep)}
.barra-numeros .valor{font-size:38px;font-weight:800;line-height:1.1}
.barra-numeros .rotulo{color:#cfe0dc;font-size:14px;margin-top:4px}
.barra-numeros .base{color:#a9c9d2;font-size:12px;margin-top:2px}
/* por que escolher */
.porque{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.porque-item{background:var(--raise);border:1px solid var(--line-soft);border-radius:18px;padding:26px}
.porque-item .n{width:34px;height:34px;border-radius:10px;background:var(--accent-soft);
  color:var(--accent);font-weight:800;font-size:15px;display:grid;place-items:center;margin-bottom:14px}
.porque-item .t{font-weight:700;color:var(--ink);font-size:17px}
.porque-item .d{font-size:14.5px;color:var(--ink-soft);line-height:1.55;margin-top:6px}
@media (max-width:900px){
  .afirmacao{grid-template-columns:1fr;gap:28px}
  .porque{grid-template-columns:1fr}
}

/* ================= CARRINHO (protótipo aprovado) =================
   Transposição de docs/design/pages/Carrinho.dc.html.

   O carrinho mora no localStorage deste navegador, entao a pagina chega vazia
   do servidor e e preenchida pelo /_pub/site.js. Sem JS, fica o aviso que ja
   veio no HTML — nunca uma lista vazia se passando por carrinho vazio.

   O seletor de quantidade do protótipo (− 1 +) NAO veio: curso nao se compra em
   dobro. O servidor colapsa duplicata ao criar o pedido, entao um botao que
   deixasse marcar 3 e cobrasse 1 seria tela que mente. Ver o comentario da rota. */
.carrinho-topo{max-width:1100px;margin:0 auto;padding:50px 28px 20px}
.carrinho-topo h1{font-size:clamp(30px,4vw,44px);color:var(--ink);letter-spacing:-.6px}
.carrinho-trilha{font-size:13px;color:var(--ink-soft);margin-bottom:18px}
.carrinho-trilha .atual{color:var(--ink)}
/* vazio */
.carrinho-vazio{max-width:640px;margin:0 auto;padding:40px 28px 100px;text-align:center}
.carrinho-vazio .icone{width:70px;height:70px;border-radius:50%;background:var(--accent-soft);
  display:flex;align-items:center;justify-content:center;margin:0 auto 20px;color:var(--accent)}
.carrinho-vazio h2{font-size:24px;color:var(--ink);margin-bottom:10px}
.carrinho-vazio p{font-size:16px;color:var(--ink-soft);margin-bottom:24px}
/* com itens */
.carrinho-layout{max-width:1100px;margin:0 auto;padding:30px 28px 100px;display:grid;
  grid-template-columns:1.7fr 1fr;gap:40px;align-items:start}
.carrinho-itens{display:flex;flex-direction:column;gap:16px}
.carrinho-item{background:var(--raise);border:1px solid var(--line-soft);border-radius:18px;
  padding:22px;display:flex;gap:20px;align-items:center}
.carrinho-capa{width:90px;height:90px;border-radius:12px;flex-shrink:0;display:block;
  background-color:#0b7486;background-size:cover;background-position:center;
  background-image:linear-gradient(135deg,rgba(0,151,178,.55),rgba(11,116,134,.9)),
    repeating-linear-gradient(135deg,rgba(255,255,255,.05) 0 14px,rgba(255,255,255,0) 14px 28px)}
.carrinho-item .meio{flex:1;min-width:0}
.carrinho-item .titulo{font-weight:700;color:var(--ink);font-size:19px;display:block}
.carrinho-item .titulo:hover{color:var(--accent)}
.carrinho-item .tipo{font-size:13px;color:var(--ink-soft);margin-top:4px}
.carrinho-item .tirar{margin-top:8px;background:none;border:0;color:var(--crit);font-size:13px;
  font-weight:600;cursor:pointer;padding:0;font-family:inherit}
.carrinho-item .tirar:hover{text-decoration:underline}
.carrinho-item .valor{font-weight:700;color:var(--ink);font-size:18px;min-width:100px;text-align:right}
.carrinho-continuar{font-weight:600;color:var(--accent);font-size:15px;margin-top:6px;display:inline-block}
/* resumo */
.carrinho-resumo{position:sticky;top:100px;background:var(--raise);border:1px solid var(--line);
  border-radius:22px;padding:30px;box-shadow:0 16px 44px var(--accent-soft)}
.carrinho-resumo h2{font-size:20px;color:var(--ink);margin-bottom:20px}
.carrinho-linha{display:flex;justify-content:space-between;font-size:15px;color:var(--ink-soft);margin-bottom:10px}
.carrinho-total{border-top:1px solid var(--line-soft);padding-top:16px;display:flex;
  justify-content:space-between;align-items:baseline;margin-top:6px}
.carrinho-total .rotulo{font-weight:700;color:var(--ink)}
.carrinho-total .valor{font-size:28px;font-weight:700;color:var(--ink)}
.carrinho-nota{font-size:13px;color:var(--ink-soft);margin-top:6px}
.carrinho-resumo .btn{width:100%;margin-top:22px;padding:16px;font-size:16px}
.carrinho-zap{display:block;text-align:center;margin-top:10px;font-size:14px;color:var(--ink-soft)}
.carrinho-zap:hover{color:var(--accent)}
@media (max-width:900px){
  .carrinho-layout{grid-template-columns:1fr;gap:28px}
  .carrinho-resumo{position:static}
  .carrinho-item{flex-wrap:wrap}
  .carrinho-item .valor{text-align:left;min-width:0}
}
`.trim();

/**
 * O CSS acima é inlinado no <head> de TODA página (é o que evita um request
 * bloqueante e protege o LCP). Comentário, portanto, viaja junto: os 3,9 KB de
 * "porquês" que este arquivo carrega chegavam ao navegador de cada visitante.
 *
 * Explicação é para quem lê o código, não para quem lê o site. `PUBLIC_CSS`
 * segue sendo a fonte comentada; quem vai para o HTML é esta versão enxuta.
 *
 * Só comentários saem — nenhuma regra é reescrita. Minificar de verdade pedia
 * uma dependência, e o ganho não paga.
 */
export const PUBLIC_CSS_SERVIDO = PUBLIC_CSS.replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\n{2,}/g, '\n')
  .trim();

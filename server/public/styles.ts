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
  --paper:#f3f4f1;--surface:#fbfcfa;--surface-2:#eaece6;--raise:#fff;
  --ink:#1b1e22;--ink-soft:#575c62;--ink-faint:#868c92;
  --line:#dcdfd8;--line-soft:#e8eae4;
  --accent:#0097b2;--accent-ink:#007a91;--accent-soft:#d9eef4;--on-accent:#ffffff;
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
  --radius:14px;--shadow:0 1px 2px rgba(20,25,30,.04),0 4px 16px rgba(20,25,30,.05);
  --wrap:1180px;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --paper:#101216;--surface:#181b20;--surface-2:#20242a;--raise:#1e2228;
  --ink:#e9ebe6;--ink-soft:#9ea4aa;--ink-faint:#6e747b;
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
.btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;
  border-radius:999px;padding:14px 28px;font-weight:700;font-size:15px;cursor:pointer;border:1.5px solid transparent;transition:transform .12s ease,filter .12s ease;font-family:inherit}
.btn:hover{filter:brightness(1.05)}.btn:active{transform:translateY(1px)}
.btn-primary{background:var(--accent);color:var(--on-accent)}
.btn-outline{border-color:var(--line);color:var(--ink);background:var(--raise)}
/* CTA de conversão (matrícula, checkout, entrar no AVA): degradê laranja.
   O laranja é detalhe de identidade — usado só onde há decisão de compra. */
.btn-cta{background:var(--cta-gradient);color:#fff;font-weight:700;box-shadow:0 12px 30px rgba(255,145,77,.35)}
.btn-cta:hover{filter:brightness(1.04)}
.btn-wa{background:#25d366;color:#fff;box-shadow:0 10px 26px rgba(37,211,102,.35)}
.btn-wa svg{width:18px;height:18px;flex:none}
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
.cart-link{position:relative;display:inline-flex;align-items:center;gap:7px;padding:8px 11px;border-radius:9px;font-size:14.5px;color:rgba(255,255,255,.85)}
.cart-link:hover{background:rgba(255,255,255,.12);color:#fff}
.cart-badge{min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:var(--brand-orange);color:#fff;font-size:11px;font-weight:800;display:none;align-items:center;justify-content:center}
.cart-badge[data-count]:not([data-count="0"]){display:inline-flex}
/* Botões do topo: vivem sobre o degradê, então não usam as variantes claras. */
.btn-topo{background:transparent;border:1px solid rgba(255,255,255,.35);color:#fff;
  border-radius:999px;padding:8px 13px;font-size:14px;cursor:pointer;font-family:inherit;line-height:1}
.btn-topo:hover{background:rgba(255,255,255,.15)}
.btn-topo-cheio{background:#fff;color:var(--brand-deep);border-radius:999px;padding:9px 20px;
  font-weight:700;font-size:14.5px;border:0}
.btn-topo-cheio:hover{background:rgba(255,255,255,.9)}
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
.selo-rntp{width:132px;height:132px;border-radius:50%;border:2px solid rgba(255,255,255,.35);
  background:rgba(255,255,255,.08);display:grid;place-content:center;text-align:center;gap:4px;padding:10px}
.selo-rntp span{font-size:22px;font-weight:800;letter-spacing:.06em}
.selo-rntp small{font-size:9px;letter-spacing:.08em;line-height:1.35;color:#dceaef}
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
@media (max-width:900px){
  .nav{display:none}.menu-toggle{display:inline-flex}
  .two-col,.three-col{grid-template-columns:1fr}
  .site-footer .cols{grid-template-columns:1fr 1fr;gap:28px}
  .nav.open{display:flex;position:absolute;top:64px;left:0;right:0;flex-direction:column;align-items:stretch;background:var(--brand-deep);padding:12px 24px;gap:2px}
}
@media (max-width:860px){.site-footer .cols,.site-footer .cols.cols-2{grid-template-columns:1fr}.rodape-privacidade{text-align:center;align-items:center}}
`.trim();

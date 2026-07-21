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
  --accent:#0f6e66;--accent-ink:#0c5651;--accent-soft:#dcebe8;--on-accent:#fff;
  --brand-deep:#0b3b37;--on-deep:#eef3f1;
  --orange:#e6852f;--orange-soft:#f6ede1;
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
  --accent:#52bcb0;--accent-ink:#7fd2c8;--accent-soft:#16302d;--on-accent:#0c1f1d;
  --brand-deep:#0a2f2c;--on-deep:#eef3f1;--orange:#e2954a;--orange-soft:#2a2113;
  --good:#5cbd83;--good-bg:#16281d;--good-line:#274a34;
  --warn:#d6a24c;--warn-bg:#2c2413;--warn-line:#4a3c1c;
  --crit:#e08066;--crit-bg:#2c1a14;--crit-line:#4d2c22;
  --shadow:0 1px 2px rgba(0,0,0,.3),0 6px 20px rgba(0,0,0,.28);
}}
:root[data-theme="dark"]{
  --paper:#101216;--surface:#181b20;--surface-2:#20242a;--raise:#1e2228;
  --ink:#e9ebe6;--ink-soft:#9ea4aa;--ink-faint:#6e747b;
  --line:#2b2f36;--line-soft:#242830;
  --accent:#52bcb0;--accent-ink:#7fd2c8;--accent-soft:#16302d;--on-accent:#0c1f1d;
  --brand-deep:#0a2f2c;--on-deep:#eef3f1;--orange:#e2954a;--orange-soft:#2a2113;
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
.btn-wa{background:#25d366;color:#0b3b1e}
.tag-chip{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:var(--ink-soft);
  background:var(--surface-2);border:1px solid var(--line-soft);padding:5px 11px;border-radius:8px}
/* ---- header ---- */
.site-header{position:sticky;top:0;z-index:100;background:color-mix(in srgb,var(--paper) 88%,transparent);
  backdrop-filter:saturate(1.2) blur(10px);border-bottom:1px solid var(--line)}
.site-header .bar{display:flex;align-items:center;justify-content:space-between;gap:18px;height:66px}
.brand{display:flex;align-items:center;gap:10px;font-weight:800;letter-spacing:-.02em;font-size:18px}
.brand .mark{width:30px;height:30px;border-radius:8px;background:linear-gradient(135deg,#0a3f3a,#1f9e93);display:grid;place-items:center;color:#fff;font-size:15px}
.nav{display:flex;align-items:center;gap:6px}
.nav a{padding:9px 13px;border-radius:9px;font-weight:600;font-size:14.5px;color:var(--ink-soft)}
.nav a:hover,.nav a[aria-current="page"]{color:var(--ink);background:var(--surface-2)}
.header-cta{display:flex;align-items:center;gap:10px}
.cart-link{position:relative;display:inline-flex;align-items:center;gap:7px;padding:9px 13px;border-radius:9px;font-weight:600;font-size:14.5px;color:var(--ink-soft)}
.cart-link:hover{background:var(--surface-2);color:var(--ink)}
.cart-badge{min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:var(--accent);color:var(--on-accent);font-size:11px;font-weight:800;display:none;align-items:center;justify-content:center}
.cart-badge[data-count]:not([data-count="0"]){display:inline-flex}
.menu-toggle{display:none;background:none;border:1px solid var(--line);border-radius:9px;padding:8px 10px;cursor:pointer;color:var(--ink)}
/* ---- hero deep ---- */
.hero-deep{background:var(--brand-deep);color:var(--on-deep)}
.hero-deep .eyebrow{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.18);color:#dfeeea}
.hero-deep h1{color:#fff}
.hero-deep .lead{color:#cfe0dc}
/* ---- footer ---- */
.site-footer{background:var(--brand-deep);color:var(--on-deep);margin-top:64px}
.site-footer a{color:#cfe0dc}.site-footer a:hover{color:#fff}
.site-footer .cols{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:36px;padding:56px 0 40px}
.site-footer h4{font-size:13px;text-transform:uppercase;letter-spacing:.1em;color:#9fc0ba;margin:0 0 14px;font-weight:700}
.site-footer ul{list-style:none;margin:0;padding:0;display:grid;gap:9px;font-size:14.5px}
.site-footer .legal{border-top:1px solid rgba(255,255,255,.12);padding:20px 0;display:flex;flex-wrap:wrap;gap:8px 20px;justify-content:space-between;font-size:12.5px;color:#9fc0ba}
.disclaimer{background:var(--warn-bg);border:1px solid var(--warn-line);color:var(--ink);border-radius:12px;padding:14px 16px;font-size:13.5px;line-height:1.6}
.wa-float{position:fixed;right:20px;bottom:20px;width:56px;height:56px;border-radius:50%;background:#25d366;color:#0b3b1e;display:grid;place-items:center;box-shadow:0 6px 20px rgba(0,0,0,.25);z-index:90}
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
  .nav.open{display:flex;position:absolute;top:66px;left:0;right:0;flex-direction:column;align-items:stretch;background:var(--paper);border-bottom:1px solid var(--line);padding:12px 24px}
}
@media (max-width:560px){.site-footer .cols{grid-template-columns:1fr}}
`.trim();

/**
 * Auditoria de carregamento no celular, contra o site publico de producao.
 *
 * Roda com `npx tsx scripts/auditar_carregamento_mobile.mts`. Emula um Pixel 5
 * com a rede "Slow 4G" do Lighthouse (1,6 Mbps de descida, 150 ms de ida e
 * volta) e CPU 4x mais lenta — que e a maquina do aluno mediano, nao a de quem
 * programa.
 *
 * Foi ele que mediu, em 8/set/2026, os 6,9 s de LCP da home. O numero que
 * importa e o **TTFB**: ele isola tempo de servidor de tempo de rede, e foi por
 * ele que se chegou a `numerosDoSite`, que sozinho custava 2,5 s.
 *
 * Para separar servidor de rede de vez, o par deste script e um `curl` rodado
 * DENTRO do VPS, no 127.0.0.1 — sem rede nenhuma no meio.
 */
import { chromium, devices } from '@playwright/test';

const PAGINAS = [
  ['home', 'https://psicanaliseclinica.online/'],
  ['curso', 'https://psicanaliseclinica.online/formacao/curso-de-psicanalise-clinica-online'],
  ['checkout', 'https://psicanaliseclinica.online/checkout?curso=curso-de-psicanalise-clinica-online'],
] as const;

const b = await chromium.launch();

/*
  Aquece antes de medir.

  A primeira requisicao de uma serie paga o que ninguem quer medir: processo
  frio, pool do banco vazio, TLS do zero. Sem este passo a PRIMEIRA pagina da
  lista sempre parecia a pior — a home apareceu com 6 s de TTFB enquanto o
  servidor respondia em 0,9 s, e a conclusao teria sido sobre a pagina errada.
*/
{
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  for (const [, url] of PAGINAS) await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await ctx.close();
}

for (const [nome, url] of PAGINAS) {
  const ctx = await b.newContext({ ...devices['Pixel 5'] });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Network.enable');
  // Slow 4G do Lighthouse: 1.6 Mbps down, 750 kbps up, 150 ms de ida e volta.
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false, latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  const recursos: Array<{ url: string; tipo: string; bytes: number }> = [];
  p.on('response', async (r) => {
    try {
      const h = r.headers();
      const len = Number(h['content-length'] ?? 0);
      recursos.push({ url: r.url(), tipo: r.request().resourceType(), bytes: len });
    } catch { /* ignora */ }
  });

  const t0 = Date.now();
  await p.goto(url, { waitUntil: 'load', timeout: 120000 });
  const carregou = Date.now() - t0;

  const m = await p.evaluate(() => {
    return new Promise<Record<string, number>>((res) => {
      const out: Record<string, number> = {};
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      out.ttfb = Math.round(nav.responseStart);
      out.domContentLoaded = Math.round(nav.domContentLoadedEventEnd);
      out.load = Math.round(nav.loadEventEnd);
      const fcp = performance.getEntriesByName('first-contentful-paint')[0];
      out.fcp = fcp ? Math.round(fcp.startTime) : -1;
      let lcp = 0;
      try {
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) lcp = Math.max(lcp, e.startTime);
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      } catch { /* ignora */ }
      let cls = 0;
      try {
        new PerformanceObserver((l) => {
          for (const e of l.getEntries() as unknown as Array<{ value: number; hadRecentInput: boolean }>) {
            if (!e.hadRecentInput) cls += e.value;
          }
        }).observe({ type: 'layout-shift', buffered: true });
      } catch { /* ignora */ }
      setTimeout(() => {
        out.lcp = Math.round(lcp);
        out.cls = Math.round(cls * 1000) / 1000;
        res(out);
      }, 1200);
    });
  });

  const total = recursos.reduce((s, r) => s + r.bytes, 0);
  const porTipo = new Map<string, { n: number; bytes: number }>();
  for (const r of recursos) {
    const a = porTipo.get(r.tipo) ?? { n: 0, bytes: 0 };
    a.n++; a.bytes += r.bytes;
    porTipo.set(r.tipo, a);
  }
  const kb = (n: number) => (n / 1024).toFixed(0) + 'kB';

  console.log(`\n=== ${nome}  (${recursos.length} requisições, ${kb(total)})`);
  console.log(`    TTFB ${m.ttfb}ms | FCP ${m.fcp}ms | LCP ${m.lcp}ms | DCL ${m.domContentLoaded}ms | load ${m.load}ms | CLS ${m.cls} | parede ${carregou}ms`);
  for (const [tipo, a] of [...porTipo.entries()].sort((x, y) => y[1].bytes - x[1].bytes)) {
    console.log(`    ${tipo.padEnd(12)} ${String(a.n).padStart(3)}  ${kb(a.bytes).padStart(8)}`);
  }
  const maiores = recursos.filter((r) => r.bytes > 30 * 1024).sort((a, c) => c.bytes - a.bytes).slice(0, 6);
  for (const r of maiores) console.log(`      ${kb(r.bytes).padStart(8)}  ${r.url.replace('https://psicanaliseclinica.online', '')}`);
  await ctx.close();
}
await b.close();

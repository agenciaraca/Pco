import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { naoVazio } from './nao-vazio';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let collector: typeof import('../server/analytics/collector');
let store: typeof import('../server/analytics/traffic-store');
let relatorio: typeof import('../server/analytics/relatorio');

const CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-analytics-'));
  process.env.DATA_DIR = tmpDir;
  collector = await import('../server/analytics/collector');
  store = await import('../server/analytics/traffic-store');
  relatorio = await import('../server/analytics/relatorio');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  collector._reset();
});

/** Hoje no fuso do servidor — o mesmo cálculo que o coletor faz. */
function hojeISO(d = new Date()): string {
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}

describe('classificação de origem', () => {
  it('sem referrer é direto', () => {
    expect(collector.classificaOrigem('', '', 'ava.pco')).toBe('direto');
  });

  it('buscador é orgânico', () => {
    expect(collector.classificaOrigem('https://www.google.com/search?q=x', '', 'ava.pco')).toBe(
      'organico',
    );
  });

  it('rede social é social', () => {
    expect(collector.classificaOrigem('https://www.instagram.com/', '', 'ava.pco')).toBe('social');
  });

  it('outro site é referral', () => {
    expect(collector.classificaOrigem('https://blog.exemplo.com/post', '', 'ava.pco')).toBe(
      'referral',
    );
  });

  it('o próprio domínio não conta como origem nova', () => {
    expect(collector.classificaOrigem('https://ava.pco/cursos', '', 'ava.pco')).toBe('direto');
    expect(collector.classificaOrigem('https://www.ava.pco/cursos', '', 'ava.pco')).toBe('direto');
  });

  it('utm_medium vence o referrer', () => {
    // Veio do Instagram, mas a campanha foi marcada como e-mail: quem marcou
    // sabe mais do que o cabeçalho.
    expect(
      collector.classificaOrigem('https://www.instagram.com/', 'newsletter', 'ava.pco'),
    ).toBe('email');
  });
});

describe('classificação de dispositivo', () => {
  it('iPhone é mobile', () => {
    expect(collector.classificaDispositivo(IPHONE)).toBe('mobile');
  });
  it('desktop é o padrão', () => {
    expect(collector.classificaDispositivo(CHROME)).toBe('desktop');
  });
  it('iPad é tablet, não mobile', () => {
    expect(collector.classificaDispositivo('Mozilla/5.0 (iPad; CPU OS 17_0)')).toBe('tablet');
  });
});

describe('normalização de caminho', () => {
  it('tira querystring, hash e barra final', () => {
    expect(collector.normalizaCaminho('/cursos/psicanalise/?a=1#topo')).toBe('/cursos/psicanalise');
  });
  it('troca id por marcador para não explodir a cardinalidade', () => {
    expect(collector.normalizaCaminho('/aprender/curso-a1b2c3d4/aula/99999')).toBe(
      '/aprender/:id/aula/:id',
    );
  });
  it('preserva slug legível — é o que dá utilidade à tabela de páginas', () => {
    expect(collector.normalizaCaminho('/cursos/psicanalise-clinica')).toBe(
      '/cursos/psicanalise-clinica',
    );
  });

  it('slug com hífen não é confundido com id', () => {
    // Regressão de 27/ago/2026: a primeira regra dizia "prefixo curto + hífen
    // + sufixo longo = id", e engolia `/pagina-inexistente`. O efeito ruim era
    // na tabela de 404, que passava a mostrar `/:id` em vez do endereço que o
    // visitante tentou — exatamente o que ela existe para revelar.
    expect(collector.normalizaCaminho('/pagina-inexistente')).toBe('/pagina-inexistente');
    expect(collector.normalizaCaminho('/blog/como-estudar-psicanalise')).toBe(
      '/blog/como-estudar-psicanalise',
    );
    // O que tem dígito misturado continua sendo id.
    expect(collector.normalizaCaminho('/curso/curso-a1b2c3d4')).toBe('/curso/:id');
  });
  it('raiz continua raiz', () => {
    expect(collector.normalizaCaminho('/')).toBe('/');
  });
});

describe('o que não é contado', () => {
  it('bot conhecido é descartado', async () => {
    const r = await collector.registraHit({
      sessionId: 'sessao-bot-0001',
      path: '/',
      userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1)',
    });
    expect(r).toEqual({ registrado: false, motivo: 'bot' });
  });

  it('requisição sem user-agent é tratada como script', async () => {
    const r = await collector.registraHit({ sessionId: 'sessao-sem-ua-1', path: '/' });
    expect(r).toEqual({ registrado: false, motivo: 'bot' });
  });

  it('navegação no admin não vira tráfego do site', async () => {
    const r = await collector.registraHit({
      sessionId: 'sessao-admin-01',
      path: '/admin/metricas',
      userAgent: CHROME,
    });
    expect(r).toEqual({ registrado: false, motivo: 'admin' });
  });
});

/**
 * Cada caso recebe um dia só seu. O store persiste entre os testes deste
 * arquivo — sem datas distintas, um caso soma no contador do outro e a suíte
 * fica verde ou vermelha pela ordem em que rodou, não pelo que mede.
 */
function dia(n: number): number {
  return new Date(2026, 2, n, 10, 0, 0).getTime();
}

describe('sessão, rejeição e tempo', () => {
  it('a primeira página abre sessão e nasce como rejeição', async () => {
    const t0 = dia(1);
    await collector.registraHit(
      { sessionId: 'ss-rejeita-01', path: '/cursos', userAgent: CHROME },
      t0,
    );
    await collector.flush();

    const medido = await store.lerDia(hojeISO(new Date(t0)));
    expect(medido?.sessions).toBe(1);
    expect(medido?.bounces).toBe(1);
    expect(medido?.pageviews).toBe(1);
  });

  it('a segunda página desfaz a rejeição e soma o tempo', async () => {
    const t0 = dia(2);
    await collector.registraHit(
      { sessionId: 'ss-segue-001', path: '/cursos', userAgent: CHROME },
      t0,
    );
    await collector.registraHit(
      { sessionId: 'ss-segue-001', path: '/jornada', userAgent: CHROME },
      t0 + 45_000,
    );
    await collector.flush();

    const medido = await store.lerDia(hojeISO(new Date(t0)));
    expect(medido?.sessions).toBe(1); // continua sendo uma visita
    expect(medido?.pageviews).toBe(2);
    expect(medido?.bounces).toBe(0);
    expect(medido?.totalSessionSeconds).toBe(45);
    // A rejeição sai da página de entrada, não da segunda.
    expect(medido?.byPath['/cursos']?.bounces).toBe(0);
    expect(medido?.byPath['/cursos']?.entries).toBe(1);
    expect(medido?.byPath['/jornada']?.entries).toBe(0);
  });

  it('meia hora de silêncio começa uma visita nova', async () => {
    const t0 = dia(3);
    await collector.registraHit({ sessionId: 'ss-ttl-0001', path: '/', userAgent: CHROME }, t0);
    await collector.registraHit(
      { sessionId: 'ss-ttl-0001', path: '/', userAgent: CHROME },
      t0 + 31 * 60_000,
    );
    await collector.flush();

    const medido = await store.lerDia(hojeISO(new Date(t0)));
    expect(medido?.sessions).toBe(2);
  });

  it('LCP cai na faixa certa do histograma', async () => {
    const t0 = dia(4);
    await collector.registraHit(
      { sessionId: 'ss-lcp-0001', path: '/', userAgent: CHROME, lcpMs: 1800 },
      t0,
    );
    await collector.flush();

    const medido = await store.lerDia(hojeISO(new Date(t0)));
    expect(medido?.lcpCount).toBe(1);
    // 1800ms / 250ms = faixa 7
    expect(medido?.lcpBuckets[7]).toBe(1);
  });

  it('sinal só de desempenho soma LCP e NÃO conta página vista', async () => {
    // Regressão de 27/ago/2026. A primeira versão esperava 2 segundos para
    // mandar a página junto com o LCP, e o próprio E2E mostrou o estrago: de
    // ~20 navegações, duas foram contadas. Pior que o buraco era o viés —
    // quem sai em menos de dois segundos é exatamente quem rejeita, então a
    // taxa de rejeição sairia mais baixa que a verdade.
    const t0 = dia(6);
    await collector.registraHit(
      { sessionId: 'ss-vitals-001', path: '/', userAgent: CHROME },
      t0,
    );
    const r = await collector.registraHit(
      {
        sessionId: 'ss-vitals-001',
        path: '/',
        userAgent: CHROME,
        lcpMs: 1200,
        apenasVitals: true,
      },
      t0 + 3_000,
    );
    expect(r).toEqual({ registrado: true, sessaoNova: false, apenasVitals: true });
    await collector.flush();

    const medido = await store.lerDia(hojeISO(new Date(t0)));
    // Uma página, uma sessão, e a rejeição continua de pé: o sinal de
    // desempenho não pode transformar visita de uma página em visita de duas.
    expect(medido?.pageviews).toBe(1);
    expect(medido?.sessions).toBe(1);
    expect(medido?.bounces).toBe(1);
    // E o LCP entrou: 1200 / 250 = faixa 4.
    expect(medido?.lcpCount).toBe(1);
    expect(medido?.lcpBuckets[4]).toBe(1);
  });

  it('sinal de desempenho de bot continua descartado', async () => {
    const r = await collector.registraHit({
      sessionId: 'ss-vitals-bot1',
      path: '/',
      userAgent: 'Googlebot/2.1',
      lcpMs: 900,
      apenasVitals: true,
    });
    expect(r).toEqual({ registrado: false, motivo: 'bot' });
  });

  it('404 é contado por rota', async () => {
    const t0 = dia(5);
    await collector.registraHit(
      { sessionId: 'ss-404-0001', path: '/pagina-que-sumiu', userAgent: CHROME, notFound: true },
      t0,
    );
    await collector.flush();

    const medido = await store.lerDia(hojeISO(new Date(t0)));
    expect(medido?.notFound['/pagina-que-sumiu']).toBe(1);
  });
});

describe('p75 do histograma', () => {
  it('sem amostra devolve null — não zero', () => {
    expect(store.p75DoHistograma([0, 0, 0], 0)).toBeNull();
  });

  it('devolve o topo da faixa onde o 75º percentil cai', () => {
    // 3 amostras na faixa 0 (0–250ms) e 1 na faixa 8 (2000–2250ms).
    const buckets = Array.from({ length: store.LCP_BUCKETS }, () => 0);
    buckets[0] = 3;
    buckets[8] = 1;
    expect(store.p75DoHistograma(buckets, 4)).toBe(250);
  });

  it('a cauda pesada puxa o p75 para cima', () => {
    const buckets = Array.from({ length: store.LCP_BUCKETS }, () => 0);
    buckets[0] = 1;
    buckets[8] = 3;
    expect(store.p75DoHistograma(buckets, 4)).toBe(9 * store.LCP_BUCKET_MS);
  });
});

describe('relatório', () => {
  it('sem medição os campos vêm null, e não zero — são coisas diferentes', async () => {
    const rel = await relatorio.montaRelatorio('7d', new Date('2020-01-15T12:00:00'));
    expect(rel.resumo.visitors).toBe(0);
    expect(rel.resumo.bounceRate).toBeNull();
    expect(rel.resumo.avgSessionMinutes).toBeNull();
    expect(rel.resumo.lcpP75Ms).toBeNull();
    expect(rel.diasComDados).toBe(0);
  });

  it('a série cobre todos os dias do período, inclusive os sem visita', async () => {
    const rel = await relatorio.montaRelatorio('7d', new Date('2020-01-15T12:00:00'));
    expect(rel.serie.length).toBe(7);
    expect(rel.serie[0]!.date).toBe('2020-01-09');
    expect(rel.serie[6]!.date).toBe('2020-01-15');
  });

  it('range inválido cai em 30d em vez de quebrar', () => {
    expect(relatorio.normalizaRange('nao-existe')).toBe('30d');
    expect(relatorio.normalizaRange(undefined)).toBe('30d');
    expect(relatorio.normalizaRange('90d')).toBe('90d');
  });

  it('agrega o que foi medido e classifica dispositivo e origem', async () => {
    collector._reset();
    const t0 = Date.now();
    const hoje = new Date(t0);
    await collector.registraHit(
      {
        sessionId: 'ss-rel-00001',
        path: '/catalogo',
        userAgent: IPHONE,
        referrer: 'https://www.google.com/',
      },
      t0,
    );
    await collector.registraHit(
      { sessionId: 'ss-rel-00001', path: '/cursos/x', userAgent: IPHONE },
      t0 + 30_000,
    );
    await collector.flush();

    const rel = await relatorio.montaRelatorio('7d', hoje);
    expect(rel.resumo.pageviews).toBeGreaterThanOrEqual(2);
    expect(rel.devices.some((d) => d.name === 'Mobile')).toBe(true);
    expect(rel.sources.some((s) => s.name === 'Orgânico')).toBe(true);
    expect(rel.medindoDesde).not.toBeNull();
    const catalogo = rel.topPages.find((p) => p.path === '/catalogo');
    expect(catalogo?.views).toBeGreaterThanOrEqual(1);
  });

  it('SEO técnico não afirma o que não mediu', async () => {
    const rel = await relatorio.montaRelatorio('7d', new Date('2020-01-15T12:00:00'));
    const itens = await relatorio.seoTecnico(rel);
    const lcp = itens.find((i) => i.label === 'LCP (p75)');
    expect(lcp?.status).toBe('desconhecido');
    expect(lcp?.value).toBe('—');
    // Todo item precisa dizer de onde veio.
    expect(naoVazio(itens).every((i) => i.fonte.length > 0)).toBe(true);
  });
});

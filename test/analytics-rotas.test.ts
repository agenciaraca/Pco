import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * O contrato das duas rotas da medição própria.
 *
 * `POST /analytics/hit` é **público de propósito** — quem visita o site não
 * está autenticado, e é exatamente essa visita que precisa ser contada. O que
 * protege é o que o coletor descarta e o teto de requisições, não credencial.
 *
 * `GET /admin/analytics/trafego` é o oposto: medição do negócio não sai sem
 * token de admin.
 */

let tmpDir: string;
let app: { fetch: (req: Request) => Response | Promise<Response> };

const CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-analytics-rotas-'));
  process.env.DATA_DIR = tmpDir;
  const mod = await import('../server/app');
  app = mod.buildApp();
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

function hit(body: unknown, userAgent = CHROME): Promise<Response> {
  return Promise.resolve(
    app.fetch(
      new Request('http://local/api/analytics/hit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': userAgent },
        body: JSON.stringify(body),
      }),
    ),
  );
}

describe('POST /analytics/hit', () => {
  it('aceita um sinal válido sem autenticação e não devolve corpo', async () => {
    const res = await hit({
      sessionId: 'teste-sessao-valida-1',
      path: '/catalogo',
      referrer: '',
      utmMedium: '',
      notFound: false,
    });
    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
  });

  it('só sessionId e path são obrigatórios — o resto tem padrão', async () => {
    const res = await hit({ sessionId: 'teste-sessao-minima', path: '/' });
    expect(res.status).toBe(204);
  });

  it('recusa corpo inválido em vez de contar lixo', async () => {
    const res = await hit({ sessionId: 'curto', path: '/' });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe('VALIDATION');
  });

  it('hit descartado (bot) também responde 204 — o navegador não usaria o erro', async () => {
    const res = await hit(
      { sessionId: 'teste-sessao-do-bot-x', path: '/' },
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    );
    expect(res.status).toBe(204);
  });

  it('não aceita campo que identifique quem visitou', async () => {
    // O schema é `z.object` sem passthrough: campo extra é descartado, nunca
    // chega ao coletor. Se alguém acrescentar `ip` ao schema, este teste não
    // pega — o que pega é a revisão. Aqui garantimos ao menos que hoje não passa.
    const res = await hit({
      sessionId: 'teste-sessao-com-ip1',
      path: '/',
      ip: '203.0.113.7',
      email: 'alguem@exemplo.com',
    });
    expect(res.status).toBe(204);
    const bruto = await fs
      .readFile(path.join(tmpDir, 'analytics-daily.json'), 'utf8')
      .catch(() => '');
    expect(bruto).not.toContain('203.0.113.7');
    expect(bruto).not.toContain('alguem@exemplo.com');
  });
});

describe('GET /admin/analytics/trafego', () => {
  it('exige token de admin', async () => {
    const res = await app.fetch(new Request('http://local/api/admin/analytics/trafego'));
    expect(res.status).toBe(401);
  });
});

describe('GET /metrics/seo/*', () => {
  it('status diz que a medição é própria, e o que ela não cobre', async () => {
    const res = await app.fetch(new Request('http://local/api/metrics/seo/status'));
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      fonte: string;
      conectado: boolean;
      semFonte: Array<{ o_que: string; depende_de: string }>;
    };
    expect(['propria', 'sem-historico']).toContain(json.fonte);
    expect(json.conectado).toBe(true);
    // O que depende do Search Console continua declarado como ausente.
    expect(json.semFonte.length).toBeGreaterThan(0);
    expect(json.semFonte.every((f) => f.depende_de.length > 0)).toBe(true);
  });

  it('palavras-chave voltam vazias em vez de inventadas', async () => {
    const res = await app.fetch(new Request('http://local/api/metrics/seo/keywords'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('a série tem um ponto por dia do período pedido', async () => {
    const res = await app.fetch(
      new Request('http://local/api/metrics/seo/timeseries?range=7d'),
    );
    expect(res.status).toBe(200);
    const serie = (await res.json()) as Array<{ date: string; visitors: number }>;
    expect(serie.length).toBe(7);
    expect(serie.every((p) => typeof p.visitors === 'number')).toBe(true);
  });
});

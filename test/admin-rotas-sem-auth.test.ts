import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * Toda rota `/admin/*` precisa de token — **inclusive as de leitura**.
 *
 * Em 27/ago/2026 cinco rotas de leitura não exigiam nada. A pior:
 * `GET /api/admin/students` devolvia nome, e-mail, progresso e score de risco
 * de todos os alunos para quem simplesmente pedisse a URL. Em produção são
 * cerca de duas mil pessoas.
 *
 * A causa é sutil e vai se repetir se ninguém vigiar: `attachUser` roda em
 * `*` e coloca o usuário no contexto **quando há token**. Quem lê o código
 * rápido vê um middleware global de autenticação onde há só um de conveniência.
 * `requireAuth` é que exige, e é rota a rota.
 *
 * Já existia `admin-routes-guard`, que cobre uma **amostra** de rotas de
 * escrita — e foi uma amostra que deixou estas cinco passarem. Este aqui
 * percorre o que o app de fato registrou: rota nova sem `requireAuth` cai na
 * suíte, não em produção.
 */

let tmpDir: string;
let app: {
  fetch: (req: Request) => Response | Promise<Response>;
  routes: Array<{ path: string; method: string }>;
};

/** Valor para preencher `:param` na hora de chamar a rota. */
const PARAM = 'x-teste';

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-admin-auth-'));
  process.env.DATA_DIR = tmpDir;
  const mod = await import('../server/app');
  app = mod.buildApp() as unknown as typeof app;
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

function concreta(rota: string): string {
  return rota.replace(/:[^/]+/g, PARAM);
}

/** As rotas de admin registradas, sem duplicatas de middleware. */
function rotasAdmin(): Array<{ method: string; path: string }> {
  const vistas = new Set<string>();
  const out: Array<{ method: string; path: string }> = [];
  for (const r of app.routes) {
    // `app.use('*')` entra aqui como método ALL — não é rota de negócio.
    if (r.method === 'ALL') continue;
    if (!r.path.startsWith('/api/admin')) continue;
    const chave = `${r.method} ${r.path}`;
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    out.push({ method: r.method, path: r.path });
  }
  return out;
}

describe('nenhuma rota /admin/* responde sem token', () => {
  it('o app registrou rotas de admin — senão este teste não prova nada', () => {
    const rotas = rotasAdmin();
    // Guarda contra a falha silenciosa: se `app.routes` mudar de forma e vier
    // vazio, o `for` abaixo passaria sem testar coisa nenhuma.
    expect(rotas.length).toBeGreaterThan(100);
  });

  it('todas devolvem 401 sem Authorization', async () => {
    const rotas = rotasAdmin();
    const vazando: string[] = [];

    for (const r of rotas) {
      const url = `http://local${concreta(r.path)}`;
      const init: RequestInit = { method: r.method };
      if (r.method !== 'GET' && r.method !== 'DELETE') {
        init.headers = { 'Content-Type': 'application/json' };
        init.body = '{}';
      }
      const res = await app.fetch(new Request(url, init));
      // 401 é o certo. 404/405 também não vazam nada e acontecem quando o
      // parâmetro de teste não casa com registro nenhum — o que interessa é
      // que NÃO volte 200 com dados.
      if (res.status !== 401) {
        vazando.push(`${r.method} ${r.path} → ${res.status}`);
      }
    }

    expect(vazando, `rotas de admin sem exigir token:\n${vazando.join('\n')}`).toEqual([]);
  });
});

describe('a rota que vazou a base inteira de alunos', () => {
  it('GET /admin/students exige token', async () => {
    const res = await app.fetch(new Request('http://local/api/admin/students'));
    expect(res.status).toBe(401);
  });

  it('e o corpo não traz e-mail de ninguém', async () => {
    const res = await app.fetch(new Request('http://local/api/admin/students'));
    const bruto = await res.text();
    expect(bruto).not.toMatch(/@example\.com|@pco\.local/);
  });

  it('a ficha individual e as estatísticas também', async () => {
    for (const rota of ['/api/admin/students/s-101', '/api/admin/students/s-101/stats']) {
      const res = await app.fetch(new Request(`http://local${rota}`));
      expect(res.status, rota).toBe(401);
    }
  });

  it('a configuração de IA também — ela expõe provedor, modelo e limites', async () => {
    const res = await app.fetch(new Request('http://local/api/admin/ai/configurations'));
    expect(res.status).toBe(401);
  });
});

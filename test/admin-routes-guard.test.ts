import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Regressão: em 2026-07-12 encontramos 27 rotas /admin/* de escrita servidas SEM requireAuth
// (incluindo DELETE /admin/students/:id e PUT /admin/ai/configurations/:id, que expunha
// troca de chave de API). attachUser só anexa o usuário — não exige. Este teste falha se
// alguma rota de escrita sob /admin/ voltar a responder sem token.

let tmpDir: string;
let app: Awaited<ReturnType<typeof buildAppLazy>>;

async function buildAppLazy() {
  const mod = await import('../server/app');
  return mod.buildApp();
}

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-guard-'));
  process.env.DATA_DIR = tmpDir;
  app = await buildAppLazy();
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

// Uma amostra das rotas mais perigosas: destruição de dados e configuração de credenciais.
const WRITES: Array<[string, string]> = [
  ['POST', '/api/admin/news'],
  ['PUT', '/api/admin/news/n-1'],
  ['DELETE', '/api/admin/news/n-1'],
  ['POST', '/api/admin/library'],
  ['DELETE', '/api/admin/library/l-1'],
  ['POST', '/api/admin/podcasts'],
  ['DELETE', '/api/admin/podcasts/p-1'],
  ['PUT', '/api/admin/courses/c-1'],
  ['POST', '/api/admin/courses/c-1/modules'],
  ['DELETE', '/api/admin/modules/m-1'],
  ['POST', '/api/admin/modules/m-1/lessons'],
  ['DELETE', '/api/admin/lessons/l-1'],
  ['POST', '/api/admin/students'],
  ['PUT', '/api/admin/students/s-1'],
  ['POST', '/api/admin/students/s-1/block'],
  ['DELETE', '/api/admin/students/s-1'],
  ['DELETE', '/api/admin/assessments/a-1'],
  ['PUT', '/api/admin/ai/configurations/cfg-1'],
  ['POST', '/api/admin/ai/test'],
];

describe('rotas admin de escrita exigem autenticação', () => {
  for (const [method, url] of WRITES) {
    it(`${method} ${url} responde 401 sem token`, async () => {
      const res = await app.request(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: method === 'DELETE' ? undefined : JSON.stringify({}),
      });
      expect(res.status).toBe(401);
    });
  }

  it('token inválido também é recusado', async () => {
    const res = await app.request('/api/admin/news', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer nao-e-um-jwt' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });
});

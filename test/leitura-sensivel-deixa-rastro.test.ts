import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * PRIV3-707 · a rota mais sensível do produto era a menos rastreável.
 *
 * `GET /admin/tutor/history` aceita busca livre, devolve a conversa integral do
 * aluno com o tutor de IA — material de foro íntimo, num produto de psicanálise
 * clínica — correlacionada a nome e e-mail, com `limit` até 1000. Não havia
 * `recordAudit` no handler, e o `auditMiddleware` é global mas **por desenho só
 * registra mutação**. O controle de acesso existia; o que não existia era como
 * detectar abuso interno **depois do fato**.
 *
 * A mesma lacuna valia para `GET /admin/students/export.csv`, que baixa a base
 * inteira de alunos com nome, e-mail e score de risco.
 *
 * Os casos abaixo cobram as três coisas que fazem esse log valer alguma coisa:
 *
 * 1. A leitura deixa rastro.
 * 2. Varrer a base inteira tem **nome diferente** de ler a conversa de um
 *    aluno — quem audita precisa separar as duas sem abrir cada linha.
 * 3. O log guarda o termo e a contagem, e **não** a conversa. Um log que copia
 *    o conteúdo para poder provar quem o leu é o mesmo vazamento com outro nome.
 */

let tmpDir: string;
let app: { fetch: (req: Request) => Response | Promise<Response> };
let token: string;
let auditoria: typeof import('../server/audit/log');

const SEGREDO = 'tenho pensamentos que não conto para ninguém';

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-rastro-'));
  process.env.DATA_DIR = tmpDir;
  process.env.INITIAL_ADMIN_PASSWORD = 'TesteAdmin!2026';
  const mod = await import('../server/app');
  app = mod.buildApp();
  auditoria = await import('../server/audit/log');

  const res = await app.fetch(
    new Request('http://local/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@pco.local', password: 'TesteAdmin!2026' }),
    }),
  );
  token = ((await res.json()) as { token: string }).token;
  expect(token).toBeTruthy();

  const historico = await import('../server/repositories/tutor-history');
  await historico.recordTurn({
    userId: 'u-aluno-1',
    prompt: SEGREDO,
    response: 'Resposta do tutor.',
    provider: 'mock',
    model: 'mock-1',
  });
});

afterAll(async () => {
  if (!tmpDir) return;
  const { drenarEscritasPendentes } = await import('../server/db/json-store');
  await drenarEscritasPendentes();
  for (let t = 0; t < 5; t++) {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
});

async function chamar(url: string) {
  const res = await app.fetch(
    new Request(`http://local/api${url}`, { headers: { Authorization: `Bearer ${token}` } }),
  );
  expect(res.status).toBe(200);
  return res;
}

describe('ler a conversa do aluno com o tutor deixa rastro', () => {
  it('varrer a base inteira por palavra-chave vira `tutor.history.sweep`', async () => {
    await chamar('/admin/tutor/history?search=pensamentos');
    const linha = (await auditoria.listAudit()).find((e) => e.action === 'tutor.history.sweep');
    expect(linha, 'a busca sem aluno definido tem de aparecer no log').toBeDefined();
    expect(linha!.actorEmail).toBe('admin@pco.local');
    expect(linha!.meta).toMatchObject({ termo: 'pensamentos', escopo: 'base-inteira' });
  });

  it('ler a conversa de um aluno é ação distinta da varredura', async () => {
    // Duas ações com pesos muito diferentes. Achatá-las no mesmo nome faria o
    // log existir e não servir: ninguém revisa 3.000 linhas iguais.
    await chamar('/admin/tutor/history?userId=u-aluno-1');
    const linha = (await auditoria.listAudit()).find((e) => e.action === 'tutor.history.read');
    expect(linha).toBeDefined();
    expect(linha!.targetId).toBe('u-aluno-1');
    expect(linha!.meta).toMatchObject({ escopo: 'um-aluno' });
  });

  it('o log guarda o termo e a contagem, nunca a conversa', async () => {
    await chamar('/admin/tutor/history?search=pensamentos');
    const tudo = JSON.stringify(await auditoria.listAudit());
    expect(tudo).not.toContain(SEGREDO);
    expect(tudo).not.toContain('Resposta do tutor');
  });
});

describe('baixar a base de alunos deixa rastro', () => {
  it('a exportação CSV registra o filtro e a contagem', async () => {
    await chamar('/admin/students/export.csv?status=ativo&search=maria');
    const linha = (await auditoria.listAudit()).find((e) => e.action === 'student.export.csv');
    expect(linha, 'baixar nome e e-mail de todo mundo não pode ser invisível').toBeDefined();
    expect(linha!.meta).toHaveProperty('linhas');
    expect(linha!.meta).toMatchObject({ filtros: { status: 'ativo', search: 'maria' } });
  });
});

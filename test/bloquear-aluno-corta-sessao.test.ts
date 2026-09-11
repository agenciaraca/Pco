import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * "Bloquear aluno" mudava a FICHA e não cortava a SESSÃO — relatado pelo dono
 * em 11/set/2026: "acionamos em um aluno e ele continuar acessando".
 *
 * ## A causa
 *
 * `POST /admin/students/:id/block` chamava só `studentsRepo.setStudentStatus`,
 * que grava `status: 'bloqueado'` na FICHA — lido pela tela de risco e pelo
 * relatório, e por mais NADA que decide acesso. Quem autentica é
 * `attachUser`/`requireAuth`, e eles consultam a CONTA em `users` (e-mail,
 * `active`, `tokenVersion`) a cada requisição — nunca a ficha. O admin
 * marcava "Bloqueado", a tela confirmava, e o aluno seguia logado com o
 * mesmo token de sempre, porque nada no caminho de autenticação nunca
 * perguntou pela ficha.
 *
 * É a mesma classe de defeito que este projeto já viu antes ("a ficha e a
 * conta são coisas diferentes"), aqui do lado mais caro de errar: uma ação
 * de segurança que parece ter funcionado e não funcionou.
 *
 * ## O conserto
 *
 * As três rotas que chegam a `status: 'bloqueado'` (`/block`, `/unblock`, e
 * a genérica `PUT .../status`) agora resolvem a conta pelo mesmo caminho que
 * `PUT .../password` já usava — e-mail primeiro, id depois — e chamam
 * `usersStore.updateUser(id, {active})`, que já existia e já faz a parte que
 * importa: desativar E somar o `tokenVersion`, derrubando qualquer token já
 * emitido no PRÓXIMO request, sem esperar expirar.
 *
 * Sem conta de acesso vinculada, o bloqueio da ficha continua válido (é o
 * que a tela de risco lê) — só não há sessão para cortar, e a resposta diz
 * isso (`accountBlocked: null`) em vez de prometer um corte que não houve.
 */

let tmpDir: string;
let app: { request: (path: string, init?: RequestInit) => Response | Promise<Response> };
let users: typeof import('../server/auth/users-store');
let studentsRepo: typeof import('../server/repositories/students');
let jwt: typeof import('../server/auth/jwt');
let mw: typeof import('../server/auth/middleware');

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-bloqueio-'));
  process.env.DATA_DIR = tmpDir;
  process.env.JWT_SECRET = 'a'.repeat(48);
  process.env.AVA_ENCRYPTION_KEY = 'a'.repeat(64);
  process.env.INITIAL_SUPERADMIN_PASSWORD = 'sa-pwd';
  process.env.INITIAL_ADMIN_PASSWORD = 'a-pwd';
  process.env.INITIAL_STUDENT_PASSWORD = 's-pwd';

  const mod = await import('../server/app');
  app = mod.buildApp();
  users = await import('../server/auth/users-store');
  studentsRepo = await import('../server/repositories/students');
  jwt = await import('../server/auth/jwt');
  mw = await import('../server/auth/middleware');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

async function tokenAdmin(): Promise<string> {
  const list = await users.listUsers();
  const u = list.find((x) => x.role === 'admin')!;
  return await jwt.signToken({ sub: u.id, email: u.email, role: u.role, tv: u.tokenVersion });
}

/** Ficha + conta com o MESMO e-mail — o caso comum, e o que a Ficha vs. Conta liga pelo e-mail, não pelo id. */
async function criarAlunoComConta(email: string) {
  const ficha = await studentsRepo.createAdminStudent({
    name: 'Aluno de Teste',
    email,
    weeklyGoalMinutes: 180,
    status: 'ativo',
    enrolledCourseIds: [],
  });
  const conta = await users.createUser({
    email,
    name: 'Aluno de Teste',
    role: 'student',
    password: 'senha123',
  });
  const token = await jwt.signToken({
    sub: conta.id,
    email: conta.email,
    role: 'student',
    tv: conta.tokenVersion,
  });
  return { ficha, conta, token };
}

/** Verifica se um token ainda autentica, chamando attachUser de verdade. */
async function tokenAindaValido(token: string): Promise<boolean> {
  const honoApp = new (await import('hono')).Hono();
  honoApp.use('*', mw.attachUser);
  honoApp.get('/sonda', mw.requireAuth(), (c) => c.json({ ok: true }));
  const res = await honoApp.request('/sonda', { headers: { authorization: `Bearer ${token}` } });
  return res.status === 200;
}

describe('POST /admin/students/:id/block corta a sessão de verdade', () => {
  it('depois de bloquear, o token do aluno para de autenticar', async () => {
    const { ficha, token } = await criarAlunoComConta('bloq1@pco.local');
    expect(await tokenAindaValido(token)).toBe(true);

    const admin = await tokenAdmin();
    const res = await app.request(`/api/admin/students/${ficha.id}/block`, {
      method: 'POST',
      headers: { authorization: `Bearer ${admin}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { accountBlocked: boolean | null };
    expect(body.accountBlocked, 'a resposta tem de confirmar que a CONTA foi cortada').toBe(true);

    // O mesmo token que funcionava antes do bloqueio — sem logout, sem
    // esperar expirar — deixa de autenticar.
    expect(await tokenAindaValido(token)).toBe(false);
  });

  it('a ficha também registra o bloqueio — a tela de risco continua correta', async () => {
    const { ficha } = await criarAlunoComConta('bloq2@pco.local');
    const admin = await tokenAdmin();
    await app.request(`/api/admin/students/${ficha.id}/block`, {
      method: 'POST',
      headers: { authorization: `Bearer ${admin}` },
    });
    const atualizada = await studentsRepo.findAdminStudent(ficha.id);
    expect(atualizada?.status).toBe('bloqueado');
  });

  it('desbloquear devolve a sessão — um token NOVO volta a autenticar', async () => {
    const { ficha, conta } = await criarAlunoComConta('bloq3@pco.local');
    const admin = await tokenAdmin();
    await app.request(`/api/admin/students/${ficha.id}/block`, {
      method: 'POST',
      headers: { authorization: `Bearer ${admin}` },
    });
    await app.request(`/api/admin/students/${ficha.id}/unblock`, {
      method: 'POST',
      headers: { authorization: `Bearer ${admin}` },
    });
    // Precisa ser um token NOVO: o tokenVersion subiu no bloqueio, então o
    // token antigo (pré-bloqueio) continua morto mesmo depois do desbloqueio
    // — é assim que "derrubar sessões abertas" tem de se comportar.
    const contaAtual = await users.findUserByEmail('bloq3@pco.local');
    const novoToken = await jwt.signToken({
      sub: conta.id,
      email: 'bloq3@pco.local',
      role: 'student',
      tv: contaAtual!.tokenVersion,
    });
    expect(await tokenAindaValido(novoToken)).toBe(true);
  });

  it('ficha sem conta de acesso: o bloqueio da ficha vale, e a resposta não finge cortar sessão', async () => {
    const ficha = await studentsRepo.createAdminStudent({
      name: 'Sem Conta',
      email: 'sem-conta-de-acesso@pco.local',
      weeklyGoalMinutes: 180,
      status: 'ativo',
      enrolledCourseIds: [],
    });
    const admin = await tokenAdmin();
    const res = await app.request(`/api/admin/students/${ficha.id}/block`, {
      method: 'POST',
      headers: { authorization: `Bearer ${admin}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { accountBlocked: boolean | null; status: string };
    // null, não false: false prometeria "existe conta e ela não foi
    // bloqueada", que é diferente de "não existe conta nenhuma".
    expect(body.accountBlocked).toBeNull();
    expect(body.status).toBe('bloqueado');
  });

  it('PUT /admin/students/:id/status com "bloqueado" corta a sessão pelo mesmo caminho', async () => {
    const { ficha, token } = await criarAlunoComConta('bloq4@pco.local');
    const admin = await tokenAdmin();
    const res = await app.request(`/api/admin/students/${ficha.id}/status`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${admin}`, 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'bloqueado' }),
    });
    expect(res.status).toBe(200);
    expect(await tokenAindaValido(token)).toBe(false);
  });

  it('PUT /admin/students/:id/status com outro status (em_risco) NÃO mexe na conta', async () => {
    const { ficha, token } = await criarAlunoComConta('bloq5@pco.local');
    const admin = await tokenAdmin();
    const res = await app.request(`/api/admin/students/${ficha.id}/status`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${admin}`, 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'em_risco' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { accountBlocked: boolean | null };
    expect(body.accountBlocked).toBeNull();
    expect(await tokenAindaValido(token)).toBe(true);
  });
});

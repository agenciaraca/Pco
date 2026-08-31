// Helpers compartilhados pelos E2E. Login via API + setLocalStorage
// (mais robusto que preencher form — evita timing flaky).

import type { APIRequestContext, Page } from '@playwright/test';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const STUDENT_EMAIL = 'aluno@pco.local';
export const STUDENT_PASSWORD = 'e2e-student-pass';
export const SUPERADMIN_EMAIL = 'superadmin@pco.local';
export const SUPERADMIN_PASSWORD = 'e2e-super-pass';

const TOKEN_KEY = 'ava-pco-auth';

interface LoginResult {
  token: string;
  user: { id: string; email: string; role: string };
}

export async function loginViaApi(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<LoginResult> {
  const res = await request.post('/api/auth/login', {
    data: { email, password },
  });
  if (!res.ok()) {
    throw new Error(`Login falhou: HTTP ${res.status()} ${await res.text()}`);
  }
  const body = (await res.json()) as
    | LoginResult
    | { totpRequired: true; ticket: string };
  if ('totpRequired' in body) {
    throw new Error('TOTP requerido — esperava login direto pra E2E');
  }
  return body;
}

/**
 * Uma sessão por e-mail, reaproveitada por toda a execução.
 *
 * `/api/auth/login` aceita 5 tentativas por minuto — e deve mesmo: é a porta em
 * que o ataque de força bruta bate. A suíte fazia um login por teste e estourava
 * a cota na metade, devolvendo 429; como o job de E2E roda com
 * `continue-on-error: true`, isso passou despercebido e a suíte parecia existir
 * sem nunca ter rodado inteira.
 *
 * O cache é por processo, então cada execução ainda exercita o login de verdade
 * uma vez para cada perfil.
 */
const sessoes = new Map<string, Promise<LoginResult>>();

/**
 * O cache também vai para disco.
 *
 * O Playwright **reinicia o processo do worker a cada teste que falha**. Cache
 * só em memória morre junto, e o worker novo refaz o login — então uma única
 * falha genuína virava cascata de 429 que escondia todas as outras causas. Com
 * o arquivo, qualquer worker reaproveita a sessão que já existe.
 *
 * O arquivo vive no temp do sistema e leva o PID do processo pai na chave para
 * não vazar entre execuções paralelas da suíte.
 */
function arquivoDaSessao(email: string): string {
  const chave = email.replace(/[^a-z0-9]/gi, '_');
  return path.join(os.tmpdir(), `ava-pco-e2e-sessao-${chave}.json`);
}

async function lerDoDisco(email: string): Promise<LoginResult | null> {
  try {
    const cru = await fs.readFile(arquivoDaSessao(email), 'utf8');
    return JSON.parse(cru) as LoginResult;
  } catch {
    return null;
  }
}

/**
 * Matricula o aluno da suíte no primeiro curso do catálogo, usando o admin.
 *
 * Admin e superadmin nunca são barrados pelo portão de entrada — é a exceção
 * que existe justamente para que alguém consiga consertar a regra. Então o
 * caminho é: entrar como superadmin, achar a ficha pelo e-mail e matricular.
 */
async function garantirMatricula(request: APIRequestContext, email: string): Promise<void> {
  const admin = await sessaoCompartilhada(request, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);
  const cursos = await fetchCourses(request);
  if (cursos.length === 0) throw new Error('sem curso no catálogo para matricular o aluno da suíte');

  const res = await request.get('/api/admin/students?limit=200', {
    headers: { Authorization: `Bearer ${admin.token}` },
  });
  if (!res.ok()) throw new Error(`lista de alunos falhou: HTTP ${res.status()}`);
  const corpo = (await res.json()) as
    | { items?: Array<{ id: string; email: string }> }
    | Array<{ id: string; email: string }>;
  const lista = Array.isArray(corpo) ? corpo : (corpo.items ?? []);
  const aluno = lista.find((a) => a.email?.toLowerCase() === email.toLowerCase());
  if (!aluno) throw new Error(`aluno ${email} não apareceu na lista do admin`);

  await ensureEnrolled(request, admin.token, cursos[0]!.id, aluno.id);
}

export function sessaoCompartilhada(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<LoginResult> {
  const existente = sessoes.get(email);
  if (existente) return existente;

  // Falha não fica no cache: uma promessa rejeitada guardada envenena todas as
  // chamadas seguintes, e um único 429 herdado da execução anterior derrubaria
  // a suíte inteira com o mesmo erro repetido.
  const nova = (async () => {
    const doDisco = await lerDoDisco(email);
    if (doDisco?.token) return doDisco;
    let r: LoginResult;
    try {
      r = await loginViaApi(request, email, password);
    } catch (e) {
      // Desde 30/ago/2026 ninguém entra sem ter comprado: conta sem matrícula
      // recebe 403 SEM_MATRICULA no login. O aluno da suíte nasce sem nenhuma,
      // então a suíte inteira parava na porta — e ninguém viu, porque o CI
      // estava travado por cobrança e o job de E2E rodava com
      // `continue-on-error`. Matricular antes de tentar de novo é o que o
      // produto faz de verdade; desligar o portão no teste mediria um produto
      // que não existe.
      if (!(e instanceof Error) || !e.message.includes('SEM_MATRICULA')) throw e;
      await garantirMatricula(request, email);
      r = await loginViaApi(request, email, password);
    }
    await fs.writeFile(arquivoDaSessao(email), JSON.stringify(r), 'utf8');
    return r;
  })().catch((e: unknown) => {
    sessoes.delete(email);
    throw e;
  });
  sessoes.set(email, nova);
  return nova;
}

/** Apaga as sessões em disco. Chamado pelo globalSetup, antes de tudo. */
export async function limparSessoesEmDisco(emails: string[]): Promise<void> {
  await Promise.all(
    emails.map((e) => fs.unlink(arquivoDaSessao(e)).catch(() => undefined)),
  );
}

/**
 * Faz login via API e injeta o token no localStorage do browser.
 * Após chamar, navegue para uma rota protegida e o AuthContext vai pegar.
 */
export async function loginAs(
  page: Page,
  email: string,
  password: string,
): Promise<LoginResult> {
  // Garante que estamos numa origem válida pra setar localStorage
  await page.goto('/login');
  const result = await sessaoCompartilhada(page.request, email, password);
  // A sessão é gravada como `{ user, token }` em JSON — é o que o AuthContext
  // e o wrapper de fetch leem (`JSON.parse(raw).token` nos dois).
  //
  // Antes daqui saía o token CRU, e isso nunca funcionou: `JSON.parse` de uma
  // string que não é JSON cai no catch, o token vira null e a rota protegida
  // devolve o usuário ao /login. Testes de página autenticada passavam a medir
  // a tela de login sem que ninguém percebesse, porque o job de E2E roda com
  // `continue-on-error: true`.
  await page.evaluate(
    ({ key, session }) => {
      window.localStorage.setItem(key, session);
    },
    { key: TOKEN_KEY, session: JSON.stringify({ user: result.user, token: result.token }) },
  );
  return result;
}

/**
 * Garante que o student está matriculado num curso (via API admin).
 * Idempotente — se já matriculado, retorna sem erro.
 */
export async function ensureEnrolled(
  request: APIRequestContext,
  superadminToken: string,
  courseId: string,
  studentId: string,
): Promise<void> {
  const res = await request.post(
    `/api/admin/courses/${courseId}/enroll-bulk`,
    {
      headers: { Authorization: `Bearer ${superadminToken}` },
      data: { studentIds: [studentId] },
    },
  );
  if (!res.ok() && res.status() !== 409) {
    const body = await res.text();
    throw new Error(`enroll-bulk falhou: HTTP ${res.status()} ${body}`);
  }
  // A rota responde 200 mesmo quando não matriculou ninguém: erros por aluno
  // ("aluno não encontrado") vão no CORPO, não no status. Conferir só o status
  // fazia o helper dar por feito o que não aconteceu, e a falha só aparecia
  // depois, disfarçada de NOT_ENROLLED na chamada seguinte.
  const resultado = (await res.json().catch(() => ({}))) as {
    enrolled?: number;
    already?: number;
    errors?: Array<{ studentId: string; message: string }>;
    ineligible?: Array<{ studentId: string; missing: string[] }>;
  };
  const ok = (resultado.enrolled ?? 0) + (resultado.already ?? 0) > 0;
  if (!ok) {
    throw new Error(
      `enroll-bulk não matriculou ninguém: ${JSON.stringify({
        errors: resultado.errors,
        ineligible: resultado.ineligible,
      })}`,
    );
  }
}

/**
 * Marca o onboarding do admin como concluído.
 *
 * O `AdminLayout` manda todo admin que ainda não passou pelo onboarding para
 * `/admin/onboarding`, e isso é comportamento correto num ambiente novo — que é
 * exatamente o ambiente do E2E, já que o globalSetup recria os usuários. Sem
 * isto, todo teste de página administrativa media a tela de onboarding.
 *
 * Idempotente: a rota devolve ok quando já estava concluído.
 */
export async function concluirOnboardingAdmin(
  request: APIRequestContext,
  adminToken: string,
): Promise<void> {
  const res = await request.post('/api/admin/onboarding/complete', {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {},
  });
  if (!res.ok()) {
    throw new Error(`onboarding/complete falhou: HTTP ${res.status()} ${await res.text()}`);
  }
}

/** Pega lista de cursos via /api/courses (público). */
export async function fetchCourses(
  request: APIRequestContext,
): Promise<Array<{ id: string; title: string; modules?: unknown[] }>> {
  const res = await request.get('/api/courses');
  if (!res.ok()) {
    throw new Error(`fetchCourses falhou: HTTP ${res.status()}`);
  }
  return (await res.json()) as Array<{
    id: string;
    title: string;
    modules?: unknown[];
  }>;
}

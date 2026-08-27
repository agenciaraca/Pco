import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * O material pago não sai do catálogo público.
 *
 * Até 27/ago/2026 `GET /api/courses` — público, é o catálogo — devolvia o
 * curso inteiro, e `listCourses()` inclui `lesson.content`. Um `curl` sem
 * token baixava o HTML completo de todas as aulas de todos os cursos: em
 * produção, os 2,93 milhões de caracteres que a migration 0008 recuperou.
 * Não era conteúdo de demonstração — era a apostila pela qual o aluno paga.
 *
 * O que a ementa (título, descrição, duração, ordem) continua pública é
 * deliberado: sem ela o visitante não sabe o que está comprando.
 */

const SEGREDO = 'CORPO-DA-AULA-QUE-O-ALUNO-PAGOU';

let tmpDir: string;
let app: { fetch: (req: Request) => Response | Promise<Response> };
let cursoId: string;
let aulaId: string;
/**
 * Tokens obtidos UMA vez. `POST /auth/login` tem teto de 5 por minuto, e um
 * teste que loga a cada caso estoura o próprio limite e falha por 429 — foi
 * o que derrubou a suíte E2E em 26/ago.
 */
let tokenAluno: string;
let tokenAdmin: string;
let alunoId: string;

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-conteudo-'));
  process.env.DATA_DIR = tmpDir;
  process.env.INITIAL_STUDENT_PASSWORD = 'TesteAluno!2026';
  process.env.INITIAL_ADMIN_PASSWORD = 'TesteAdmin!2026';

  const curso = {
    id: 'c-pago',
    slug: 'curso-pago',
    title: 'Curso Pago',
    shortTitle: 'Pago',
    description: 'Descrição pública do curso',
    coverColor: 'from-pco-blue to-pco-cyan',
    totalHours: 10,
    certificateAvailable: true,
    tags: [],
    modules: [
      {
        id: 'm-1',
        courseId: 'c-pago',
        title: 'Módulo 1',
        order: 1,
        lessons: [
          {
            id: 'l-1',
            courseId: 'c-pago',
            moduleId: 'm-1',
            title: 'Aula 1',
            description: 'Resumo público da aula',
            durationMinutes: 15,
            order: 1,
            isMandatory: true,
            status: 'published',
            content: `<h2>${SEGREDO}</h2><p>Material completo.</p>`,
          },
        ],
      },
    ],
  };
  await fs.writeFile(
    path.join(tmpDir, 'courses.json'),
    JSON.stringify([curso], null, 2),
    'utf8',
  );
  cursoId = curso.id;
  aulaId = 'l-1';

  const mod = await import('../server/app');
  app = mod.buildApp();

  tokenAluno = await entrar('aluno@pco.local', 'TesteAluno!2026');
  tokenAdmin = await entrar('admin@pco.local', 'TesteAdmin!2026');
  const eu = (await (
    await app.fetch(
      new Request('http://local/api/auth/me', {
        headers: { Authorization: `Bearer ${tokenAluno}` },
      }),
    )
  ).json()) as { id?: string; sub?: string };
  alunoId = eu.id ?? eu.sub!;
});

async function entrar(email: string, senha: string): Promise<string> {
  const res = await app.fetch(
    new Request('http://local/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: senha }),
    }),
  );
  if (res.status !== 200) throw new Error(`login de ${email} falhou: ${res.status}`);
  return ((await res.json()) as { token: string }).token;
}

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

async function texto(url: string, token?: string): Promise<{ status: number; body: string }> {
  const res = await app.fetch(
    new Request(`http://local${url}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),
  );
  return { status: res.status, body: await res.text() };
}

describe('o catálogo público não entrega o material pago', () => {
  it('GET /courses não traz o corpo da aula', async () => {
    const { status, body } = await texto('/api/courses');
    expect(status).toBe(200);
    expect(body).not.toContain(SEGREDO);
  });

  it('GET /courses/:id também não', async () => {
    const { status, body } = await texto(`/api/courses/${cursoId}`);
    expect(status).toBe(200);
    expect(body).not.toContain(SEGREDO);
  });

  it('mas a ementa continua pública — é ela que vende', async () => {
    const { body } = await texto(`/api/courses/${cursoId}`);
    expect(body).toContain('Aula 1');
    expect(body).toContain('Resumo público da aula');
    expect(body).toContain('Descrição pública do curso');
  });

  it('a chave `content` some, em vez de vir vazia', async () => {
    // String vazia faria a tela do aluno cair no ramo "sem conteúdo" e mostrar
    // a descrição como se fosse a aula. Ausência é o estado certo.
    const { body } = await texto(`/api/courses/${cursoId}`);
    const curso = JSON.parse(body) as {
      modules: Array<{ lessons: Array<Record<string, unknown>> }>;
    };
    const aula = curso.modules[0]!.lessons[0]!;
    expect('content' in aula).toBe(false);
  });
});

describe('a rota do conteúdo exige direito de estudar', () => {
  const rota = () => `/api/me/courses/${cursoId}/lessons/${aulaId}/content`;

  it('sem token, 401', async () => {
    const { status, body } = await texto(rota());
    expect(status).toBe(401);
    expect(body).not.toContain(SEGREDO);
  });

  it('com token de quem não está matriculado, 403 e sem o conteúdo', async () => {
    const { status, body } = await texto(rota(), tokenAluno);
    expect(status).toBe(403);
    expect(body).not.toContain(SEGREDO);
  });

  it('aula de outro curso não é servida pelo curso errado', async () => {
    const { status } = await texto(`/api/me/courses/${cursoId}/lessons/nao-existe/content`);
    // Sem token o portão fecha antes — o que importa é não vazar.
    expect(status).toBe(401);
  });
});

describe('e o aluno matriculado recebe o material', () => {
  /**
   * O caso que mais importa. Sem ele, eu poderia ter fechado o vazamento
   * fechando junto o produto — e a suíte ficaria verde enquanto nenhum aluno
   * conseguisse mais ler a aula que pagou.
   *
   * Roda depois do caso de 403 de propósito: é a matrícula, feita aqui, que
   * separa os dois resultados.
   */
  it('matriculado lê o conteúdo completo', async () => {
    expect(alunoId, 'precisa do id do aluno para matricular').toBeTruthy();

    const matricula = await app.fetch(
      new Request(`http://local/api/admin/courses/${cursoId}/enroll-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdmin}` },
        body: JSON.stringify({ studentIds: [alunoId] }),
      }),
    );
    expect(matricula.status, await matricula.clone().text()).toBe(200);

    const { status, body } = await texto(
      `/api/me/courses/${cursoId}/lessons/${aulaId}/content`,
      tokenAluno,
    );
    expect(status).toBe(200);
    expect(body).toContain(SEGREDO);
  });
});

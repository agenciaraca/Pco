import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * `GET /library` só tem `requireAuth()` — qualquer conta logada, mesmo sem
 * matrícula em curso nenhum, lista TODOS os itens da biblioteca e recebe a
 * URL direta do arquivo (`fileMockUrl`), inclusive de item marcado
 * `mandatory: true` e ligado a um curso pago via `relatedCourseIds` — o
 * próprio mecanismo que a tela do admin usa para "material obrigatório deste
 * curso".
 *
 * Toda outra rota que entrega material de curso (conteúdo de aula, vídeo,
 * transcrição, mentoria, fórum) passa por `courseAccessFor`/
 * `requisitantePodeVerCurso`. A biblioteca é a única que não passa por
 * nenhum portão — o filtro `?courseId=` é decorativo, feito só para navegar,
 * não para proteger.
 *
 * Achado em auditoria de varredura (11/set/2026), a pedido do dono. Medido
 * contra produção: hoje nenhum dos 108 itens do acervo está ligado a curso
 * (CLAUDE.md, "Encher a estante mudou o que a porta aberta significava"),
 * então a exposição real é zero — mas o campo `relatedCourseIds` e a flag
 * `mandatory` existem exatamente para linkar apostila obrigatória a curso, e
 * no dia em que isso for usado, o material sai para qualquer aluno logado,
 * pago ou não.
 */

const URL_SECRETA =
  'https://ava.psicanaliseclinica.online/uploads/APOSTILA-SECRETA-DO-CURSO-PAGO.pdf';

let tmpDir: string;
let app: { fetch: (req: Request) => Response | Promise<Response> };
let tokenAlunoSemMatricula: string;
let tokenAlunoMatriculado: string;
let tokenAdmin: string;

async function entrar(email: string, senha: string): Promise<string> {
  const res = await app.fetch(
    new Request('http://local/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: senha }),
    }),
  );
  if (res.status !== 200) throw new Error(`login falhou: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { token: string }).token;
}

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-library-leak-'));
  process.env.DATA_DIR = tmpDir;
  process.env.INITIAL_STUDENT_PASSWORD = 'TesteAluno!2026';
  process.env.INITIAL_ADMIN_PASSWORD = 'TesteAdmin!2026';

  await fs.writeFile(
    path.join(tmpDir, 'courses.json'),
    JSON.stringify(
      [
        {
          id: 'curso-pago',
          slug: 'curso-pago',
          title: 'Curso Pago',
          shortTitle: 'Curso Pago',
          description: 'x',
          coverColor: 'x',
          totalHours: 1,
          certificateAvailable: false,
          active: true,
          tags: [],
          modules: [],
        },
      ],
      null,
      2,
    ),
    'utf8',
  );

  await fs.writeFile(
    path.join(tmpDir, 'library.json'),
    JSON.stringify(
      [
        {
          id: 'lib-secreto',
          title: 'Apostila obrigatória do Curso Pago',
          author: 'PCO',
          type: 'apostila',
          mandatory: true,
          fileMockUrl: URL_SECRETA,
          relatedCourseIds: ['curso-pago'],
          relatedModuleIds: [],
          tags: [],
        },
        {
          id: 'lib-geral',
          title: 'Leitura recomendada geral',
          author: 'PCO',
          type: 'leitura',
          mandatory: false,
          fileMockUrl: 'https://ava.psicanaliseclinica.online/uploads/leitura-geral.pdf',
          relatedCourseIds: [],
          relatedModuleIds: [],
          tags: [],
        },
      ],
      null,
      2,
    ),
    'utf8',
  );

  const mod = await import('../server/app');
  app = mod.buildApp();
  tokenAlunoSemMatricula = await entrar('aluno@pco.local', 'TesteAluno!2026');
  tokenAdmin = await entrar('admin@pco.local', 'TesteAdmin!2026');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('material obrigatório de curso pago via /library', () => {
  it('aluno sem matrícula não recebe a URL do material obrigatório do curso pago', async () => {
    const res = await app.fetch(
      new Request('http://local/api/library?courseId=curso-pago', {
        headers: { Authorization: `Bearer ${tokenAlunoSemMatricula}` },
      }),
    );
    const body = await res.text();
    expect(body).not.toContain('APOSTILA-SECRETA-DO-CURSO-PAGO');
  });

  it('nem pela listagem geral, sem filtro', async () => {
    const res = await app.fetch(
      new Request('http://local/api/library', {
        headers: { Authorization: `Bearer ${tokenAlunoSemMatricula}` },
      }),
    );
    const body = await res.text();
    expect(body).not.toContain('APOSTILA-SECRETA-DO-CURSO-PAGO');
  });

  it('visitante anônimo continua barrado (401) — isso já funcionava', async () => {
    const res = await app.fetch(new Request('http://local/api/library'));
    expect(res.status).toBe(401);
  });

  it('mas o item SEM curso ligado (acervo geral) continua visível para qualquer logado', async () => {
    const res = await app.fetch(
      new Request('http://local/api/library', {
        headers: { Authorization: `Bearer ${tokenAlunoSemMatricula}` },
      }),
    );
    const body = await res.text();
    expect(body).toContain('leitura-geral.pdf');
  });

  it('e o aluno que É matriculado no curso continua vendo o material dele', async () => {
    const eu = (await (
      await app.fetch(
        new Request('http://local/api/auth/me', {
          headers: { Authorization: `Bearer ${tokenAlunoSemMatricula}` },
        }),
      )
    ).json()) as { id?: string; sub?: string };
    const alunoId = eu.id ?? eu.sub!;

    const matricula = await app.fetch(
      new Request('http://local/api/admin/courses/curso-pago/enroll-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdmin}` },
        body: JSON.stringify({ studentIds: [alunoId] }),
      }),
    );
    expect(matricula.status).toBe(200);

    tokenAlunoMatriculado = await entrar('aluno@pco.local', 'TesteAluno!2026');
    const res = await app.fetch(
      new Request('http://local/api/library?courseId=curso-pago', {
        headers: { Authorization: `Bearer ${tokenAlunoMatriculado}` },
      }),
    );
    const body = await res.text();
    expect(body).toContain('APOSTILA-SECRETA-DO-CURSO-PAGO');
  });
});

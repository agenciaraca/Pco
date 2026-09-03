import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * As correções da auditoria de 3/set/2026, cada uma com o caso que a prova.
 *
 * Todo achado desta suíte tinha a mesma forma: **o código respondia 200 e a
 * garantia não existia**. Nenhum deles aparecia em log, em erro de tela ou em
 * teste — e três estavam documentados como resolvidos em texto que descrevia
 * uma proteção que o código não tinha.
 *
 * - **SEC-001** — o ticket intermediário de 2FA era um Bearer pleno por 10
 *   minutos. `attachUser` nunca lia a claim `totp: 'pending'`, e o ticket é
 *   assinado pela mesma função e pelo mesmo segredo do token de sessão, com
 *   `sub`, `email`, `role` e `tv` completos. Quem tivesse a senha de uma conta
 *   admin com 2FA ativo passava em `requireAuth('admin')` **sem apresentar o
 *   segundo fator** — tempo de sobra para as doze rotas de export em massa ou
 *   para emitir um token `pcok_*` de vida longa. O 2FA virava obstáculo de
 *   tela, não de autorização, justamente nas contas que o ativaram.
 *
 * - **SEC-002** — `GET /auth/me` respondia 200 sem token, devolvendo
 *   `getCurrentStudent()`. Com banco, essa função monta o perfil **real** da
 *   linha `students.id = 'stu-001'` (nome, e-mail, matrículas, score de risco).
 *   E o inventário de rotas públicas afirmava, por escrito, que a rota
 *   "responde 401 sozinha": o motivo estava lá e era falso, porque o teste
 *   pulava tudo que estivesse na lista. *A regra existir não é a regra rodar;
 *   o motivo estar escrito não é o motivo ser verdade.*
 *
 * - **SEC-003** — três rotas públicas de aula (`preview` e as duas de
 *   transcrição) decidiam **só** por `lesson.isPreview` e nunca olhavam o curso
 *   pai. Marcar uma aula do curso interno de operadores como demonstração
 *   entregava título, duração, **a URL do vídeo** e a transcrição inteira a um
 *   `curl` sem token. O defeito era novo: `is_preview` só ganhou coluna na
 *   migration 0017, e enquanto o campo era inerte o vazamento estava mascarado
 *   por outro defeito.
 *
 * - **DATA-005** — `POST /lessons/:id/complete` aceitava `courseId` e
 *   `moduleId` **do corpo**, sem conferir contra a aula, e a auto-emissão de
 *   certificado contava linhas de progresso com aquele `courseId` em vez de
 *   cruzar com as aulas que o curso tem.
 *
 * O arquivo é por comportamento, não por rota: o que se mede aqui é o que cada
 * persona consegue, que é onde os defeitos moravam.
 */

const VIDEO_INTERNO = 'https://player.vimeo.com/video/999-treinamento-de-operador';
const TRANSCRICAO_INTERNA = 'Texto integral da aula interna de operadores.';

let tmpDir: string;
let app: { fetch: (req: Request) => Response | Promise<Response> };
let tokenAluno: string;
let tokenAdmin: string;

function curso(opts: {
  id: string;
  titulo: string;
  publicListed?: boolean;
  video?: string;
  transcricao?: string;
}) {
  return {
    id: opts.id,
    slug: opts.id,
    title: opts.titulo,
    shortTitle: opts.titulo,
    description: `Ementa de ${opts.titulo}`,
    coverColor: 'from-pco-blue to-pco-cyan',
    totalHours: 2,
    certificateAvailable: false,
    active: true,
    ...(opts.publicListed === false ? { publicListed: false } : {}),
    tags: [],
    modules: [
      {
        id: `${opts.id}-m1`,
        courseId: opts.id,
        title: 'Módulo 1',
        order: 1,
        lessons: [
          {
            id: `${opts.id}-l1`,
            courseId: opts.id,
            moduleId: `${opts.id}-m1`,
            title: `Aula de ${opts.titulo}`,
            description: 'Resumo da aula',
            durationMinutes: 10,
            order: 1,
            isMandatory: true,
            status: 'published',
            content: '<p>Material completo.</p>',
            // Marcada como demonstração DE PROPÓSITO: é a combinação
            // "preview + curso não listado" que abria o buraco.
            isPreview: true,
            ...(opts.video ? { videoUrl: opts.video } : {}),
            ...(opts.transcricao ? { transcripts: { pt: opts.transcricao } } : {}),
          },
        ],
      },
    ],
  };
}

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-auditoria-'));
  process.env.DATA_DIR = tmpDir;
  process.env.INITIAL_STUDENT_PASSWORD = 'TesteAluno!2026';
  process.env.INITIAL_ADMIN_PASSWORD = 'TesteAdmin!2026';

  await fs.writeFile(
    path.join(tmpDir, 'courses.json'),
    JSON.stringify(
      [
        curso({ id: 'c-aberto', titulo: 'Curso Aberto' }),
        curso({
          id: 'c-interno',
          titulo: 'Treinamento de Operador',
          publicListed: false,
          video: VIDEO_INTERNO,
          transcricao: TRANSCRICAO_INTERNA,
        }),
      ],
      null,
      2,
    ),
    'utf8',
  );

  const mod = await import('../server/app');
  app = mod.buildApp();

  tokenAluno = await entrar('aluno@pco.local', 'TesteAluno!2026');
  tokenAdmin = await entrar('admin@pco.local', 'TesteAdmin!2026');
});

afterAll(async () => {
  if (!tmpDir) return;
  // Espera a fila de escrita esvaziar antes de apagar. Concluir aula dispara
  // webhook, que grava — e apagar o diretorio no meio disso devolve ENOTEMPTY.
  const { drenarEscritasPendentes } = await import('../server/db/json-store');
  await drenarEscritasPendentes();
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
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

async function pegar(url: string, token?: string) {
  const res = await app.fetch(
    new Request(`http://local${url}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),
  );
  return { status: res.status, body: await res.text() };
}

// ---------------------------------------------------------------- SEC-001

describe('SEC-001 · o ticket de 2FA não é uma sessão', () => {
  it('um token com totp:pending não passa em requireAuth, nem para admin', async () => {
    // Forja o ticket exatamente como `/auth/login` o emite quando a conta tem
    // 2FA: mesma função, mesmo segredo, papel de admin, `totp: 'pending'`.
    const { signToken } = await import('../server/auth/jwt');
    const ticket = await signToken(
      { sub: 'qualquer', email: 'admin@pco.local', role: 'admin', tv: 0, totp: 'pending' },
      600,
    );

    // A rota mais cara que ele alcançaria: a base de alunos.
    const alunos = await pegar('/api/admin/students', ticket);
    expect(alunos.status, 'ticket de 2FA não pode abrir /admin/students').toBe(401);

    // E nem a área do aluno.
    const meu = await pegar('/api/me/orders', ticket);
    expect(meu.status, 'ticket de 2FA não pode abrir rota de aluno').toBe(401);
  });

  it('o token normal de login continua funcionando', async () => {
    // Guarda contra "consertar" negando bom token junto com o ruim.
    const alunos = await pegar('/api/admin/students', tokenAdmin);
    expect(alunos.status).toBe(200);
  });
});

// ---------------------------------------------------------------- SEC-002

describe('SEC-002 · /auth/me exige token', () => {
  it('sem token responde 401, e não o perfil de uma pessoa', async () => {
    const r = await pegar('/api/auth/me');
    expect(r.status).toBe(401);
    // Nem por acidente: nada que pareça ficha de aluno pode sair daqui.
    expect(r.body).not.toContain('enrolledCourseIds');
    expect(r.body).not.toContain('riskScore');
  });

  it('com token responde o perfil de quem pediu', async () => {
    const r = await pegar('/api/auth/me', tokenAluno);
    expect(r.status).toBe(200);
    expect(r.body).toContain('aluno@pco.local');
  });
});

// ---------------------------------------------------------------- SEC-003

describe('SEC-003 · aula de curso não listado não vaza por preview nem por transcrição', () => {
  const rotasDaAula = (id: string) => [
    `/api/lessons/${id}/preview`,
    `/api/lessons/${id}/transcript`,
    `/api/lessons/${id}/transcript.txt`,
  ];

  it('anônimo recebe 404 nas três rotas do curso interno', async () => {
    for (const rota of rotasDaAula('c-interno-l1')) {
      const r = await pegar(rota);
      // 404 e não 403: 403 confirmaria que a aula existe.
      expect(r.status, `${rota} deveria ser 404 para anônimo`).toBe(404);
      expect(r.body, `${rota} vazou a URL do vídeo`).not.toContain(VIDEO_INTERNO);
      expect(r.body, `${rota} vazou a transcrição`).not.toContain(TRANSCRICAO_INTERNA);
    }
  });

  it('aluno sem matrícula também recebe 404 — não basta estar logado', async () => {
    for (const rota of rotasDaAula('c-interno-l1')) {
      const r = await pegar(rota, tokenAluno);
      expect(r.status, `${rota} deveria ser 404 para aluno não matriculado`).toBe(404);
      expect(r.body).not.toContain(VIDEO_INTERNO);
    }
  });

  it('admin continua enxergando — é dele que o editor lê', async () => {
    const r = await pegar('/api/lessons/c-interno-l1/preview', tokenAdmin);
    expect(r.status).toBe(200);
    expect(r.body).toContain(VIDEO_INTERNO);
  });

  it('a aula de demonstração de curso publicamente listado segue aberta', async () => {
    // O conserto não pode fechar o que era para estar aberto: preview livre é
    // recurso de venda.
    const r = await pegar('/api/lessons/c-aberto-l1/preview');
    expect(r.status).toBe(200);
  });
});

// ---------------------------------------------------------------- DATA-005

describe('DATA-005 · concluir aula não aceita o curso que o cliente alegar', () => {
  it('lessonId inexistente responde 404 em vez de gravar progresso', async () => {
    const res = await app.fetch(
      new Request('http://local/api/lessons/aula-que-nao-existe/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdmin}` },
        body: JSON.stringify({ courseId: 'c-aberto', moduleId: 'c-aberto-m1' }),
      }),
    );
    expect(res.status).toBe(404);
  });

  it('o curso gravado é o da aula, e não o que veio no corpo', async () => {
    // Aqui está o abuso: a aula é do curso aberto, e o corpo alega o interno.
    const res = await app.fetch(
      new Request('http://local/api/lessons/c-aberto-l1/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdmin}` },
        body: JSON.stringify({ courseId: 'c-interno', moduleId: 'c-interno-m1' }),
      }),
    );
    expect(res.status).toBe(201);

    const progresso = await import('../server/repositories/progress');
    const { findUserByEmail } = await import('../server/auth/users-store');
    const admin = await findUserByEmail('admin@pco.local');
    const linhas = await progresso.listForUser(admin!.id);
    const daAula = linhas.find((p) => p.lessonId === 'c-aberto-l1');
    expect(daAula, 'o progresso da aula deveria existir').toBeTruthy();
    expect(daAula!.courseId, 'o courseId veio do corpo em vez de vir da aula').toBe('c-aberto');
    expect(daAula!.moduleId).toBe('c-aberto-m1');
  });
});

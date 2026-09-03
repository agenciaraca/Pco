import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * Sete rotas que exigiam login e não exigiam mais nada.
 *
 * Todas encontradas na segunda passada da auditoria de 3/set/2026, e todas com
 * a mesma forma: `requireAuth()` responde "quem é você?" e nunca "isto é seu?".
 * Ler o código depressa dá a impressão de rota protegida — e é assim que sete
 * delas atravessaram várias revisões.
 *
 * O que cada uma entregava a **qualquer conta autenticada**:
 *
 * - **SEC2-903** `/zoom/signature` — a assinatura do SDK para qualquer
 *   `meetingNumber` do corpo. Contornava por fora o filtro cuidadoso de
 *   `/me/live-sessions`, e nem exigia que o número fosse de uma sessão nossa:
 *   valia como oráculo de assinatura para qualquer reunião da conta Zoom da
 *   escola.
 * - **SEC2-905** `/me/lessons/:id/watch` — acumulava tempo de assistência em
 *   qualquer aula de qualquer curso, com o `courseId` que o cliente alegasse.
 *   É a rota irmã de `/complete`, cuja correção parou ali. E não é telemetria
 *   inofensiva: `watch_time` alimenta o cálculo de risco de evasão que a
 *   coordenação usa para decidir quem precisa de atenção.
 * - **SEC2-906** avaliação de curso — `userName` caía em `student.name ||
 *   u.email`, e `GET /courses/:id/reviews` é **público, sem token**: o e-mail
 *   de quem avaliou virava conteúdo indexável.
 * - **SEC2-904** `/me/mentoring/:courseId` — nome do instrutor e URL de
 *   agendamento de qualquer curso.
 * - **SEC2-908** `/me/courses/:id/prereq` — 404 para curso inexistente e 200
 *   para curso existente que a pessoa não pode ver: um oráculo de existência.
 * - **SEC2-909** `/experiments/:id/track` — aceitava `userId` do corpo **sem
 *   autenticação nenhuma**; qualquer pessoa atribuía conversão a qualquer
 *   aluno, e a atribuição é o que decide qual variante venceu.
 * - **SEC2-910** `/session/:id/transcript` — fail-open em duas bocas: sessão
 *   sem `courseId` e sessão apagada liberavam a transcrição para toda conta.
 *
 * **Os casos são sempre com token de quem não tem direito**, nunca sem token.
 * Testar sem token prova só que `requireAuth` existe — que era verdade o tempo
 * todo, e foi exatamente o que deixou os sete passarem.
 */

let tmpDir: string;
let app: { fetch: (req: Request) => Response | Promise<Response> };
let tokenAluno: string;
let tokenAdmin: string;
let idAluno: string;

const AGORA = Date.now();
const DAQUI_A_UMA_HORA = new Date(AGORA + 60 * 60_000).toISOString();

function curso(id: string, titulo: string, publicListed = true) {
  return {
    id,
    slug: id,
    title: titulo,
    shortTitle: titulo,
    description: `Ementa de ${titulo}`,
    coverColor: 'from-pco-blue to-pco-cyan',
    totalHours: 2,
    active: true,
    publicListed,
    modules: [
      {
        id: `${id}-m1`,
        title: 'Módulo 1',
        order: 1,
        lessons: [
          { id: `${id}-l1`, title: 'Aula 1', order: 1, durationMin: 10, content: 'Corpo.' },
        ],
      },
    ],
  };
}

function sessaoAoVivo(over: Record<string, unknown>) {
  return {
    id: 'lv-base',
    title: 'Encontro',
    joinUrl: 'https://zoom.us/j/1',
    startAt: DAQUI_A_UMA_HORA,
    durationMinutes: 60,
    status: 'scheduled',
    audience: 'all',
    embedType: 'zoom_embed',
    createdAt: new Date(AGORA).toISOString(),
    updatedAt: new Date(AGORA).toISOString(),
    ...over,
  };
}

async function semear(nome: string, dados: unknown) {
  await fs.writeFile(path.join(tmpDir, nome), JSON.stringify(dados, null, 2), 'utf8');
}

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-semdono-'));
  process.env.DATA_DIR = tmpDir;
  process.env.INITIAL_STUDENT_PASSWORD = 'TesteAluno!2026';
  process.env.INITIAL_ADMIN_PASSWORD = 'TesteAdmin!2026';

  await semear('courses.json', [
    curso('c-meu', 'Curso Que o Aluno Cursa'),
    curso('c-alheio', 'Curso de Outra Turma'),
    // Não listado publicamente e sem matrícula: é o alvo do oráculo de
    // existência, e o análogo do Treinamento PCO interno.
    curso('c-interno', 'Treinamento de Operador', false),
  ]);

  await semear('live-sessions.json', [
    sessaoAoVivo({ id: 'lv-aberta', audience: 'all', zoomMeetingNumber: '111' }),
    sessaoAoVivo({
      id: 'lv-restrita',
      audience: 'enrolled',
      courseId: 'c-alheio',
      zoomMeetingNumber: '222',
    }),
    // Restrita e sem curso: a boca do fail-open. Marcada "só para
    // matriculados" e sem dizer matriculados em quê.
    sessaoAoVivo({ id: 'lv-orfa', audience: 'enrolled', courseId: null, zoomMeetingNumber: '333' }),
  ]);

  await semear('session-transcripts.json', [
    {
      id: 'tr-orfa',
      sessionId: 'lv-orfa',
      segments: [],
      fullText: 'Texto da sessão restrita sem curso associado.',
      language: 'pt',
      durationSeconds: 60,
      provider: 'whisper',
      model: 'x',
      status: 'completed',
      createdAt: new Date(AGORA).toISOString(),
      updatedAt: new Date(AGORA).toISOString(),
    },
    {
      id: 'tr-fantasma',
      // Sessão que não existe mais — apagada. A segunda boca.
      sessionId: 'lv-apagada',
      segments: [],
      fullText: 'Texto de uma sessão que foi removida do ar.',
      language: 'pt',
      durationSeconds: 60,
      provider: 'whisper',
      model: 'x',
      status: 'completed',
      createdAt: new Date(AGORA).toISOString(),
      updatedAt: new Date(AGORA).toISOString(),
    },
  ]);

  await semear('mentoring-configs.json', [
    {
      id: 'mt-1',
      courseId: 'c-alheio',
      instructorName: 'Fulana Supervisora',
      bookingUrl: 'https://cal.exemplo/fulana',
      provider: 'calcom',
      active: true,
      createdAt: new Date(AGORA).toISOString(),
      updatedAt: new Date(AGORA).toISOString(),
    },
  ]);

  const mod = await import('../server/app');
  app = mod.buildApp();

  tokenAluno = await entrar('aluno@pco.local', 'TesteAluno!2026');
  tokenAdmin = await entrar('admin@pco.local', 'TesteAdmin!2026');
  const { verifyToken } = await import('../server/auth/jwt');
  idAluno = (await verifyToken(tokenAluno))!.sub;

  const students = await import('../server/repositories/students');
  await students.enrollInCourse(idAluno, 'c-meu');
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

async function postar(url: string, token: string | undefined, corpo: unknown) {
  const res = await app.fetch(
    new Request(`http://local${url}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(corpo),
    }),
  );
  return { status: res.status, body: await res.text() };
}

// ---------------------------------------------------------------- SEC2-903

describe('SEC2-903 · a assinatura do Zoom é da sessão, não do número', () => {
  it('número de sessão restrita a curso que o aluno não cursa: 404', async () => {
    const r = await postar('/api/zoom/signature', tokenAluno, { meetingNumber: '222' });
    expect(r.status, 'o filtro de /me/live-sessions não pode ser contornado').toBe(404);
    expect(r.body).not.toContain('signature');
  });

  it('número que não é de sessão nenhuma: 404', async () => {
    // O caso mais grave: a rota assinava qualquer reunião da conta Zoom da
    // escola, inclusive as que nunca foram cadastradas aqui.
    const r = await postar('/api/zoom/signature', tokenAluno, { meetingNumber: '999888777' });
    expect(r.status).toBe(404);
  });

  it('sessão restrita sem curso não é liberada por não ter a que amarrar', async () => {
    const r = await postar('/api/zoom/signature', tokenAluno, { meetingNumber: '333' });
    expect(r.status, 'restrita e sem curso é a mais restrita, não a mais aberta').toBe(404);
  });

  it('sessão aberta a todos segue funcionando para o aluno', async () => {
    // Guarda contra fechar demais: sem Zoom configurado a resposta é 503,
    // que é o caminho de configuração — e prova que passou pelo portão.
    const r = await postar('/api/zoom/signature', tokenAluno, { meetingNumber: '111' });
    expect(r.status, 'sessão aberta passa o portão').toBe(503);
    expect(r.body).toContain('ZOOM_NOT_CONFIGURED');
  });
});

// ---------------------------------------------------------------- SEC2-905

describe('SEC2-905 · tempo de assistência não aceita o curso que o cliente alegar', () => {
  it('aula de curso que o aluno não cursa: 403, e nada é gravado', async () => {
    const r = await postar('/api/me/lessons/c-alheio-l1/watch', tokenAluno, {
      // O `courseId` mentido é o do curso em que ele TEM matrícula — era assim
      // que o portão do curso alegado era satisfeito.
      courseId: 'c-meu',
      deltaSeconds: 60,
    });
    expect(r.status).toBe(403);

    const gravado = await pegar('/api/me/lessons/c-alheio-l1/watch', tokenAluno);
    expect(JSON.parse(gravado.body).totalSeconds, 'nada foi acumulado').toBe(0);
  });

  it('aula inexistente responde 404 em vez de gravar', async () => {
    const r = await postar('/api/me/lessons/nao-existe/watch', tokenAluno, {
      courseId: 'c-meu',
      deltaSeconds: 30,
    });
    expect(r.status).toBe(404);
  });

  it('na aula do curso dele, grava — e no curso da aula, não no alegado', async () => {
    const r = await postar('/api/me/lessons/c-meu-l1/watch', tokenAluno, {
      courseId: 'c-alheio',
      deltaSeconds: 45,
    });
    expect(r.status).toBe(200);

    const watchTime = await import('../server/repositories/watch-time');
    const entry = await watchTime.getEntry(idAluno, 'c-meu-l1');
    expect(entry!.courseId, 'o curso é o da aula, não o do corpo').toBe('c-meu');
    expect(entry!.totalSeconds).toBe(45);
  });
});

// ---------------------------------------------------------------- SEC2-906

describe('SEC2-906 · avaliação pública não carrega o e-mail de quem avaliou', () => {
  it('o e-mail não aparece na lista pública, que é lida sem token', async () => {
    // **A ficha fica sem nome de propósito.** Com nome preenchido, o
    // `student.name || u.email` de antes nunca chegava a cair no e-mail, e o
    // caso passaria contra o código defeituoso — provando nada. É a queda para
    // o e-mail que precisa ser exercitada, e ela só acontece sem nome.
    const students = await import('../server/repositories/students');
    await students.updateAdminStudent(idAluno, { name: '' });

    const r = await app.fetch(
      new Request('http://local/api/me/courses/c-meu/review', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAluno}` },
        body: JSON.stringify({ rating: 5, comment: 'Curso excelente.' }),
      }),
    );
    expect(r.status).toBe(200);

    // **A gravação, conferida no que foi gravado.** Olhar só a resposta
    // pública não distingue as duas camadas: o saneamento na leitura mascara
    // um `userName` sujo no banco, e o caso passaria com a escrita defeituosa.
    // Aqui se cobra que o e-mail não chegue a ser persistido.
    const reviews = await import('../server/reviews/store');
    const gravada = await reviews.findMine('c-meu', idAluno);
    expect(gravada!.userName, 'o e-mail não é gravado no campo de nome').not.toContain('@');
    expect(gravada!.userName).toBe('aluno');

    // E a leitura, conferida na resposta pública.
    const publica = await pegar('/api/courses/c-meu/reviews');
    expect(publica.status, 'a lista é pública de propósito — a ementa vende').toBe(200);
    expect(publica.body).toContain('Curso excelente.');
    expect(publica.body, 'e-mail de aluno não vira conteúdo indexável').not.toContain(
      'aluno@pco.local',
    );
    expect(publica.body, 'nenhum endereço, de ninguém').not.toContain('@');
    expect(publica.body).toContain('"userName":"aluno"');
  });

  it('linha já gravada com e-mail é saneada na leitura', async () => {
    // Corrigir só a escrita deixaria publicadas para sempre as linhas
    // anteriores a 3/set/2026 — e são elas que existem em produção.
    const reviews = await import('../server/reviews/store');
    await reviews.upsertReview({
      courseId: 'c-meu',
      userId: 'outro-aluno',
      userEmail: 'antigo@pco.local',
      userName: 'antigo@pco.local',
      rating: 4,
      comment: 'Avaliação antiga.',
    });
    const publica = await pegar('/api/courses/c-meu/reviews');
    expect(publica.body).toContain('Avaliação antiga.');
    expect(publica.body, 'a linha velha também é saneada').not.toContain('antigo@pco.local');
    expect(publica.body).toContain('"userName":"antigo"');
  });
});

// ---------------------------------------------------------------- SEC2-904

describe('SEC2-904 · mentoria é do curso', () => {
  it('aluno não matriculado não recebe instrutor nem URL de agendamento', async () => {
    const r = await pegar('/api/me/mentoring/c-alheio', tokenAluno);
    expect(r.status).toBe(200);
    expect(r.body).not.toContain('Fulana Supervisora');
    expect(r.body).not.toContain('cal.exemplo');
    expect(JSON.parse(r.body).configs).toEqual([]);
  });

  it('admin continua enxergando', async () => {
    const r = await pegar('/api/me/mentoring/c-alheio', tokenAdmin);
    expect(JSON.parse(r.body).configs.length).toBe(1);
  });
});

// ---------------------------------------------------------------- SEC2-908

describe('SEC2-908 · pré-requisito não é oráculo de existência', () => {
  it('curso interno e curso inexistente respondem igual', async () => {
    const interno = await pegar('/api/me/courses/c-interno/prereq', tokenAluno);
    const inexistente = await pegar('/api/me/courses/nao-existe-nunca/prereq', tokenAluno);
    expect(interno.status, 'existir e não poder ver respondem o mesmo').toBe(404);
    expect(inexistente.status).toBe(404);
    expect(interno.status).toBe(inexistente.status);
  });

  it('no curso do aluno segue respondendo', async () => {
    const r = await pegar('/api/me/courses/c-meu/prereq', tokenAluno);
    expect(r.status).toBe(200);
    expect(JSON.parse(r.body).ok).toBe(true);
  });
});

// ---------------------------------------------------------------- SEC2-909

describe('SEC2-909 · conversão de experimento não aceita userId do corpo', () => {
  async function eventosGravados(): Promise<Array<{ userId?: string; sessionId?: string }>> {
    // Lido do arquivo: o store não exporta leitura de eventos, e acrescentar um
    // export só para o teste esconderia que ela não existe.
    const { drenarEscritasPendentes } = await import('../server/db/json-store');
    await drenarEscritasPendentes();
    const bruto = await fs.readFile(path.join(tmpDir, 'experiment-events.json'), 'utf8');
    return JSON.parse(bruto);
  }

  it('userId forjado sem token não é atribuído a ninguém', async () => {
    const store = await import('../server/experiments/store');
    const exp = await store.createExperiment({
      name: 'Teste de manchete',
      variants: ['a', 'b'],
    });
    await store.updateExperiment(exp.id, { status: 'running' });

    // Sem token, alegando ser o aluno.
    const r = await postar(`/api/experiments/${exp.id}/track`, undefined, {
      userId: idAluno,
      sessionId: 'sessao-de-quem-forja',
      eventName: 'converted',
    });
    expect(r.status).toBe(200);

    const eventos = await eventosGravados();
    expect(eventos.length, 'o evento anônimo é registrado — a rota é pública').toBeGreaterThan(0);
    expect(
      eventos.some((e) => e.userId === idAluno),
      'mas nenhum é atribuído ao aluno alegado',
    ).toBe(false);
    expect(
      eventos.some((e) => e.sessionId === 'sessao-de-quem-forja'),
      'o sessionId anônimo continua valendo — é como o visitante participa',
    ).toBe(true);
  });

  it('com token, a conversão é atribuída a quem apresentou o token', async () => {
    const store = await import('../server/experiments/store');
    const exp = await store.createExperiment({
      name: 'Teste de botao',
      variants: ['a', 'b'],
    });
    await store.updateExperiment(exp.id, { status: 'running' });

    const r = await postar(`/api/experiments/${exp.id}/track`, tokenAluno, {
      // Alegando ser outra pessoa, com token válido do aluno.
      userId: 'algum-outro-id',
      eventName: 'converted',
    });
    expect(r.status).toBe(200);

    const eventos = await eventosGravados();
    const desteExp = eventos.filter(
      (e) => (e as { experimentId?: string }).experimentId === exp.id,
    );
    expect(desteExp.length).toBeGreaterThan(0);
    expect(desteExp.every((e) => e.userId === idAluno)).toBe(true);
    expect(desteExp.some((e) => e.userId === 'algum-outro-id')).toBe(false);
  });
});

// ---------------------------------------------------------------- SEC2-910

describe('SEC2-910 · transcrição de sessão não falha aberta', () => {
  it('sessão restrita sem curso não libera para toda conta', async () => {
    const r = await pegar('/api/session/lv-orfa/transcript', tokenAluno);
    expect(r.status).toBe(404);
    expect(r.body).not.toContain('Texto da sessão restrita');
  });

  it('transcrição de sessão apagada não vira pública', async () => {
    const r = await pegar('/api/session/lv-apagada/transcript', tokenAluno);
    expect(r.status, 'apagar a sessão não pode abrir a transcrição').toBe(404);
    expect(r.body).not.toContain('Texto de uma sessão que foi removida');
  });

  it('admin continua lendo as duas', async () => {
    expect((await pegar('/api/session/lv-orfa/transcript', tokenAdmin)).status).toBe(200);
    expect((await pegar('/api/session/lv-apagada/transcript', tokenAdmin)).status).toBe(200);
  });
});

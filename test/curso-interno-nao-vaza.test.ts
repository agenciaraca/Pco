import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * O curso interno não sai do catálogo — e o vídeo não sai de lugar nenhum.
 *
 * Em 2/set/2026 o dono relatou que o **Treinamento PCO**, curso de operadores,
 * estava visível e cursável por toda a escola. O diagnóstico estava certo no
 * essencial e errado na causa: a trava existia e estava ligada — o curso já era
 * `publicListed: false`, com 19 matrículas. **Três caminhos ignoravam a marca**,
 * e o pior deles não era tela: um `curl` sem token em `/api/courses` baixava o
 * curso inteiro com as 9 URLs de vídeo. Somados os quatro cursos ativos, eram
 * **105 URLs ao alcance de quem não estava nem logado**.
 *
 * Para um curso feito de podcasts gravados, **o vídeo é o curso**: tirar
 * `content` (o conserto de 27/ago) e deixar `videoUrl` protegia a apostila e
 * entregava a aula.
 *
 * ## Por que este arquivo é por persona, e não por rota
 *
 * O defeito não era uma rota errada: era a mesma rota respondendo igual para
 * quem tem direitos diferentes. Testar rota a rota deixaria passar exatamente
 * os dois casos que quase quebraram o conserto — e ambos custam caro:
 *
 * - **O aluno matriculado em curso não listado.** `Como ser um Super Aluno
 *   Online` também é `publicListed: false` e tem **655 alunos legítimos**.
 *   Filtrar só por visibilidade sumiria com o curso da estante deles.
 * - **O admin.** Não existe `GET /admin/courses/:id`: o editor de curso lê da
 *   rota pública, e é dela que prefill o campo "URL do vídeo". Servi-la sem
 *   `videoUrl` faria o formulário abrir vazio e **gravar o vazio por cima** ao
 *   salvar — as aulas com vídeo perderiam a URL uma a uma, sem erro nenhum.
 */

/** Se qualquer um destes aparecer na resposta, vazou. */
const VIDEO_PUBLICO = 'https://player.vimeo.com/video/111-do-curso-publico';
const VIDEO_INTERNO = 'https://player.vimeo.com/video/222-do-treinamento-de-operador';
const VIDEO_MATRICULADO = 'https://player.vimeo.com/video/333-do-curso-dos-655';
const VIDEO_DESPUBLICADO = 'https://player.vimeo.com/video/444-do-curso-despublicado';

let tmpDir: string;
let app: { fetch: (req: Request) => Response | Promise<Response> };
/**
 * Tokens obtidos UMA vez. `POST /auth/login` tem teto por minuto, e um teste
 * que loga a cada caso estoura o próprio limite e falha por 429.
 */
let tokenAluno: string;
let tokenAdmin: string;
let alunoId: string;

function curso(opts: {
  id: string;
  titulo: string;
  video: string;
  publicListed?: boolean;
  active?: boolean;
}) {
  return {
    id: opts.id,
    slug: opts.id,
    title: opts.titulo,
    shortTitle: opts.titulo,
    description: `Ementa de ${opts.titulo}`,
    coverColor: 'from-pco-blue to-pco-cyan',
    totalHours: 4,
    certificateAvailable: false,
    active: opts.active ?? true,
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
            description: 'Resumo público da aula',
            durationMinutes: 12,
            order: 1,
            isMandatory: true,
            status: 'published',
            content: '<p>Material completo.</p>',
            videoUrl: opts.video,
          },
        ],
      },
    ],
  };
}

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-vazamento-'));
  process.env.DATA_DIR = tmpDir;
  process.env.INITIAL_STUDENT_PASSWORD = 'TesteAluno!2026';
  process.env.INITIAL_ADMIN_PASSWORD = 'TesteAdmin!2026';

  await fs.writeFile(
    path.join(tmpDir, 'courses.json'),
    JSON.stringify(
      [
        curso({ id: 'c-publico', titulo: 'Curso Público', video: VIDEO_PUBLICO }),
        // O Treinamento PCO deste teste: interno, sem produto, sem matrícula.
        curso({
          id: 'c-interno',
          titulo: 'Treinamento de Operador',
          video: VIDEO_INTERNO,
          publicListed: false,
        }),
        // O caso dos 655: não listado, mas com aluno matriculado.
        curso({
          id: 'c-dos-655',
          titulo: 'Como ser um Super Aluno',
          video: VIDEO_MATRICULADO,
          publicListed: false,
        }),
        // Despublicado (`active: false`) e com aluno dentro. É o caso que
        // faltava: o curso saiu da vitrine, mas quem pagou continua matriculado
        // e no prazo.
        curso({
          id: 'c-despublicado',
          titulo: 'Curso Despublicado',
          video: VIDEO_DESPUBLICADO,
          active: false,
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

  const eu = (await (
    await app.fetch(
      new Request('http://local/api/auth/me', {
        headers: { Authorization: `Bearer ${tokenAluno}` },
      }),
    )
  ).json()) as { id?: string; sub?: string };
  alunoId = eu.id ?? eu.sub!;

  // Matrícula só no curso dos 655. O interno fica sem, de propósito: é a
  // diferença entre os dois que este arquivo mede.
  const matricula = await app.fetch(
    new Request('http://local/api/admin/courses/c-dos-655/enroll-bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdmin}` },
      body: JSON.stringify({ studentIds: [alunoId] }),
    }),
  );
  if (matricula.status !== 200) {
    throw new Error(`matrícula do aluno falhou: ${matricula.status} ${await matricula.text()}`);
  }

  const matriculaDespublicado = await app.fetch(
    new Request('http://local/api/admin/courses/c-despublicado/enroll-bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdmin}` },
      body: JSON.stringify({ studentIds: [alunoId] }),
    }),
  );
  if (matriculaDespublicado.status !== 200) {
    throw new Error(
      `matrícula no despublicado falhou: ${matriculaDespublicado.status} ${await matriculaDespublicado.text()}`,
    );
  }
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
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

async function pegar(url: string, token?: string): Promise<{ status: number; body: string }> {
  const res = await app.fetch(
    new Request(`http://local${url}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),
  );
  return { status: res.status, body: await res.text() };
}

async function catalogo(token?: string): Promise<{ ids: string[]; body: string }> {
  const { status, body } = await pegar('/api/courses', token);
  expect(status).toBe(200);
  return { ids: (JSON.parse(body) as Array<{ id: string }>).map((co) => co.id), body };
}

describe('visitante anônimo', () => {
  it('não recebe o curso interno no catálogo', async () => {
    const { ids } = await catalogo();
    expect(ids).toContain('c-publico');
    expect(ids).not.toContain('c-interno');
  });

  it('também não recebe o curso não listado em que outra gente está matriculada', async () => {
    // Ele não é matriculado de ninguém: a matrícula é do aluno, não do anônimo.
    const { ids } = await catalogo();
    expect(ids).not.toContain('c-dos-655');
  });

  it('não recebe nenhuma URL de vídeo — nem a do curso que ele pode ver', async () => {
    const { body } = await catalogo();
    expect(body).not.toContain(VIDEO_PUBLICO);
    expect(body).not.toContain(VIDEO_INTERNO);
    expect(body).not.toContain(VIDEO_MATRICULADO);
  });

  it('nem pela rota de um curso só', async () => {
    const { status, body } = await pegar('/api/courses/c-publico');
    expect(status).toBe(200);
    expect(body).not.toContain(VIDEO_PUBLICO);
  });

  it('a chave `videoUrl` some, em vez de vir vazia', async () => {
    // String vazia faria a tela cair no ramo "esta aula não tem vídeo" e mentir
    // sobre o curso. Ausência é o mesmo estado de uma aula que nunca teve um.
    const { body } = await pegar('/api/courses/c-publico');
    const co = JSON.parse(body) as { modules: Array<{ lessons: Array<Record<string, unknown>> }> };
    const aula = co.modules[0]!.lessons[0]!;
    expect('videoUrl' in aula).toBe(false);
    expect('content' in aula).toBe(false);
  });

  it('mas a ementa continua pública — é ela que vende', async () => {
    const { body } = await pegar('/api/courses/c-publico');
    expect(body).toContain('Aula de Curso Público');
    expect(body).toContain('Ementa de Curso Público');
  });

  it('e a ementa do curso interno NÃO: 404, como se ele não existisse', async () => {
    // O quarto caminho, que sobrou depois de os outros três serem fechados. Com
    // o curso fora da lista, fora da tela e o vídeo atrás do portão, um `curl`
    // por id ainda trazia os 53 títulos de aula do treinamento de operador.
    //
    // 404 e não 403: 403 confirmaria que o curso existe.
    const { status, body } = await pegar('/api/courses/c-interno');
    expect(status).toBe(404);
    expect(body).not.toContain('Aula de Treinamento de Operador');
  });
});

describe('aluno logado', () => {
  it('não vê o curso interno, em que não está matriculado', async () => {
    const { ids } = await catalogo(tokenAluno);
    expect(ids).not.toContain('c-interno');
  });

  it('CONTINUA vendo o curso não listado em que está matriculado', async () => {
    // O caso dos 655. Filtrar o catálogo só por visibilidade fecharia o
    // vazamento tirando o curso de quem tem direito a ele — e a suíte ficaria
    // verde enquanto 655 alunos perdiam a estante.
    const { ids } = await catalogo(tokenAluno);
    expect(ids).toContain('c-dos-655');
    expect(ids).toContain('c-publico');
  });

  it('não recebe URL de vídeo pelo catálogo, nem a do curso que cursa', async () => {
    const { body } = await catalogo(tokenAluno);
    expect(body).not.toContain(VIDEO_INTERNO);
    expect(body).not.toContain(VIDEO_MATRICULADO);
    expect(body).not.toContain(VIDEO_PUBLICO);
  });

  it('recebe o vídeo do curso em que está matriculado pela rota autenticada', async () => {
    const { status, body } = await pegar(
      '/api/me/courses/c-dos-655/lessons/c-dos-655-l1/content',
      tokenAluno,
    );
    expect(status).toBe(200);
    expect(body).toContain(VIDEO_MATRICULADO);
  });

  it('e não recebe o do curso interno: 403, sem a URL no corpo', async () => {
    const { status, body } = await pegar(
      '/api/me/courses/c-interno/lessons/c-interno-l1/content',
      tokenAluno,
    );
    expect(status).toBe(403);
    expect(body).not.toContain(VIDEO_INTERNO);
  });

  it('abre por id o curso não listado em que está matriculado', async () => {
    // Os 655 entram no curso e fazem quiz por esta rota. Fechá-la por
    // visibilidade sem olhar matrícula tiraria o curso deles.
    const { status, body } = await pegar('/api/courses/c-dos-655', tokenAluno);
    expect(status).toBe(200);
    expect(body).toContain('Aula de Como ser um Super Aluno');
  });

  it('e recebe 404 no curso interno, em que não está', async () => {
    const { status } = await pegar('/api/courses/c-interno', tokenAluno);
    expect(status).toBe(404);
  });

  it('sem token, a rota do conteúdo devolve 401 e nada mais', async () => {
    const { status, body } = await pegar('/api/me/courses/c-dos-655/lessons/c-dos-655-l1/content');
    expect(status).toBe(401);
    expect(body).not.toContain(VIDEO_MATRICULADO);
  });
});

describe('admin', () => {
  it('vê todos os cursos, inclusive os não listados', async () => {
    const { ids } = await catalogo(tokenAdmin);
    expect(ids).toContain('c-publico');
    expect(ids).toContain('c-interno');
    expect(ids).toContain('c-dos-655');
  });

  it('recebe as URLs de vídeo — são 21 telas de administração lendo daqui', async () => {
    const { body } = await catalogo(tokenAdmin);
    expect(body).toContain(VIDEO_INTERNO);
  });

  it('e recebe pela rota de um curso só, que é de onde o editor de aula lê', async () => {
    // Não existe `GET /admin/courses/:id`. Se esta rota esconder o `videoUrl`
    // do admin, o formulário de editar aula abre com o campo vazio e grava o
    // vazio por cima: perde-se a URL de todas as aulas editadas, sem erro.
    const { status, body } = await pegar('/api/courses/c-interno', tokenAdmin);
    expect(status).toBe(200);
    expect(body).toContain(VIDEO_INTERNO);
  });
});

/**
 * Despublicar um curso não pode apagá-lo de quem pagou.
 *
 * `active: false` é o que a tela do admin chama de "despublicar" — e é também
 * o que `deleteCourse` faz, porque a exclusão é lógica. `listCourses()` filtra
 * por ele no repositório, de modo que o curso sumia **de todo mundo ao mesmo
 * tempo**: da estante de quem estava estudando, da rota que entrega o texto e
 * o vídeo da aula, do certificado já emitido (a tela casa cada certificado com
 * o curso de origem e some com o que não achar) e da própria lista do admin —
 * que não tem outra rota para listar curso, e por isso ficava sem caminho de
 * volta pela interface.
 *
 * A regra por persona é a mesma de sempre, e é ela que separa: `isPubliclyListed`
 * já é `active !== false && publicListed !== false`, então o visitante continua
 * sem ver. Quem tem matrícula, vê.
 *
 * **O filtro só existe no caminho de banco.** Em modo JSON o store devolve
 * tudo, então estes casos passariam mesmo antes do conserto: eles são a guarda
 * contra "resolver" isto filtrando `active` para todo mundo de novo. A prova do
 * comportamento em banco está em `test/curso-desativado-nao-congela-aluno.test.ts`,
 * que observa a consulta montada.
 */
describe('curso despublicado', () => {
  it('some para o visitante anônimo — é isso que despublicar quer dizer', async () => {
    const { ids } = await catalogo();
    expect(ids).not.toContain('c-despublicado');
  });

  it('e por id ele é 404, não 403 — 403 confirmaria que existe', async () => {
    const { status } = await pegar('/api/courses/c-despublicado');
    expect(status).toBe(404);
  });

  it('CONTINUA na estante de quem tem matrícula nele', async () => {
    const { ids } = await catalogo(tokenAluno);
    expect(ids).toContain('c-despublicado');
  });

  it('e o aluno continua recebendo o conteúdo e o vídeo da aula', async () => {
    // É a rota que entrega o texto **e** o vídeo. Num curso feito de podcasts
    // gravados, perder isto é perder a aula inteira — e o aluno leria
    // "curso não encontrado" sobre um curso que ele paga.
    const { status, body } = await pegar(
      '/api/me/courses/c-despublicado/lessons/c-despublicado-l1/content',
      tokenAluno,
    );
    expect(status).toBe(200);
    expect(body).toContain(VIDEO_DESPUBLICADO);
    expect(body).toContain('Material completo');
  });

  it('o admin vê o curso — senão não há como republicá-lo', async () => {
    const { ids } = await catalogo(tokenAdmin);
    expect(ids).toContain('c-despublicado');
  });

  it('e a lista do admin diz que ele está despublicado', async () => {
    // A tela já tinha o selo "Despublicado" e a ação em massa de publicar;
    // faltava o dado chegar. Sem `active` na resposta, a lista mostraria o
    // curso como publicado — trocar um sumiço por uma mentira não é conserto.
    const { body } = await catalogo(tokenAdmin);
    const lista = JSON.parse(body) as Array<{ id: string; active?: boolean }>;
    expect(lista.find((co) => co.id === 'c-despublicado')?.active).toBe(false);
    expect(lista.find((co) => co.id === 'c-publico')?.active).not.toBe(false);
  });
});

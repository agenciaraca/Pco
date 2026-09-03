import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * A segunda rodada de correções de 3/set/2026 — e o que ela ensina.
 *
 * A primeira rodada (`5a828c2`) corrigiu oito achados de segurança. A segunda
 * passada da auditoria foi feita **em cima dela**, e encontrou defeitos nas
 * próprias correções da manhã. Este arquivo existe porque essa é a lição mais
 * cara do dia: **correção não auditada é código não auditado**, e três destes
 * casos falham contra o commit que os "resolveu".
 *
 * - **REG-001** — `ehTicketRestrito` foi escrita para negar "pela PRESENÇA da
 *   claim, para que claim nova que ninguém lembrar de listar continue sendo
 *   recusada por padrão". O comentário descrevia lista branca; o código era
 *   `payload.totp === 'pending'` — lista negra de um item só. E a claim que
 *   "ninguém lembrou de listar" **já existia no repositório naquele momento**:
 *   `broadcasts.ts` assina, para cada destinatário de comunicado, um token com
 *   `scope: 'unsubscribe'`, `tv: 0` e **TTL de um ano**, entregue na query
 *   string de um link dentro do e-mail. Era sessão de aluno plena por 365 dias
 *   para toda conta com `tokenVersion` 0 — o padrão de quem nunca trocou a
 *   senha —, viajando em caixa de entrada, histórico de navegador e log de
 *   servidor de correio.
 *
 * - **REG-002** — a trava contra estorno duplo era adquirida **antes** de
 *   quatro `return` de validação. Dois deles, `NO_EXTERNAL` e `NOT_SUPPORTED`,
 *   são os caminhos **normais** de pedido manual e de gateway sem estorno por
 *   API (a Sandra). Uma única tentativa recusada por ali deixava o id no `Set`
 *   para sempre: aquele pedido respondia 409 até o processo reiniciar. A trava
 *   contra estorno duplo virava trava contra estorno nenhum — e o pedido que
 *   mais precisa de estorno manual era justamente o que não conseguia mais
 *   nem tentar.
 *
 * - **SEC2-901/902** — as quatro rotas do fórum tinham `requireAuth()` e mais
 *   nada: **qualquer** conta autenticada lia e escrevia no fórum de
 *   **qualquer** curso, incluindo o Treinamento PCO, que é interno de
 *   operadores. O módulo de comentários de aula, ao lado, já passava por
 *   `courseAccessFor` desde 27/ago — a correção daquele dia chegou aos
 *   comentários e parou ali. E `authorName` gravava o **e-mail inteiro** do
 *   aluno, publicado para todo mundo que abrisse o fórum.
 *
 *   O teste que deveria ter pego isso chama-se "ler o fórum e os comentários
 *   exige o mesmo que escrever": para os comentários ele cobra 403/404 **com
 *   token de aluno não matriculado**; para o fórum, cobrava só 401 **sem
 *   token** — a garantia mais fraca, cristalizada num caso com o nome certo.
 *   Por isso aqui a asserção é sempre **com token de quem não tem direito**,
 *   nunca sem token: sem token qualquer rota autenticada passa no teste sem
 *   provar nada.
 */

let tmpDir: string;
let app: { fetch: (req: Request) => Response | Promise<Response> };
let tokenAluno: string;
let tokenAdmin: string;
let idAluno: string;
let idAdmin: string;

function curso(id: string, titulo: string) {
  return {
    id,
    slug: id,
    title: titulo,
    shortTitle: titulo,
    description: `Ementa de ${titulo}`,
    coverColor: 'from-pco-blue to-pco-cyan',
    totalHours: 2,
    active: true,
    publicListed: true,
    modules: [
      {
        id: `${id}-m1`,
        title: 'Módulo 1',
        order: 1,
        lessons: [
          {
            id: `${id}-l1`,
            title: 'Aula 1',
            order: 1,
            durationMin: 10,
            content: 'Corpo da aula.',
          },
        ],
      },
    ],
  };
}

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-auditoria2-'));
  process.env.DATA_DIR = tmpDir;
  process.env.INITIAL_STUDENT_PASSWORD = 'TesteAluno!2026';
  process.env.INITIAL_ADMIN_PASSWORD = 'TesteAdmin!2026';

  await fs.writeFile(
    path.join(tmpDir, 'courses.json'),
    JSON.stringify(
      [curso('c-matriculado', 'Curso Que o Aluno Cursa'), curso('c-alheio', 'Curso de Outra Turma')],
      null,
      2,
    ),
    'utf8',
  );

  const mod = await import('../server/app');
  app = mod.buildApp();

  tokenAluno = await entrar('aluno@pco.local', 'TesteAluno!2026');
  tokenAdmin = await entrar('admin@pco.local', 'TesteAdmin!2026');

  const { verifyToken } = await import('../server/auth/jwt');
  idAluno = (await verifyToken(tokenAluno))!.sub;
  idAdmin = (await verifyToken(tokenAdmin))!.sub;

  // O aluno cursa UM dos dois. É a diferença entre os dois cursos que prova o
  // portão do fórum: sem um curso em que ele PODE entrar, um 403 constante
  // passaria no teste sem distinguir portão de rota quebrada.
  const students = await import('../server/repositories/students');
  await students.enrollInCourse(idAluno, 'c-matriculado');
});

afterAll(async () => {
  if (!tmpDir) return;
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

// ---------------------------------------------------------------- REG-001

describe('REG-001 · só claim de sessão vira sessão', () => {
  it('o token de descadastro de comunicado NÃO é uma sessão', async () => {
    // Forjado exatamente como `broadcasts.ts` o emite: mesma função, mesmo
    // segredo, papel de aluno, `tv: 0`, um ano de validade.
    const { signToken } = await import('../server/auth/jwt');
    const unsub = await signToken(
      { sub: idAluno, email: 'aluno@pco.local', role: 'student', tv: 0, scope: 'unsubscribe' },
      365 * 24 * 60 * 60,
    );

    const meus = await pegar('/api/me/orders', unsub);
    expect(meus.status, 'token de unsubscribe não pode abrir rota de aluno').toBe(401);

    const perfil = await pegar('/api/auth/me', unsub);
    expect(perfil.status, 'token de unsubscribe não pode devolver perfil').toBe(401);
  });

  it('claim futura que ninguém lembrou de listar também é recusada', async () => {
    // O ponto da lista branca: este `proposito` não existe no código de hoje.
    // Se um dia existir, ele já nasce recusado — que é o único lado seguro
    // para errar. Uma lista negra passaria neste caso.
    const { signToken } = await import('../server/auth/jwt');
    const inventado = await signToken({
      sub: idAluno,
      email: 'aluno@pco.local',
      role: 'student',
      tv: 0,
      proposito: 'confirmar-email-daqui-a-dois-anos',
    });
    expect((await pegar('/api/me/orders', inventado)).status).toBe(401);
  });

  it('o ticket de 2FA continua recusado', async () => {
    // A garantia que a rodada da manhã comprou não pode ter sido perdida na
    // troca de lista negra por lista branca.
    const { signToken } = await import('../server/auth/jwt');
    const ticket = await signToken(
      { sub: idAdmin, email: 'admin@pco.local', role: 'admin', tv: 0, totp: 'pending' },
      600,
    );
    expect((await pegar('/api/admin/students', ticket)).status).toBe(401);
  });

  it('a personificação continua sendo sessão — `act` é claim legítima', async () => {
    // Esta é a guarda contra "consertar" negando o bom junto com o ruim.
    // `act` é o admin agindo como aluno, e é sessão de verdade: se a lista
    // branca a esquecesse, o suporte perderia a ferramenta inteira.
    const { signToken } = await import('../server/auth/jwt');
    const personificando = await signToken({
      sub: idAluno,
      email: 'aluno@pco.local',
      role: 'student',
      tv: 0,
      act: { sub: idAdmin, email: 'admin@pco.local', role: 'admin' },
    });
    expect((await pegar('/api/me/orders', personificando)).status).toBe(200);
  });

  it('o token normal de login continua funcionando', async () => {
    expect((await pegar('/api/me/orders', tokenAluno)).status).toBe(200);
    expect((await pegar('/api/admin/students', tokenAdmin)).status).toBe(200);
  });
});

// ---------------------------------------------------------------- REG-002

describe('REG-002 · estorno recusado não tranca o pedido', () => {
  it('pedido sem externalId pode ser tentado de novo — 400, nunca 409', async () => {
    const ordersRepo = await import('../server/payments/orders-repo');
    // Pedido pago SEM `externalId`: é a forma de todo lançamento manual feito
    // pelo admin, e o caminho que o `NO_EXTERNAL` recusa.
    const pedido = await ordersRepo.createOrder({
      userId: idAluno,
      userEmail: 'aluno@pco.local',
      productId: 'p-manual',
      productSnapshot: {
        name: 'Curso Que o Aluno Cursa',
        priceCents: 10000,
        currency: 'BRL',
        kind: 'course',
        refId: 'c-matriculado',
      },
      gatewayId: 'gw-inexistente',
      gatewayProvider: 'mock',
      amountCents: 10000,
      currency: 'BRL',
    });
    await ordersRepo.updateStatus(pedido.id, 'paid', 'teste');

    const primeira = await postar(`/api/admin/orders/${pedido.id}/refund`, tokenAdmin, {});
    expect(primeira.status, 'primeira tentativa recusa por NO_EXTERNAL').toBe(400);
    expect(primeira.body).toContain('NO_EXTERNAL');

    // O que trancava: a trava era tomada antes deste `return`, e nunca
    // liberada. A segunda tentativa vinha 409 REFUND_IN_PROGRESS — para um
    // estorno que nunca começou — e continuava assim até o processo reiniciar.
    const segunda = await postar(`/api/admin/orders/${pedido.id}/refund`, tokenAdmin, {});
    expect(segunda.status, 'a segunda tentativa não pode virar 409').toBe(400);
    expect(segunda.body).toContain('NO_EXTERNAL');
    expect(segunda.body).not.toContain('REFUND_IN_PROGRESS');
  });

  it('valor maior que o pedido também não tranca', async () => {
    const ordersRepo = await import('../server/payments/orders-repo');
    const pedido = await ordersRepo.createOrder({
      userId: idAluno,
      userEmail: 'aluno@pco.local',
      productId: 'p-manual-2',
      productSnapshot: {
        name: 'Curso Que o Aluno Cursa',
        priceCents: 10000,
        currency: 'BRL',
        kind: 'course',
        refId: 'c-matriculado',
      },
      gatewayId: 'gw-inexistente',
      gatewayProvider: 'mock',
      amountCents: 10000,
      currency: 'BRL',
    });
    await ordersRepo.updateStatus(pedido.id, 'paid', 'teste');

    // Erro de digitação do admin — um zero a mais. Não pode custar o pedido.
    const errada = await postar(`/api/admin/orders/${pedido.id}/refund`, tokenAdmin, {
      amountCents: 100000,
    });
    expect(errada.status).toBe(400);

    const denovo = await postar(`/api/admin/orders/${pedido.id}/refund`, tokenAdmin, {
      amountCents: 100000,
    });
    expect(denovo.status, 'digitar errado duas vezes não tranca o pedido').toBe(400);
    expect(denovo.body).not.toContain('REFUND_IN_PROGRESS');
  });
});

// ------------------------------------------------------------ SEC2-901/902

describe('SEC2-901 · o fórum é do curso, e o curso tem dono', () => {
  it('aluno matriculado lê e escreve no fórum do curso dele', async () => {
    const criou = await postar('/api/courses/c-matriculado/forum/threads', tokenAluno, {
      title: 'Dúvida sobre o módulo 1',
      body: 'Alguém pode explicar a leitura da semana?',
      kind: 'pergunta',
    });
    expect(criou.status, 'quem cursa participa').toBe(201);

    const lista = await pegar('/api/courses/c-matriculado/forum/threads', tokenAluno);
    expect(lista.status).toBe(200);
    expect(lista.body).toContain('Dúvida sobre o módulo 1');
  });

  it('aluno NÃO matriculado não lê o fórum de outro curso — mesmo autenticado', async () => {
    // Com token válido, de propósito: era exatamente esta a garantia que
    // faltava, e o teste antigo cobria só a ausência de token.
    const lista = await pegar('/api/courses/c-alheio/forum/threads', tokenAluno);
    expect(lista.status, 'estar logado não é estar matriculado').toBe(403);
  });

  it('aluno NÃO matriculado não escreve no fórum de outro curso', async () => {
    const tentou = await postar('/api/courses/c-alheio/forum/threads', tokenAluno, {
      title: 'Entrei sem ser da turma',
      body: 'Escrevendo no fórum de um curso que não é meu.',
      kind: 'discussao',
    });
    expect(tentou.status).toBe(403);
  });

  it('thread de curso alheio responde 404, não 403 — não confirmamos existência', async () => {
    // O admin cria a thread no curso que o aluno não cursa; o aluno tenta abrir
    // pelo id. 403 aqui contaria ao aluno que a thread existe.
    const criou = await postar('/api/courses/c-alheio/forum/threads', tokenAdmin, {
      title: 'Assunto da outra turma',
      body: 'Conteúdo que o aluno de fora não pode ver.',
      kind: 'discussao',
    });
    expect(criou.status).toBe(201);
    const id = (JSON.parse(criou.body) as { id: string }).id;

    const abriu = await pegar(`/api/forum/threads/${id}`, tokenAluno);
    expect(abriu.status, 'existência de thread alheia não se confirma').toBe(404);
    expect(abriu.body).not.toContain('Conteúdo que o aluno de fora não pode ver');

    const respondeu = await postar(`/api/forum/threads/${id}/replies`, tokenAluno, {
      body: 'Respondendo onde não devia.',
    });
    expect(respondeu.status).toBe(404);
  });

  it('admin enxerga o fórum de qualquer curso', async () => {
    // É de onde a moderação lê. Fechar demais aqui quebraria o produto.
    const lista = await pegar('/api/courses/c-matriculado/forum/threads', tokenAdmin);
    expect(lista.status).toBe(200);
  });
});

describe('SEC2-902 · o fórum não publica o e-mail de quem escreve', () => {
  it('authorName é a parte local, nunca o endereço inteiro', async () => {
    const criou = await postar('/api/courses/c-matriculado/forum/threads', tokenAluno, {
      title: 'Outra dúvida',
      body: 'Testando o nome que aparece ao lado da mensagem.',
      kind: 'pergunta',
    });
    expect(criou.status).toBe(201);

    const lista = await pegar('/api/courses/c-matriculado/forum/threads', tokenAluno);
    expect(lista.body, 'o e-mail do aluno não vira conteúdo do fórum').not.toContain(
      'aluno@pco.local',
    );
    expect(lista.body).toContain('"authorName":"aluno"');
  });

  it('a resposta também não carrega o e-mail', async () => {
    const criou = await postar('/api/courses/c-matriculado/forum/threads', tokenAluno, {
      title: 'Thread para responder',
      body: 'Corpo qualquer para abrir a thread.',
      kind: 'discussao',
    });
    const id = (JSON.parse(criou.body) as { id: string }).id;

    const respondeu = await postar(`/api/forum/threads/${id}/replies`, tokenAluno, {
      body: 'Minha resposta na thread.',
    });
    expect(respondeu.status).toBe(201);

    const aberta = await pegar(`/api/forum/threads/${id}`, tokenAluno);
    expect(aberta.body).not.toContain('aluno@pco.local');
  });
});

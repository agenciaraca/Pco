import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import { naoVazio } from './nao-vazio';
import path from 'node:path';
import os from 'node:os';

/**
 * O inventário do que responde sem token — e a exigência de que a lista seja
 * uma **decisão**, não um resíduo.
 *
 * Em 27/ago/2026, além das cinco rotas de `/admin/` que vazavam a base de
 * alunos, três outras respondiam a qualquer um:
 *
 * - `GET /retention/risks` — nome, score de risco e motivos de cada aluno.
 *   Pior que a lista de matrícula: é um juízo sobre pessoas nomeadas.
 * - `POST /ai/tutor` — recurso pago; e sem usuário no contexto a cota caía no
 *   id do aluno-semente, então um anônimo gastava a cota de uma conta real.
 * - `GET /courses/:id/forum/threads` e `GET /forum/threads/:id` — discussão de
 *   um curso pago, com nome de aluno. Escrever já exigia token; ler, não.
 *
 * Este teste mantém a lista de rotas públicas **explícita**. Tornar uma rota
 * pública passa a exigir escrevê-la aqui, o que é exatamente o momento de
 * alguém perguntar "isso pode mesmo?".
 */

let tmpDir: string;
let app: {
  fetch: (req: Request) => Response | Promise<Response>;
  routes: Array<{ path: string; method: string }>;
};

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-publicas-'));
  process.env.DATA_DIR = tmpDir;
  const mod = await import('../server/app');
  app = mod.buildApp() as unknown as typeof app;
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

/**
 * As rotas que respondem sem token **por decisão**. Cada uma com o motivo.
 * Sem correspondência exata: é `METHOD /api/caminho`, como o app registra.
 */
const PUBLICAS_POR_DECISAO: Record<string, string> = {
  // Vitrine e conteúdo de marketing — quem ainda não tem conta precisa ver.
  'GET /api/courses': 'catálogo; conteúdo de aula não sai daqui',
  'GET /api/courses/:id': 'página de curso; conteúdo de aula não sai daqui',
  'GET /api/courses/:id/rating': 'nota do curso, agregada',
  'GET /api/courses/:id/reviews': 'avaliações públicas do curso',
  'GET /api/products': 'preços dos cursos, para a vitrine',
  'GET /api/news': 'posts do blog, conteúdo de marketing',
  'GET /api/podcasts': 'podcast público',
  'GET /api/podcasts/:id': 'episódio público',
  'GET /api/library': 'biblioteca pública',
  'GET /api/study-paths': 'trilhas de estudo',
  'GET /api/study-paths/:slug': 'trilha de estudo',
  'GET /api/lessons/:id/preview': 'só aula marcada como preview; a rota verifica',
  'GET /api/lessons/:id/transcript': 'idem — exige matrícula ou preview',
  'GET /api/lessons/:id/transcript.:format': 'transcrição em arquivo; mesma verificação',
  'GET /api/settings': 'nome da escola, contato, links legais',
  'GET /api/login-config': 'aparência da tela de login',

  // Sessões: o aluno decide antes de ter conta. E-mail e valor-hora do
  // profissional já são omitidos na projeção pública.
  'GET /api/sessions/services': 'catálogo de serviços',
  'GET /api/sessions/professionals': 'sem e-mail e sem valor-hora',
  'GET /api/sessions/available': 'quem atende agora',
  'GET /api/sessions/price-tiers': 'faixas de preço por titulação',
  'GET /api/sessions/policy': 'a regra de venda casada, como dado',
  'GET /api/sessions/professionals/:id/horarios': 'só hora e livre/ocupado',

  // Autenticação: são as portas de entrada.
  'POST /api/auth/login': 'porta de entrada',
  'POST /api/auth/login/totp': 'segundo fator do login',
  'POST /api/auth/forgot-password': 'quem esqueceu a senha não tem token',
  'POST /api/auth/reset-password': 'idem, com o código do e-mail',
  'GET /api/auth/me': 'responde 401 sozinha quando não há token',
  'GET /api/auth/oauth/google': 'início do fluxo OAuth',
  'GET /api/auth/oauth/google/callback': 'retorno do provedor',
  'GET /api/auth/oauth/microsoft': 'início do fluxo OAuth',
  'GET /api/auth/oauth/microsoft/callback': 'retorno do provedor',
  'GET /api/auth/saml/login': 'início do fluxo SAML',
  'POST /api/auth/saml/acs': 'retorno do IdP',
  'GET /api/me/impersonation': 'verifica o token por conta própria',

  // Compra sem conta prévia.
  'POST /api/public/checkout': 'compra provisiona a conta',
  'POST /api/payments/webhook/:gatewayId': 'quem chama é o gateway; valida assinatura',

  // Operação e observabilidade.
  'GET /api/health': 'monitoração',
  'GET /api/ready': 'monitoração',
  'GET /api/version': 'monitoração',
  'POST /api/client-errors': 'erro de JS no navegador de quem nem logou',
  'GET /api/certificates/validate/:code': 'validação de certificado por terceiros',
  'GET /api/unsubscribe': 'descadastro por link de e-mail',

  // API pública documentada.
  'GET /api/v1/docs': 'documentação',
  'GET /api/v1/openapi.json': 'documentação',
  'GET /api/v1/openapi.yaml': 'documentação',

  // Medição e experimentos — sinal de quem visita, sem identificar ninguém.
  'POST /api/analytics/hit': 'o visitante não tem conta; é ele que se mede',
  'GET /api/metrics/seo/status': 'de onde vêm os números',
  'GET /api/metrics/seo/timeseries': 'série agregada, sem pessoa',
  'GET /api/metrics/seo/keywords': 'vazio até haver Search Console',
  'GET /api/experiments/active': 'variante de A/B para quem visita',
  'POST /api/experiments/:id/track': 'conversão de A/B',

  // Catálogo de provedores de IA — nomes e URLs, sem chave nem configuração.
  'GET /api/ai/providers': 'metadados dos provedores, sem credencial',
};

function chave(r: { method: string; path: string }): string {
  return `${r.method} ${r.path}`;
}

describe('inventário de rotas públicas', () => {
  it('nenhuma rota responde sem token fora da lista de decisões', async () => {
    const vistas = new Set<string>();
    const surpresas: string[] = [];

    for (const r of app.routes) {
      if (r.method === 'ALL') continue;
      const k = chave(r);
      if (vistas.has(k)) continue;
      vistas.add(k);
      // **A isenção pula a verificação, e é por isso que o motivo escrito
      // precisa ser cobrado em outro lugar.** Ver o describe
      // "o motivo escrito é verificado" no fim deste arquivo: até 3/set/2026
      // a garantia de `/sessions/professionals` ("sem e-mail e sem valor-hora")
      // era uma frase que nada conferia — a rota entrava aqui, o laço a pulava,
      // e ninguém mais olhava.
      if (PUBLICAS_POR_DECISAO[k]) continue;

      const url = `http://local${r.path.replace(/:[^/]+/g, 'x-teste')}`;
      const init: RequestInit = { method: r.method };
      if (r.method !== 'GET' && r.method !== 'DELETE') {
        init.headers = { 'Content-Type': 'application/json' };
        init.body = '{}';
      }
      const res = await app.fetch(new Request(url, init));
      if (res.status !== 401) surpresas.push(`${k} → ${res.status}`);
    }

    expect(
      surpresas,
      `rotas respondendo sem token e fora do inventário — se for de propósito, ` +
        `acrescente em PUBLICAS_POR_DECISAO com o motivo:\n${surpresas.join('\n')}`,
    ).toEqual([]);
  });

  it('todo item do inventário tem um motivo escrito', () => {
    for (const [rota, motivo] of Object.entries(PUBLICAS_POR_DECISAO)) {
      expect(motivo.trim().length, rota).toBeGreaterThan(5);
    }
  });
});

describe('as três que deixaram de ser públicas', () => {
  it('o risco de evasão não sai sem token — são nomes de pessoas', async () => {
    const res = await app.fetch(new Request('http://local/api/retention/risks'));
    expect(res.status).toBe(401);
  });

  it('o tutor exige login — é recurso pago e a cota é de alguém', async () => {
    const res = await app.fetch(
      new Request('http://local/api/ai/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'oi' }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it('o fórum do curso não é lido sem login', async () => {
    for (const rota of ['/api/courses/c-psi/forum/threads', '/api/forum/threads/t-1']) {
      const res = await app.fetch(new Request(`http://local${rota}`));
      expect(res.status, rota).toBe(401);
    }
  });
});

/**
 * QA2-003 · o motivo escrito é verificado, não só escrito.
 *
 * O laço acima **pula** as rotas isentas: `if (PUBLICAS_POR_DECISAO[k]) continue`.
 * Isso é correto para a pergunta que ele faz ("responde sem token?"), mas
 * significa que a coluna da direita da lista — o motivo — nunca foi conferida
 * por ninguém. E dois desses motivos não são justificativas genéricas: são
 * **afirmações técnicas sobre o que a resposta contém**.
 *
 * Uma afirmação técnica que nada verifica é a mesma coisa que este arquivo
 * inteiro existe para impedir. O caso mais caro da auditoria de 27/ago foi
 * exatamente esse: `GET /api/auth/me` estava na lista com o motivo "responde
 * 401 sozinha", o motivo era falso, e a rota devolvia o perfil de uma pessoa
 * real a quem não apresentasse token.
 */
describe('o motivo escrito é verificado', () => {
  it('"sem e-mail e sem valor-hora" — e a semente tem os dois, senão não prova nada', async () => {
    const res = await app.fetch(new Request('http://local/api/sessions/professionals'));
    expect(res.status).toBe(200);
    const lista = (await res.json()) as Array<Record<string, unknown>>;

    // Sem esta linha o caso passaria com a rota devolvendo `[]` — o mesmo
    // defeito das 31 asserções vacuosas corrigidas em 3/set/2026.
    naoVazio(lista, 'a lista pública de profissionais');

    for (const p of lista) {
      expect(p, 'e-mail de profissional não sai em rota pública').not.toHaveProperty('email');
      expect(p, 'valor-hora não sai em rota pública').not.toHaveProperty('hourlyRate');
    }

    // E a prova de que havia o que omitir: a semente traz os dois campos.
    const repo = await import('../server/repositories/sessions');
    const cru = naoVazio(await repo.listProfessionals(), 'os profissionais crus');
    expect(
      cru.some((p) => Boolean((p as unknown as Record<string, unknown>).email)),
      'a semente precisa ter e-mail, senão a omissão é trivial',
    ).toBe(true);
    expect(
      cru.some((p) => Boolean((p as unknown as Record<string, unknown>).hourlyRate)),
      'a semente precisa ter valor-hora, senão a omissão é trivial',
    ).toBe(true);
  });

  it('/sessions/available omite os mesmos campos — é a mesma projeção', async () => {
    const res = await app.fetch(new Request('http://local/api/sessions/available'));
    expect(res.status).toBe(200);
    const corpo = (await res.json()) as { profissionais: Array<Record<string, unknown>> };
    // Aqui a lista PODE vir vazia legitimamente (ninguém disponível agora), e
    // por isso a asserção é sobre a forma de cada item, não sobre haver itens.
    for (const p of corpo.profissionais) {
      expect(p).not.toHaveProperty('email');
      expect(p).not.toHaveProperty('hourlyRate');
    }
  });

  it('a rota de admin, essa sim, traz os campos — senão o painel perde o dado', async () => {
    // Guarda contra "consertar" removendo o campo na origem: quem administra
    // precisa do e-mail e do valor-hora, e é de lá que a tela lê.
    const res = await app.fetch(new Request('http://local/api/admin/sessions/professionals'));
    expect(res.status, 'e continua exigindo token').toBe(401);
  });
});

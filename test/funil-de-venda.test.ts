import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * O caminho da venda, percorrido de verdade.
 *
 * O defeito que originou estes testes não era de código feio: o botão
 * "Matricular-se" apontava para `/catalogo`, que virava 301 de volta para a
 * lista. Quem decidia comprar voltava para o começo, e o `/checkout` — que
 * funciona — não tinha um único link apontando para ele.
 *
 * `test/links-internos.test.ts` cobra isso lendo o fonte. Este aqui **anda**:
 * pede a home, extrai o link para a lista, pede a lista, extrai o link do
 * curso, e assim até o checkout. Se algum degrau sumir ou passar a redirecionar,
 * a corrente quebra aqui — que é como o visitante descobriria.
 */

let tmpDir: string;
let site: { fetch: (req: Request) => Response | Promise<Response> };

const BASE = 'http://local';

async function pedir(caminho: string) {
  const res = await site.fetch(new Request(BASE + caminho));
  return { status: res.status, html: res.status === 200 ? await res.text() : '' };
}

/**
 * Primeiro href que casa com o padrão, ignorando o cabeçalho.
 *
 * O menu do site tem uma porta direta para o carro-chefe — decisão do dono, com
 * o slug escrito à mão. Se a busca começasse do topo, todo teste de funil
 * seguiria esse link em vez do que a página oferece, e mediria o menu em vez da
 * página. O `<main>` é onde a página fala.
 */
function corpo(html: string): string {
  const i = html.indexOf('<main');
  return i > -1 ? html.slice(i) : html;
}

function primeiroLink(html: string, padrao: RegExp): string | null {
  for (const m of corpo(html).matchAll(/href="([^"]+)"/g)) {
    if (padrao.test(m[1])) return m[1];
  }
  return null;
}

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-funil-'));
  process.env.DATA_DIR = tmpDir;

  await fs.writeFile(
    path.join(tmpDir, 'courses.json'),
    JSON.stringify(
      [
        {
          id: 'c-1',
          slug: 'formacao-teste',
          title: 'Formação de Teste',
          shortTitle: 'Teste',
          description: 'Uma formação para o funil.',
          coverColor: 'from-pco-blue to-pco-cyan',
          totalHours: 40,
          certificateAvailable: true,
          tags: [],
          modules: [],
        },
      ],
      null,
      2,
    ),
    'utf8',
  );

  const agora = new Date().toISOString();
  await fs.writeFile(
    path.join(tmpDir, 'payment-products.json'),
    JSON.stringify(
      [
        {
          id: 'p-1',
          name: 'Formação de Teste',
          kind: 'course',
          refId: 'c-1',
          priceCents: 99900,
          currency: 'BRL',
          active: true,
          createdAt: agora,
          updatedAt: agora,
        },
      ],
      null,
      2,
    ),
    'utf8',
  );

  const mod = await import('../server/public/router');
  site = mod.publicSite;
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('funil de venda', () => {
  it('vai da home ao checkout seguindo os links, sem degrau quebrado', async () => {
    // 1. Home
    const home = await pedir('/');
    expect(home.status, 'a home não respondeu').toBe(200);

    // 2. Home -> lista
    const paraLista = primeiroLink(home.html, /^\/formacoes$/);
    expect(paraLista, 'a home não oferece caminho para a lista de formações').not.toBeNull();

    const lista = await pedir(paraLista!);
    expect(lista.status).toBe(200);

    // 3. Lista -> página do curso
    const paraCurso = primeiroLink(lista.html, /^\/formacao\/[^"]+$/);
    expect(paraCurso, 'a lista não oferece caminho para nenhum curso').not.toBeNull();

    const curso = await pedir(paraCurso!);
    expect(curso.status).toBe(200);

    // 4. Curso -> checkout. Este é o degrau que estava quebrado.
    const paraCheckout = primeiroLink(curso.html, /^\/checkout\?curso=/);
    expect(
      paraCheckout,
      'a página do curso não leva ao checkout — foi exatamente este o defeito de 30/ago',
    ).not.toBeNull();

    const checkout = await pedir(paraCheckout!);
    expect(checkout.status).toBe(200);

    // 5. O checkout precisa ter o formulário que fala com a API.
    expect(checkout.html, 'o checkout chegou sem formulário').toContain('data-checkout');
    expect(checkout.html).toContain('data-checkout-submit');
  });

  it('o carrinho é alcançável e leva ao seu checkout', async () => {
    // O cabeçalho já linkava /carrinho antes de a página existir — era 404.
    const carrinho = await pedir('/carrinho');
    expect(carrinho.status).toBe(200);

    const paraCheckout = primeiroLink(carrinho.html, /^\/checkout\?carrinho=1$/);
    expect(paraCheckout, 'o carrinho não leva ao checkout').not.toBeNull();

    const checkout = await pedir(paraCheckout!);
    expect(checkout.status).toBe(200);
    expect(checkout.html).toContain('data-checkout-carrinho');
  });

  it('nenhuma página do funil devolve link para rota que redireciona', async () => {
    const { ROTAS_FUNDIDAS } = await import('../server/public/rotas-fundidas');
    const fundidas = Object.keys(ROTAS_FUNDIDAS);

    for (const rota of ['/', '/formacoes', '/formacao/formacao-teste', '/carrinho']) {
      const { status, html } = await pedir(rota);
      expect(status, `${rota} não respondeu`).toBe(200);

      const ofensores = [...html.matchAll(/href="([^"]+)"/g)]
        .map((m) => m[1].split('?')[0])
        .filter((h) => fundidas.includes(h));
      expect(ofensores, `${rota} aponta para rota fundida`).toEqual([]);
    }
  });
});

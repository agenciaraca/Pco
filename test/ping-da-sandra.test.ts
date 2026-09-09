/**
 * O teste de conexão da Sandra consultava um endereço que não existe.
 *
 * ## O que foi medido
 *
 * O ping lia `GET /charges?limit=1` — listagem. **Essa rota não existe** na API
 * da Sandra. Medido contra a API de produção em 9/set/2026, só com leituras:
 *
 * | requisição                          | resposta                              |
 * | ----------------------------------- | ------------------------------------- |
 * | `GET /charges?limit=1`              | 404 `No v1 endpoint for GET /charges` |
 * | `GET /charges/<id fora do formato>` | 400 `invalid_id_format`               |
 * | `GET /charges/<uuid inexistente>`   | 404 `{"error":"not_found"}`           |
 * | idem, com chave inválida            | 401 `{"error":"invalid_api_key"}`     |
 *
 * O card ficou vermelho desde 8/set dizendo "Sandra respondeu HTTP 404" — e
 * isso se lê como credencial ruim ou gateway fora do ar. A credencial estava
 * boa; a URL é que não existia.
 *
 * **Isso importa mais nesta do que em qualquer outro gateway.** A Sandra ainda
 * não emite `charge.paid`, então o worker de sondagem é o ÚNICO confirmador de
 * pagamento dela: credencial vencida ali é venda paga que não vira matrícula,
 * em silêncio. É o gateway em que este botão mais precisa dizer a verdade.
 *
 * A boa notícia que a medição trouxe: `GET /charges/:id` — o caminho que a
 * sondagem usa — sempre funcionou. Só o ping estava errado.
 *
 * ## A escolha do endpoint
 *
 * Consultar uma cobrança que não existe lê o **mesmo recurso** que o checkout
 * escreve, que é a regra do `ping-http`. `GET /tenants/<slug>` responde 200 e
 * seria mais simples, mas é outro recurso: chave restrita ao cadastro do
 * tenant diria "OK" sem conseguir vender. E `/invoices` traz nome de aluno —
 * um teste de conexão não puxa dado pessoal de terceiro para o log.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getPaymentProvider } from '../server/payments/providers/registry';

const gateway = {
  id: 'gw-sandra',
  provider: 'sandra' as const,
  displayName: 'Sandra',
  mode: 'live' as const,
  active: true,
  apiKey: 'enc',
  options: { baseUrl: 'https://app.sandra.com.vc', tenantSlug: 'pco-escola', metodo: 'boleto' },
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};
const creds = { apiKey: 'chave-de-teste' };

function respostaFalsa(status: number, corpo: string, tipo = 'application/json; charset=utf-8') {
  return new Response(corpo, { status, headers: { 'content-type': tipo } });
}

/** Captura a URL chamada e devolve a resposta combinada. */
function mockFetch(resposta: Response): { urls: string[] } {
  const urls: string[] = [];
  vi.stubGlobal('fetch', (url: string | URL) => {
    urls.push(String(url));
    return Promise.resolve(resposta.clone());
  });
  return { urls };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

async function ping(resposta: Response) {
  const provider = getPaymentProvider('sandra')!;
  const { urls } = mockFetch(resposta);
  const r = await provider.ping!(gateway as never, creds as never);
  return { r, urls };
}

describe('ping da Sandra', () => {
  it('consulta UMA cobrança, não a listagem que não existe', async () => {
    const { urls } = await ping(respostaFalsa(404, '{"error":"not_found"}'));
    expect(urls).toHaveLength(1);
    const url = urls[0]!;
    expect(url).toContain('/charges/');
    // A listagem é o endereço que não existe: `/charges` seco, com query.
    expect(url).not.toMatch(/\/charges(\?|$)/);
    // E o id tem de ser um UUID bem formado — fora do formato a API devolve
    // 400 `invalid_id_format`, que não prova credencial nenhuma.
    expect(url).toMatch(/\/charges\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('404 limpo é a resposta de SUCESSO: a chave foi aceita', async () => {
    const { r } = await ping(respostaFalsa(404, '{"error":"not_found"}'));
    expect(r.ok, 'cobrança inexistente com chave boa prova a credencial').toBe(true);
    expect(r.alcancou).toBe(true);
  });

  it('404 de ROTA inexistente não passa por credencial boa', async () => {
    // É o corpo que a API devolvia para a listagem. Se o endereço-base voltar
    // a ficar errado, o ping tem de acusar — e não dizer que está tudo bem.
    const { r } = await ping(
      respostaFalsa(404, '{"error":"not_found","message":"No v1 endpoint for GET /charges"}'),
    );
    expect(r.ok).toBe(false);
    expect(r.alcancou, 'a API respondeu — o problema não é de rede').toBe(true);
    expect(r.message).toMatch(/endereço/i);
  });

  it('401 continua sendo credencial recusada', async () => {
    const { r } = await ping(respostaFalsa(401, '{"error":"invalid_api_key"}'));
    expect(r.ok).toBe(false);
    expect(r.alcancou).toBe(true);
    expect(r.message).toMatch(/credencial/i);
  });

  it('404 em HTML é proxy ou portal, não credencial conferida', async () => {
    const { r } = await ping(respostaFalsa(404, '<html>404</html>', 'text/html'));
    expect(r.ok, 'sem JSON nenhuma credencial foi conferida').toBe(false);
  });

  it('200 continua valendo, se um dia a API passar a responder assim', async () => {
    const { r } = await ping(respostaFalsa(200, '{"id":"x","status":"pending"}'));
    expect(r.ok).toBe(true);
  });

  it('o ping continua sendo leitura — nunca cria cobrança', async () => {
    const provider = getPaymentProvider('sandra')!;
    const metodos: string[] = [];
    vi.stubGlobal('fetch', (_u: string, init?: RequestInit) => {
      metodos.push((init?.method ?? 'GET').toUpperCase());
      return Promise.resolve(respostaFalsa(404, '{"error":"not_found"}'));
    });
    await provider.ping!(gateway as never, creds as never);
    expect(metodos).toEqual(['GET']);
  });
});

describe('o 404 só vale como prova quando o provider diz que vale', () => {
  it('sem o predicado, 404 continua sendo falha', async () => {
    // A garantia genérica: tratar todo 404 como credencial boa faria um
    // endereço-base errado passar por saudável em qualquer gateway.
    const { pingHttp } = await import('../server/payments/providers/ping-http');
    vi.stubGlobal('fetch', () => Promise.resolve(respostaFalsa(404, '{"error":"not_found"}')));
    const r = await pingHttp('https://exemplo.com/x', {}, 'Teste');
    expect(r.ok).toBe(false);
  });
});

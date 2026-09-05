import { describe, it, expect, vi, afterEach, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  ALL_PROVIDERS,
  getPaymentProvider,
  listImplementedProviders,
} from '../server/payments/providers/registry';
import type { PaymentGateway, PaymentProvider } from '../server/payments/types';

/**
 * "Testar conexão" existia para e-mail, para os conectores de importação, para
 * os webhooks de saída e para a IA — e **não existia para pagamento**, que é o
 * único desses domínios em que credencial vencida custa dinheiro.
 *
 * O modo de falha não é hipotético: enquanto o `catch` do worker da Sandra era
 * vazio, credencial expirada fazia pagamento real deixar de virar matrícula em
 * silêncio, com o `/admin/jobs` dizendo que estava tudo rodando.
 *
 * Estes testes cobram as três coisas que fazem o botão valer alguma coisa: ele
 * existe para todo gateway com API, ele não cobra ninguém, e ele distingue "a
 * chave não vale" de "não deu para falar com o gateway".
 */

const creds = { apiKey: 'chave', apiSecret: 'segredo', webhookSecret: 'whsec' };

function gatewayDe(provider: PaymentProvider, options?: Record<string, unknown>): PaymentGateway {
  return {
    id: `gw-${provider}`,
    provider,
    displayName: provider,
    mode: 'test',
    active: true,
    apiKey: 'cifrada',
    options,
    createdAt: '',
    updatedAt: '',
  } as unknown as PaymentGateway;
}

/** Opções mínimas para o provider sair do chão. Só a Sandra exige alguma. */
const OPCOES: Partial<Record<PaymentProvider, Record<string, unknown>>> = {
  sandra: { baseUrl: 'https://app.sandra.com.vc', tenantSlug: 'pco' },
};

/**
 * O dublê precisa ter cabeçalho, e isso não é detalhe de arranjo.
 *
 * Enquanto ele não tinha, o teste não conseguia distinguir a API do gateway de
 * um portal de wi-fi respondendo 200 com HTML — que é exatamente o
 * falso-positivo que este recurso existe para não cometer. Dublê que mente
 * menos que o mundo real não pega defeito do mundo real.
 */
function respostaFalsa(status: number, corpo = '{}', tipo = 'application/json') {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (h: string) => (h.toLowerCase() === 'content-type' ? tipo : null) },
    text: async () => corpo,
    json: async () => JSON.parse(corpo),
  })) as unknown as typeof fetch;
}

type Chamadas = { mock: { calls: unknown[][] } };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('as duas listas de provider não podem divergir', () => {
  /**
   * O `it.each` abaixo percorre `ALL_PROVIDERS`, que é uma lista **mantida à
   * mão**, separada do `registry`. Provider acrescentado ao registry e
   * esquecido nela simplesmente não entra no laço — e a garantia anunciada no
   * CLAUDE.md ("provider novo sem ping falha a suíte") passaria a valer menos
   * do que a frase promete, sem que nada acusasse.
   */
  it('o que está no registry está em ALL_PROVIDERS, e vice-versa', () => {
    const naLista = ALL_PROVIDERS.filter((p) => p.implemented)
      .map((p) => p.id)
      .sort();
    expect(listImplementedProviders().sort()).toEqual(naLista);
  });
});

describe('todo gateway com API tem como ser testado', () => {
  /**
   * Provider novo que entre sem `ping` deixaria a tela sem botão exatamente
   * onde o dinheiro passa. Falhar aqui é o momento de escrever o ping.
   */
  it.each(ALL_PROVIDERS.filter((p) => p.implemented).map((p) => p.id))('%s expõe ping', (id) => {
    expect(typeof getPaymentProvider(id)?.ping).toBe('function');
  });
});

describe('testar não cobra ninguém', () => {
  it.each(ALL_PROVIDERS.filter((p) => p.implemented && p.id !== 'mock').map((p) => p.id))(
    '%s só lê',
    async (id) => {
      const f = respostaFalsa(200);
      vi.stubGlobal('fetch', f);
      await getPaymentProvider(id)!.ping!(gatewayDe(id, OPCOES[id]), creds);

      const calls = (f as unknown as Chamadas).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      for (const [url, init] of calls as Array<[string, RequestInit | undefined]>) {
        const metodo = (init?.method ?? 'GET').toUpperCase();
        if (id === 'paypal') {
          // Única exceção, e ela é a própria conferência da credencial: o
          // PayPal só responde qualquer coisa depois do client_credentials.
          // Não cria pedido nem cobrança.
          expect(url).toContain('/v1/oauth2/token');
        } else {
          expect(metodo).toBe('GET');
        }
      }
    },
  );

  it('o sandbox não sai falando com ninguém, e diz isso', async () => {
    const f = respostaFalsa(200);
    vi.stubGlobal('fetch', f);
    const r = await getPaymentProvider('mock')!.ping!(gatewayDe('mock'), creds);
    expect(r.ok).toBe(true);
    expect((f as unknown as Chamadas).mock.calls.length).toBe(0);
    expect(r.message).toMatch(/sandbox/i);
  });
});

describe('recusar a chave é diferente de não responder', () => {
  it('401 conta como gateway alcançado — o problema está no painel dele', async () => {
    vi.stubGlobal('fetch', respostaFalsa(401, '{"error":"invalid api key"}'));
    const r = await getPaymentProvider('stripe')!.ping!(gatewayDe('stripe'), creds);
    expect(r.ok).toBe(false);
    expect(r.alcancou).toBe(true);
    expect(r.message).toMatch(/credencial/i);
  });

  it('rede caída não é credencial recusada', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('getaddrinfo ENOTFOUND api.stripe.com');
      }),
    );
    const r = await getPaymentProvider('stripe')!.ping!(gatewayDe('stripe'), creds);
    expect(r.ok).toBe(false);
    expect(r.alcancou).toBe(false);
    expect(r.message).toMatch(/ENOTFOUND/);
  });

  it('200 é o único caso de sucesso', async () => {
    vi.stubGlobal('fetch', respostaFalsa(200, '{"data":[]}'));
    const r = await getPaymentProvider('stripe')!.ping!(gatewayDe('stripe'), creds);
    expect(r.ok).toBe(true);
    expect(r.alcancou).toBe(true);
  });

  it('200 com HTML não é credencial aceita — é portal de acesso no caminho', async () => {
    // O falso-positivo simétrico ao que o botão existe para evitar. Portal de
    // wi-fi, proxy corporativo e página de manutenção respondem 200 com HTML;
    // sem olhar o `content-type`, o card ficava verde sobre uma chave que
    // nunca foi conferida por ninguém.
    vi.stubGlobal('fetch', respostaFalsa(200, '<html>Faça login na rede</html>', 'text/html'));
    const r = await getPaymentProvider('stripe')!.ping!(gatewayDe('stripe'), creds);
    expect(r.ok).toBe(false);
    expect(r.alcancou).toBe(true);
    expect(r.message).toMatch(/não como API/i);
  });

  it('o corpo do gateway não atravessa para a mensagem guardada', async () => {
    // `lastTestMessage` é gravado no gateway, entra no despejo do banco e sobe
    // para um bucket S3 sem lifecycle — para sempre. Corpo de erro de gateway
    // traz id de conta, `request-id` e, em validação malformada, pedaço da
    // credencial. O lugar disso é o log, que tem rotação.
    const segredo = '{"error":"invalid key sk_live_ABC123","account":"acct_9","request_id":"req_7"}';
    vi.stubGlobal('fetch', respostaFalsa(422, segredo));
    const r = await getPaymentProvider('stripe')!.ping!(gatewayDe('stripe'), creds);
    expect(r.ok).toBe(false);
    expect(r.message).not.toMatch(/sk_live|acct_9|req_7/);
    expect(r.message).toMatch(/422/);
  });

  it('endereço apontado para dentro da rede não sai da máquina', async () => {
    // Só a Sandra monta a URL a partir de um campo do admin. `169.254.169.254`
    // é o serviço de metadados das nuvens: um GET autenticado para lá é
    // credencial de instância pedida em nome do servidor.
    const f = respostaFalsa(200);
    vi.stubGlobal('fetch', f);
    const r = await getPaymentProvider('sandra')!.ping!(
      gatewayDe('sandra', { baseUrl: 'http://169.254.169.254', tenantSlug: 'pco' }),
      creds,
    );
    expect(r.ok).toBe(false);
    expect(r.alcancou).toBe(false);
    expect(r.message).toMatch(/dentro da rede/i);
    expect((f as unknown as Chamadas).mock.calls.length).toBe(0);
  });

  it('configuração faltando não vira "o gateway recusou"', async () => {
    const f = respostaFalsa(200);
    vi.stubGlobal('fetch', f);
    // Sandra sem baseUrl/tenantSlug: o erro é nosso, e a tela tem de dizer isso
    // em vez de mandar o admin conferir a chave no painel da Sandra.
    const r = await getPaymentProvider('sandra')!.ping!(gatewayDe('sandra'), creds);
    expect(r.ok).toBe(false);
    expect(r.alcancou).toBe(false);
    expect(r.message).toMatch(/baseUrl/);
    expect((f as unknown as Chamadas).mock.calls.length).toBe(0);
  });
});

describe('pingGateway grava o resultado no gateway', () => {
  let tmpDir: string;
  let repo: typeof import('../server/payments/gateways-repo');
  let ping: typeof import('../server/payments/ping');

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-gwping-'));
    process.env.DATA_DIR = tmpDir;
    process.env.AVA_ENCRYPTION_KEY = 'a'.repeat(64);
    repo = await import('../server/payments/gateways-repo');
    ping = await import('../server/payments/ping');
  });

  afterAll(async () => {
    if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('carimba o último teste, para a tela dizer o estado sem testar de novo', async () => {
    const g = await repo.createGateway({
      provider: 'mock',
      displayName: 'Sandbox',
      mode: 'test',
      apiKey: 'x',
    });
    const r = await ping.pingGateway(g.id);
    expect(r?.ok).toBe(true);
    expect(r?.registrado).toBe(true);

    const salvo = (await repo.listAll()).find((x) => x.id === g.id);
    expect(salvo?.lastTestStatus).toBe('ok');
    expect(salvo?.lastTestMessage).toBe(r?.message);
    expect(salvo?.lastTestedAt).toBeTruthy();
  });

  it('gateway sem API não devolve "OK" de mentira', async () => {
    // `manual` e `legado-wp` registram venda que aconteceu fora do sistema.
    // Não há o que consultar — e dizer que está tudo bem seria o pior recado.
    const g = await repo.createGateway({
      provider: 'manual',
      displayName: 'Lançamento manual',
      mode: 'live',
      apiKey: '',
    });
    const r = await ping.pingGateway(g.id);
    expect(r?.ok).toBe(false);
    expect(r?.message).toMatch(/fora do sistema/);
  });

  it('chave-mestra girada vira teste falho gravado, não 500 sem registro', async () => {
    // `decryptApiKey` estoura em quatro casos, e o mais provável deles é este:
    // `AI_KEY_ENCRYPTION_SECRET` girado sem regravar as credenciais. Enquanto
    // a leitura da credencial ficava fora do `try`, isso virava 500 genérico
    // pelo `app.onError` **sem gravar nada** — e o card seguia mostrando o
    // último teste bem-sucedido, que é a leitura mais errada possível de um
    // gateway que parou de funcionar.
    const anterior = process.env.AI_KEY_ENCRYPTION_SECRET;
    process.env.AI_KEY_ENCRYPTION_SECRET = 'a'.repeat(64);
    const g = await repo.createGateway({
      provider: 'stripe',
      displayName: 'Stripe',
      mode: 'test',
      apiKey: 'sk_test_123',
    });
    process.env.AI_KEY_ENCRYPTION_SECRET = 'b'.repeat(64); // a chave girou

    const r = await ping.pingGateway(g.id);
    expect(r?.ok).toBe(false);
    expect(r?.registrado).toBe(true);

    const salvo = (await repo.listAll()).find((x) => x.id === g.id);
    expect(salvo?.lastTestStatus).toBe('error');

    if (anterior === undefined) delete process.env.AI_KEY_ENCRYPTION_SECRET;
    else process.env.AI_KEY_ENCRYPTION_SECRET = anterior;
  });

  it('gateway inexistente é 404, não erro', async () => {
    expect(await ping.pingGateway('gw-nao-existe')).toBeNull();
  });
});

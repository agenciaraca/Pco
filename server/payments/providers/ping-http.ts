// Um GET barato que prova que o gateway responde e ainda aceita a credencial.
//
// Quatro regras que qualquer ping daqui tem de respeitar:
//
// - **Nunca cobra ninguém.** Testar conexão não pode criar cobrança, nem no
//   modo `live` nem no `test`. Todo ping é leitura.
// - **Lê o mesmo recurso que o checkout escreve.** Chave que enxerga pedido é
//   chave que consegue criar pedido; o contrário não vale para chave restrita,
//   e um ping que consulta outro recurso pode dizer "OK" para uma credencial
//   que não consegue vender.
// - **2xx não basta.** Ver `pareceApi()`, abaixo.
// - **Corpo de terceiro não é persistido.** Ver `guardarNoLog()`, abaixo.
//
// E uma quinta, sobre o que o sucesso **não** prova: credencial aceita não é
// conta apta a cobrar. A do Pagar.me respondia `ok` durante os dias em que
// recusava toda venda por não ter o produto Checkout habilitado — o ping lê a
// credencial, e produto não habilitado só aparece na cobrança real. Por isso a
// mensagem de sucesso fala de credencial e nada além dela; a ressalva inteira
// está na tela, uma vez, em vez de gravada em cada gateway.

import type { PingResult } from './types';

/** Tempo esgotado é resposta: sem isto o botão de teste ficaria pendurado. */
const TIMEOUT_MS = 10_000;

/**
 * Endereços que um gateway de pagamento nunca tem.
 *
 * Só a Sandra monta a URL a partir de `options.baseUrl`, que é campo de
 * formulário do admin. Sem esta trava, `baseUrl` apontado para dentro faz o
 * **servidor** emitir um GET autenticado para a rede interna — e o alvo
 * clássico é `169.254.169.254`, o serviço de metadados das nuvens, onde moram
 * credenciais de instância.
 *
 * A conferência é sintática, sobre o literal. Nome de DNS que resolva para
 * dentro continua passando: pegar isso exigiria resolver o nome aqui e de novo
 * no `fetch`, com a janela entre as duas. O que se fecha é o caminho direto,
 * que é o que se digita.
 */
function enderecoInterno(u: URL): boolean {
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal')) return true;
  if (h === '::1' || h === '0.0.0.0' || h.startsWith('fe80:') || /^f[cd][0-9a-f]{2}:/.test(h))
    return true;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!v4) return false;
  const [a, b] = [Number(v4[1]), Number(v4[2])];
  return (
    a === 127 || // loopback
    a === 10 || // privado
    (a === 172 && b >= 16 && b <= 31) || // privado
    (a === 192 && b === 168) || // privado
    (a === 169 && b === 254) || // link-local — metadados de nuvem
    a === 0
  );
}

/**
 * O corpo da resposta fica no log, nunca no gateway.
 *
 * `lastTestMessage` é gravado no store, entra no despejo do banco e sobe para
 * um bucket S3 **sem lifecycle** — ou seja, para sempre. Corpo de erro de
 * gateway costuma trazer id de conta e `request-id`, e há provedores que ecoam
 * fragmento da credencial em validação malformada. Nada disso precisa
 * atravessar para o card do admin: para decidir o que fazer bastam o rótulo e
 * o status. O diagnóstico fino pertence ao log, que tem rotação.
 */
function guardarNoLog(rotulo: string, status: number, corpo: string): void {
  const limpo = corpo.slice(0, 500).replace(/\s+/g, ' ').trim();
  if (limpo) console.error(`[gateway-ping] ${rotulo} HTTP ${status}: ${limpo}`);
}

/**
 * 200 não prova que se falou com a API.
 *
 * Portal de acesso de wi-fi, proxy corporativo e página de manutenção
 * respondem 200 com HTML — e o teste diria "credencial aceita" sem nunca ter
 * alcançado o gateway. É o falso-positivo simétrico ao que este recurso existe
 * para evitar: um card verde sobre uma chave que não vende.
 *
 * Todas as APIs consultadas aqui respondem JSON.
 */
function pareceApi(tipo: string): boolean {
  return /\bjson\b/i.test(tipo);
}

/** O `content-type` também é texto de terceiro: só o mime, e curto. */
function mime(tipo: string): string {
  const so = tipo.split(';')[0].trim().toLowerCase().slice(0, 40);
  return /^[a-z0-9/+.-]*$/.test(so) && so ? so : 'desconhecido';
}

export interface OpcoesDePing {
  /**
   * Decide se um **404 prova que a credencial vale**.
   *
   * Existe porque nem toda API oferece listagem do recurso que o checkout
   * escreve. A da Sandra não: `GET /charges` responde
   * `{"error":"not_found","message":"No v1 endpoint for GET /charges"}` — a
   * rota de listar não existe. O que ela oferece é `GET /charges/:id`, e
   * consultar um id que sabidamente não existe é ler o MESMO recurso que o
   * checkout escreve, que é a regra deste arquivo.
   *
   * Nesse desenho, 404 é a resposta de sucesso: a chave foi aceita, a rota
   * existe, o recurso é que não. Quem sabe distinguir isso de "a rota não
   * existe" é o provider, que conhece o formato de erro da sua API — por isso
   * o predicado vem de fora e este arquivo não aprende nada sobre a Sandra.
   *
   * **Sem o predicado, 404 continua sendo falha.** Tratar todo 404 como prova
   * de credencial faria um endereço-base errado passar por saudável, que é
   * exatamente o defeito que este ping existe para pegar.
   */
  recursoAusenteProvaCredencial?: (corpo: string) => boolean;
}

export async function pingHttp(
  url: string,
  init: RequestInit,
  rotulo: string,
  opcoes: OpcoesDePing = {},
): Promise<PingResult> {
  let alvo: URL;
  try {
    alvo = new URL(url);
  } catch {
    return { ok: false, alcancou: false, message: `${rotulo}: endereço inválido nas opções.` };
  }
  if (alvo.protocol !== 'https:' && alvo.protocol !== 'http:') {
    return {
      ok: false,
      alcancou: false,
      message: `${rotulo}: endereço precisa ser http ou https.`,
    };
  }
  if (enderecoInterno(alvo)) {
    return {
      ok: false,
      alcancou: false,
      message: `${rotulo}: o endereço configurado aponta para dentro da rede, e não para o gateway.`,
    };
  }

  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    // Nem chegou a falar com o gateway: DNS, TLS, rede caída ou tempo esgotado.
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, alcancou: false, message: `${rotulo}: não deu para falar (${msg}).` };
  }

  const tipo = res.headers?.get?.('content-type') ?? '';

  if (res.ok) {
    if (!pareceApi(tipo)) {
      guardarNoLog(rotulo, res.status, await res.text().catch(() => ''));
      return {
        ok: false,
        alcancou: true,
        message:
          `${rotulo} respondeu HTTP ${res.status}, mas não como API (${mime(tipo)}). ` +
          'Portal de acesso, proxy ou página de manutenção respondem assim — a credencial não foi conferida.',
      };
    }
    return { ok: true, alcancou: true, message: `${rotulo} aceitou a credencial.` };
  }

  if (res.status === 404 && opcoes.recursoAusenteProvaCredencial) {
    const corpo = await res.text().catch(() => '');
    // O `content-type` continua valendo: um 404 em HTML é proxy ou página de
    // manutenção, e ali nenhuma credencial foi conferida.
    if (pareceApi(tipo) && opcoes.recursoAusenteProvaCredencial(corpo)) {
      return { ok: true, alcancou: true, message: `${rotulo} aceitou a credencial.` };
    }
    guardarNoLog(rotulo, res.status, corpo);
    return {
      ok: false,
      alcancou: true,
      message:
        `${rotulo} respondeu HTTP 404 de um jeito que não prova a credencial — ` +
        'provavelmente o endereço configurado está errado. O corpo está no log do servidor.',
    };
  }

  if (res.status === 401 || res.status === 403) {
    guardarNoLog(rotulo, res.status, await res.text().catch(() => ''));
    return {
      ok: false,
      alcancou: true,
      message:
        `${rotulo} recusou a credencial (HTTP ${res.status}). ` +
        'Confira a chave e se o modo (test/live) bate com ela.',
    };
  }

  guardarNoLog(rotulo, res.status, await res.text().catch(() => ''));
  return {
    ok: false,
    alcancou: true,
    message: `${rotulo} respondeu HTTP ${res.status}. O corpo da resposta está no log do servidor.`,
  };
}

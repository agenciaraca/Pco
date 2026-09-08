/**
 * Consulta de CEP para o checkout — pela nossa rota, nunca pelo navegador.
 *
 * O formulário público pede CEP, logradouro, número, bairro, cidade e UF
 * (`shared/endereco.ts`), e o Asaas recusa boleto sem CEP e sem número. Pedir
 * seis campos a quem está com o cartão na mão é onde a compra morre; com o
 * preenchimento pelo CEP sobram dois — o número e, se houver, o complemento.
 *
 * **Por que a consulta sai daqui e não do navegador de quem compra:**
 *
 * - **O IP e o CEP do visitante não vão para terceiro nenhum.** Quem fala com
 *   os Correios é o servidor. (A CSP deste site emite `connect-src 'self'
 *   https:`, então um `fetch` direto do navegador *passaria* — o motivo é
 *   privacidade, não bloqueio. Escrever "a CSP impede" seria confortável e
 *   falso.)
 * - **O cache é nosso.** CEP repetido não vira requisição externa nenhuma, e
 *   uma pessoa que corrige o número do CEP três vezes custa três consultas de
 *   memória.
 * - **A queda do terceiro é nossa para tratar.** Do lado do navegador, ela
 *   apareceria como erro de rede no console de quem está comprando.
 *
 * **A regra que este arquivo existe para respeitar:** não achar e não
 * conseguir olhar são coisas diferentes. É o mesmo defeito que a vitrine
 * tinha (`server/public/falhas-de-leitura.ts`), num lugar em que ele custaria
 * a venda: dizer "CEP não encontrado" para quem digitou o CEP certo, porque o
 * ViaCEP estava fora do ar por dez segundos, manda a pessoa conferir um dado
 * que está correto.
 */

import { apenasDigitos, cepValido, ufValida, type UF } from '../../shared/endereco';

export interface EnderecoDoCep {
  /** Só os oito dígitos — a formatação é da tela. */
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: UF;
}

export type ResultadoCep =
  | { estado: 'achado'; endereco: EnderecoDoCep }
  /** Oito dígitos é tudo que dá para afirmar sem rede; ver `cepValido`. */
  | { estado: 'invalido' }
  /** Os Correios responderam, e disseram que este CEP não existe. */
  | { estado: 'inexistente' }
  /** Não deu para perguntar. **Nunca** deve ser apresentado como 'inexistente'. */
  | { estado: 'indisponivel'; motivo: string };

const ORIGEM = 'https://viacep.com.br/ws';

/**
 * Três segundos, e não os dez do ping de gateway.
 *
 * Do outro lado há uma pessoa parada no meio do checkout. Passado esse tempo,
 * o certo é devolver o teclado para ela — digitar o endereço custa vinte
 * segundos, e esperar um terceiro que talvez não responda custa a compra.
 */
const TIMEOUT_MS = 3_000;

/** CEP muda pouco; um dia é curto o bastante para logradouro novo aparecer. */
const TTL_ACHADO_MS = 24 * 60 * 60_000;

/**
 * "Não existe" também vale a pena guardar — é o que um dedo errado produz, e
 * repetir a pergunta não muda a resposta. Uma hora, e não um dia, porque CEP
 * novo é criado o tempo todo e este é o lado em que errar atrapalha alguém.
 */
const TTL_INEXISTENTE_MS = 60 * 60_000;

/** Teto de memória. O `Map` guarda ordem de inserção, então o mais velho sai. */
const MAX_ENTRADAS = 5_000;

type EmCache = { resultado: ResultadoCep; ate: number };
const cache = new Map<string, EmCache>();

/** Só para teste: nenhum caminho de produção esvazia o cache. */
export function limparCacheDeCep(): void {
  cache.clear();
}

function guardar(cep: string, resultado: ResultadoCep, ttl: number): void {
  cache.set(cep, { resultado, ate: Date.now() + ttl });
  while (cache.size > MAX_ENTRADAS) {
    const maisVelho = cache.keys().next();
    if (maisVelho.done) break;
    cache.delete(maisVelho.value);
  }
}

/**
 * Texto de terceiro: aparado e curto.
 *
 * Vai direto para dentro de um `<input>` do checkout e daí para o cadastro do
 * gateway, que tem limite de tamanho nos seus campos.
 */
function texto(v: unknown, max = 120): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

/**
 * Consulta um CEP. Não lança: toda falha vira `indisponivel` com o motivo.
 *
 * `logradouro` e `bairro` podem voltar vazios de propósito — é o caso do CEP
 * único de cidade pequena e do CEP de faixa. A pessoa completa; o que não pode
 * é o campo ser preenchido com string vazia por cima do que ela já digitou.
 */
export async function consultarCep(entrada: string): Promise<ResultadoCep> {
  const cep = apenasDigitos(entrada ?? '');
  if (!cepValido(cep)) return { estado: 'invalido' };

  const guardado = cache.get(cep);
  if (guardado && guardado.ate > Date.now()) return guardado.resultado;
  if (guardado) cache.delete(cep);

  let res: Response;
  try {
    res = await fetch(`${ORIGEM}/${cep}/json/`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    return { estado: 'indisponivel', motivo: err instanceof Error ? err.message : String(err) };
  }

  if (!res.ok) return { estado: 'indisponivel', motivo: `HTTP ${res.status}` };

  let corpo: Record<string, unknown>;
  try {
    corpo = (await res.json()) as Record<string, unknown>;
  } catch {
    // Portal de wi-fi e página de manutenção respondem 200 com HTML — mesma
    // armadilha do ping de gateway. Isso não é "CEP não existe".
    return { estado: 'indisponivel', motivo: 'resposta não era JSON' };
  }

  // O ViaCEP marca inexistência com `erro`, que já veio como booleano `true` e
  // como a string `"true"` conforme a versão. Qualquer valor verdadeiro serve.
  if (corpo && corpo.erro) {
    const r: ResultadoCep = { estado: 'inexistente' };
    guardar(cep, r, TTL_INEXISTENTE_MS);
    return r;
  }

  const uf = texto(corpo?.uf, 2).toUpperCase();
  const cidade = texto(corpo?.localidade);
  // Resposta 200 sem UF e sem cidade não é um endereço — e não é uma negativa.
  // Inventar 'inexistente' aqui faria a tela mandar a pessoa conferir um CEP
  // que pode estar certo.
  if (!ufValida(uf) || !cidade) {
    return { estado: 'indisponivel', motivo: 'resposta sem cidade ou UF' };
  }

  const r: ResultadoCep = {
    estado: 'achado',
    endereco: {
      cep,
      logradouro: texto(corpo?.logradouro),
      bairro: texto(corpo?.bairro),
      cidade,
      uf,
    },
  };
  guardar(cep, r, TTL_ACHADO_MS);
  return r;
}

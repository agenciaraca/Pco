/**
 * Queda de conexão com o banco não pode custar o chamado do aluno.
 *
 * Medido no log de produção em 7/set/2026, com 7 quedas de conexão no período:
 * **10 `insert into support_tickets` falharam** — aluno escreveu o chamado,
 * clicou em enviar e levou erro —, **21 leituras do site público** falharam
 * (cursos, posts, certificados), e a primeira linha do log é um
 * `[auto-issue cert] erro ao verificar`: **certificado que não foi emitido**.
 * As mensagens são `Connection terminated unexpectedly` e `read ETIMEDOUT`, a
 * assinatura de uma conexão TCP de longa distância derrubada no meio — o banco
 * (DivZ) é remoto, e não há nada de errado com a consulta.
 *
 * Nada disso tinha retentativa. Uma queda de rede de um segundo virava erro na
 * cara de quem estava usando.
 *
 * ## A regra, e ela é a mesma do fallback de pagamento
 *
 * `server/payments/providers/criou-cobranca.ts` já enfrentou esta pergunta:
 * quando um erro prova que **nada aconteceu**? Ali, `!res.ok` não provava que a
 * cobrança não fora criada, e repetir gerava cobrança dobrada. Aqui é idêntico:
 *
 * - **Leitura repete sempre.** `SELECT` não tem efeito; no pior caso se lê duas
 *   vezes.
 * - **Escrita só repete quando é certo que a consulta NÃO SAIU.** A conexão
 *   morta *durante* um `INSERT` pode ter deixado o commit gravado do outro
 *   lado, e a resposta é que se perdeu — repetir criaria a segunda linha. Só as
 *   falhas de **aquisição** de conexão provam que nada foi enviado, porque
 *   nelas a consulta nunca chegou a existir.
 *
 * Errar para o lado de não repetir custa uma mensagem de erro que a pessoa
 * repete à mão. Errar para o outro lado cria chamado em duplicata, certificado
 * em duplicata, matrícula em duplicata — e ninguém vai atrás do que não deu
 * erro.
 *
 * ## O que este módulo NÃO alcança, de propósito
 *
 * Só o `query` do **pool**. Transação abre um `PoolClient` dedicado
 * (`pool.connect()`), e repetir um comando solto dentro de uma transação já
 * abortada não recupera nada — no Postgres, um comando que falha aborta a
 * transação inteira. Quem cuida disso é o `savepoint` do restaurador.
 */
import type pg from 'pg';

/** SQLSTATE de conexão perdida ou encerrada pelo servidor. */
const ESTADOS_DE_CONEXAO = new Set([
  '08000', // connection_exception
  '08003', // connection_does_not_exist
  '08006', // connection_failure
  '57P01', // admin_shutdown
  '57P02', // crash_shutdown
  '57P03', // cannot_connect_now
]);

/** Erros de socket: a rede caiu, não o banco. */
const CODIGOS_DE_REDE = new Set(['ECONNRESET', 'ETIMEDOUT', 'EPIPE', 'ENOTFOUND', 'EHOSTUNREACH']);

/**
 * Frases do `pg-pool` que só acontecem ANTES de a consulta ser enviada.
 *
 * São as únicas que autorizam repetir uma escrita: nelas não houve consulta —
 * o pool não conseguiu sequer entregar uma conexão.
 */
const FALHAS_DE_AQUISICAO = [
  'timeout exceeded when trying to connect',
  'connection terminated due to connection timeout',
  'called end on pool more than once',
];

function mensagem(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).toLowerCase();
}

function codigo(err: unknown): string | null {
  const c = (err as { code?: unknown } | null)?.code;
  return typeof c === 'string' ? c : null;
}

/** O erro é de conexão (e não da consulta em si)? */
export function ehFalhaDeConexao(err: unknown): boolean {
  const c = codigo(err);
  if (c && (CODIGOS_DE_REDE.has(c) || ESTADOS_DE_CONEXAO.has(c))) return true;
  const m = mensagem(err);
  return (
    m.includes('connection terminated') ||
    m.includes('connection ended') ||
    m.includes('server closed the connection') ||
    m.includes('timeout exceeded when trying to connect') ||
    m.includes('read etimedout')
  );
}

/** A falha prova que a consulta nunca saiu? */
export function nadaFoiEnviado(err: unknown): boolean {
  const m = mensagem(err);
  return FALHAS_DE_AQUISICAO.some((f) => m.includes(f));
}

/**
 * `SELECT` puro. Deliberadamente estrito: `WITH` fica de fora porque uma CTE
 * pode terminar em `INSERT ... RETURNING`, e o custo de errar aqui é gravar
 * duas vezes.
 */
export function ehLeitura(sql: string): boolean {
  return /^\s*select\b/i.test(sql);
}

export function podeRepetir(sql: string, err: unknown): boolean {
  if (!ehFalhaDeConexao(err)) return false;
  return ehLeitura(sql) || nadaFoiEnviado(err);
}

/** Espera curta e crescente: 120ms, 360ms. Queda de rede passa nessa escala. */
const ESPERAS_MS = [120, 360];

function textoDaConsulta(primeiro: unknown): string {
  if (typeof primeiro === 'string') return primeiro;
  const t = (primeiro as { text?: unknown } | null)?.text;
  return typeof t === 'string' ? t : '';
}

/**
 * Instala a retentativa no `query` do pool. Idempotente.
 *
 * Mexe no método em vez de embrulhar o objeto porque o Drizzle recebe o pool e
 * chama `client.query(...)` direto — um `Proxy` funcionaria, e um método
 * trocado é menos superfície para o driver estranhar.
 */
export function instalarRetry(pool: pg.Pool): pg.Pool {
  const alvo = pool as pg.Pool & { __retryInstalado?: boolean };
  if (alvo.__retryInstalado) return pool;
  alvo.__retryInstalado = true;

  const original = pool.query.bind(pool);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pool as any).query = function (...args: any[]) {
    // Forma com callback: o chamador não espera promessa, e embrulhar isso
    // mudaria o contrato. Passa direto.
    if (typeof args[args.length - 1] === 'function') {
       
      return (original as any)(...args);
    }
    const sql = textoDaConsulta(args[0]);
    const tentar = async (indice: number): Promise<unknown> => {
      try {
         
        return await (original as any)(...args);
      } catch (err) {
        if (indice >= ESPERAS_MS.length || !podeRepetir(sql, err)) throw err;
         
        console.warn(
          `[db] conexão caiu, repetindo (${indice + 1}/${ESPERAS_MS.length}): ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        await new Promise((r) => setTimeout(r, ESPERAS_MS[indice]));
        return await tentar(indice + 1);
      }
    };
    return tentar(0);
  };

  return pool;
}

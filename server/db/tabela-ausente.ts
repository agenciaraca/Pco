/**
 * Tabela que ainda não existe no banco cai no JSON, em vez de derrubar a rota.
 *
 * ## O problema que isto resolve
 *
 * A casa inteira é "dois backends, uma superfície": com `DATABASE_URL` os
 * repositórios leem Postgres, sem ela leem `data/*.json`. Mas o molde de
 * `courses.ts` — copiado por todos — decide pela **presença da variável**, não
 * pela existência da tabela:
 *
 * ```ts
 * const db = getDb();
 * if (db) {
 *   const rows = await db.select().from(schema.x);  // estoura se a tabela não existe
 *   if (rows.length > 0) return rows.map(...);
 * }
 * return await store.getAll();
 * ```
 *
 * Enquanto migração e deploy andam juntos isso nunca aparece. Em 27/ago/2026
 * apareceu: produção estava 43 commits atrás, com cinco tabelas pendentes
 * (`analytics_daily`, `payment_coupons`, `payment_orders`, `question_bank`,
 * `session_bookings`), e o usuário da aplicação (`pco_lms_app`) **não tem
 * permissão de DDL** — quem cria tabela é `pco_lms_owner`, por outro caminho.
 *
 * Sem este arquivo, subir o código novo faria cupom, pedido, agendamento,
 * banco de questões e medição estourarem na primeira leitura.
 *
 * ## A decisão
 *
 * Tabela ausente é tratada como "este backend não tem isto" — exatamente o que
 * já significa não ter `DATABASE_URL`. O JSON assume, o serviço continua de pé,
 * e um aviso sai **uma vez** por tabela para que ninguém descubra por acaso.
 *
 * Não é para esconder migração esquecida: é para que a ordem entre migrar e
 * publicar deixe de decidir se o site fica no ar. Rodada a migração, a tabela
 * passa a ser usada no próximo boot.
 *
 * Segue o precedente de `metaColumnAvailable` em `courses.ts`, que já fazia
 * isto para uma **coluna** ausente — inclusive na parte de que a flag só volta
 * a `true` com processo novo.
 */

import { sql } from 'drizzle-orm';
import { getDb, type DB } from './client';

/**
 * O que já foi perguntado ao banco: nome da tabela -> existe?
 *
 * Uma consulta por tabela por processo. Igual à flag `metaColumnAvailable` de
 * `courses.ts`, o valor só é reavaliado com processo novo — depois de rodar a
 * migração, é preciso reiniciar para a tabela passar a ser usada.
 */
const existencia = new Map<string, boolean>();

/**
 * `42P01` é o código do Postgres para "relation does not exist". O drizzle
 * embrulha o erro do driver, então a busca desce pela cadeia de `cause` — o
 * mesmo formato de `isMissingMetaColumn` em `courses.ts`.
 *
 * Continua exportado como rede de segurança: o teste de existência fecha o
 * caso comum, mas uma tabela removida entre a checagem e o uso cairia aqui.
 */
export function tabelaAusente(err: unknown): boolean {
  let atual: unknown = err;
  for (let nivel = 0; atual && nivel < 5; nivel++) {
    const e = atual as { code?: string; message?: string; cause?: unknown };
    const texto = `${e.code ?? ''} ${e.message ?? ''}`;
    if (e.code === '42P01' || /relation ".*" does not exist/i.test(texto)) return true;
    atual = e.cause;
  }
  return false;
}

/**
 * O banco, **ou `null` se esta tabela ainda não existe**.
 *
 * Devolver `null` é o ponto: o repositório já sabe lidar com isso — é o mesmo
 * que recebe quando não há `DATABASE_URL`, e o caminho do JSON assume sozinho.
 * Nenhum chamador precisa aprender um caso novo.
 *
 * Erro que não seja "tabela não existe" **sobe**: banco fora do ar ou permissão
 * negada não podem virar "usa o JSON e segue", que esconderia um problema real
 * atrás de dados desatualizados.
 */
export async function bancoSeTabelaExiste(tabela: string): Promise<DB | null> {
  const db = getDb();
  if (!db) return null;

  const lembrado = existencia.get(tabela);
  if (lembrado !== undefined) return lembrado ? db : null;

  const linhas = await db.execute(
    sql`select to_regclass(${`public.${tabela}`}) is not null as existe`,
  );
  const primeira = (linhas as unknown as { rows?: Array<{ existe: boolean }> }).rows?.[0] ?? {
    existe: false,
  };
  const existe = primeira.existe === true;
  existencia.set(tabela, existe);

  if (!existe) {
    // eslint-disable-next-line no-console
    console.warn(
      `[db] tabela \`${tabela}\` não existe — este recurso usa o arquivo JSON ` +
        'até a migração rodar. Rode `npm run db:migrate` (exige o role owner) e reinicie.',
    );
  }
  return existe ? db : null;
}

/** Só para os testes: esquece o que foi aprendido. */
export function _reset(): void {
  existencia.clear();
}

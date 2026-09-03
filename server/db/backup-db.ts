// Despejo lógico do Postgres para dentro da snapshot de backup.
//
// ## Por que este arquivo existe
//
// Até 3/set/2026 o `backup-worker` copiava **só `data/*.json`** — e em produção
// `DATABASE_URL` está definida desde sempre, `AUTH_STORE=db` desde 19/ago/2026.
// Ou seja: contas e credenciais, fichas de aluno, matrículas, pedidos,
// agendamentos, certificados e uso de IA vivem no Postgres, e **nenhum worker
// os copiava**. O `/admin/jobs` mostrava o backup verde, com contagem de
// arquivos e bytes, todos os dias — medindo a metade que não é a que importa.
//
// É o único achado da auditoria capaz de custar a base inteira, e o mais fácil
// de não perceber: o backup não estava quebrado, estava incompleto, e um
// backup incompleto tem exatamente a mesma aparência de um completo até o dia
// em que alguém precisa dele.
//
// ## Despejo lógico, não `pg_dump`
//
// `pg_dump` exigiria o binário no servidor, na versão compatível com o
// servidor de banco — dependência externa que falha silenciosamente e só
// aparece no dia do desastre. Aqui se usa a conexão que a aplicação já tem:
// uma linha por tabela, JSON, dentro da mesma pasta datada que o upload para
// S3 já varre. Sem binário novo, sem caminho de código novo no S3.
//
// O que isto **não** é: cópia física. Não guarda schema, índices, sequences
// nem permissões — a estrutura vem das migrations, que estão no git. Para
// restaurar: migrations primeiro, depois estas linhas.
//
// ## Segredo em repouso
//
// O despejo carrega hash de senha e as colunas cifradas (chaves de gateway,
// provedores de e-mail, segredos de webhook, sementes de TOTP). Hash é hash, e
// o que é cifrado é AES-GCM com chave derivada de `AI_KEY_ENCRYPTION_SECRET`,
// que **vive no ambiente e não entra no despejo** — então o arquivo sozinho não
// abre nada. Ainda assim é material sensível: a pasta de backup e o bucket
// merecem o mesmo cuidado do banco.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getDb, schema } from './client';

export interface DbDumpResult {
  /** Há banco configurado? Sem `DATABASE_URL` o despejo não se aplica. */
  enabled: boolean;
  tablesDumped: number;
  rowsTotal: number;
  bytesTotal: number;
  errors: string[];
  /**
   * O despejo cobriu **todas** as tabelas conhecidas?
   *
   * Existe separado de `errors.length === 0` de propósito: é este campo que a
   * tela de saúde lê para dizer "o banco está coberto", e ele tem de ser
   * falso também quando o despejo nem chegou a rodar.
   */
  completo: boolean;
}

/** As tabelas do schema, pelo nome que terão no arquivo. */
function tabelas(): Array<[string, unknown]> {
  return Object.entries(schema).filter(
    ([, valor]) =>
      typeof valor === 'object' &&
      valor !== null &&
      // Toda pgTable carrega este símbolo; enums e tipos auxiliares, não.
      Object.getOwnPropertySymbols(valor).some((s) => s.description === 'drizzle:Name'),
  );
}

/**
 * Despeja cada tabela em `<destDir>/db-<tabela>.json`.
 *
 * Uma tabela que falha **não** interrompe as outras — perder uma é ruim,
 * perder as vinte e quatro seguintes por causa dela é pior. Mas a falha
 * derruba `completo`, para que a tela não diga que o banco está salvo.
 */
export async function dumpDatabase(destDir: string): Promise<DbDumpResult> {
  const db = getDb();
  if (!db) {
    return { enabled: false, tablesDumped: 0, rowsTotal: 0, bytesTotal: 0, errors: [], completo: true };
  }

  const alvos = tabelas();
  const errors: string[] = [];
  let tablesDumped = 0;
  let rowsTotal = 0;
  let bytesTotal = 0;

  for (const [nome, tabela] of alvos) {
    try {
      const linhas = await db.select().from(tabela as never);
      const conteudo = JSON.stringify(linhas, null, 0);
      const arquivo = path.join(destDir, `db-${nome}.json`);
      await fs.writeFile(arquivo, conteudo, 'utf8');
      tablesDumped++;
      rowsTotal += linhas.length;
      bytesTotal += Buffer.byteLength(conteudo, 'utf8');
    } catch (err) {
      errors.push(`${nome}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    enabled: true,
    tablesDumped,
    rowsTotal,
    bytesTotal,
    errors,
    completo: errors.length === 0 && tablesDumped === alvos.length,
  };
}

/** Quantas tabelas o despejo espera cobrir. Usado pela tela de saúde. */
export function totalDeTabelas(): number {
  return tabelas().length;
}

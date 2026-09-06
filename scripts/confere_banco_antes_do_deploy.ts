/**
 * O banco está pronto para o código que vai subir?
 *
 * **Migration vem antes do código, sempre.** O Drizzle seleciona coluna a
 * coluna: app nova contra banco velho não degrada, quebra — toda consulta à
 * tabela em questão passa a dar erro. O `CLAUDE.md` registra isso duas vezes
 * (migrations `0017` e `0018`) porque duas vezes quase se inverteu a ordem.
 *
 * Este script só **lê**. Nenhum DDL, nenhuma escrita. Ele compara as colunas
 * que o schema declara com as que o banco tem, e diz o que falta — que é
 * exatamente a pergunta que se faz na hora de decidir se pode fazer o deploy.
 *
 * ```bash
 * npx tsx scripts/confere_banco_antes_do_deploy.ts
 * ```
 *
 * Sem `DATABASE_URL` ele diz isso e sai: modo JSON não tem banco para conferir.
 * E imprime o alvo mascarado antes de qualquer consulta, porque a máquina de
 * quem desenvolve tem `.env` apontando para produção — dois scripts de
 * manutenção já miraram na base errada por não olharem essa linha.
 */
import 'dotenv/config';
import { getTableColumns, getTableName, sql as raw } from 'drizzle-orm';
import { getDb, schema } from '../server/db/client';

type Tabela = { nome: string; colunas: Set<string> };

/** As tabelas que o schema declara, com o nome real de cada coluna. */
function tabelasDoSchema(): Tabela[] {
  const out: Tabela[] = [];
  for (const valor of Object.values(schema as Record<string, unknown>)) {
    // O símbolo interno do Drizzle é o que distingue uma tabela de um enum ou
    // de um índice exportado do mesmo arquivo. Se uma versão futura o
    // renomear, a lista vem vazia — daí a checagem de sanidade no fim.
    if (!valor || typeof valor !== 'object') continue;
    if (!Object.getOwnPropertySymbols(valor).some((s) => String(s).includes('drizzle:Name'))) {
      continue;
    }
    const t = valor as Parameters<typeof getTableColumns>[0];
    const colunas = new Set(Object.values(getTableColumns(t)).map((c) => c.name));
    out.push({ nome: getTableName(t), colunas });
  }
  return out;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log('Sem DATABASE_URL — modo JSON, não há banco para conferir.');
    return;
  }
  console.log('[db] alvo:', url.replace(/:\/\/[^@]*@/, '://***@'));

  const declaradas = tabelasDoSchema();
  if (declaradas.length < 20) {
    console.error(
      `Só encontrei ${declaradas.length} tabelas no schema — esperava mais de 20.\n` +
        'Provavelmente a detecção por símbolo do Drizzle parou de funcionar. ' +
        'Sem isto o script diria "tudo certo" sem ter conferido nada.',
    );
    process.exitCode = 1;
    return;
  }

  const db = getDb();
  if (!db) {
    console.error('DATABASE_URL definida e o cliente não conectou. Confira a string.');
    process.exitCode = 1;
    return;
  }
  {
    const r = await db.execute<{ table_name: string; column_name: string }>(raw`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
    `);
    const linhas = (r as unknown as { rows?: unknown[] }).rows ?? (r as unknown as unknown[]);
    const noBanco = new Map<string, Set<string>>();
    for (const l of linhas as Array<{ table_name: string; column_name: string }>) {
      if (!noBanco.has(l.table_name)) noBanco.set(l.table_name, new Set());
      noBanco.get(l.table_name)!.add(l.column_name);
    }

    const tabelasFaltando: string[] = [];
    const colunasFaltando: string[] = [];
    for (const t of declaradas) {
      const banco = noBanco.get(t.nome);
      if (!banco) {
        tabelasFaltando.push(t.nome);
        continue;
      }
      for (const c of t.colunas) if (!banco.has(c)) colunasFaltando.push(`${t.nome}.${c}`);
    }

    console.log(`\nTabelas no schema: ${declaradas.length} · no banco: ${noBanco.size}`);

    if (tabelasFaltando.length === 0 && colunasFaltando.length === 0) {
      console.log('\n✅ O banco tem tudo o que o código espera. Pode subir.');
      return;
    }

    console.log('\n⛔ NÃO suba o código antes de migrar. Falta:');
    for (const t of tabelasFaltando) console.log(`  tabela  ${t}`);
    for (const c of colunasFaltando) console.log(`  coluna  ${c}`);
    console.log(
      '\nRode a migration primeiro, com credencial de owner:\n' +
        '  DATABASE_URL=<owner> npx tsx server/db/migrate.ts',
    );
    process.exitCode = 1;
  }
}

void main();

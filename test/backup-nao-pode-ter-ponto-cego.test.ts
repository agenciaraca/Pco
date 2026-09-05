import { describe, it, expect } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { schema } from '../server/db/client';

/**
 * O despejo do banco percorre o **schema do Drizzle**, não o banco.
 *
 * `dumpDatabase` monta a lista de tabelas com `Object.entries(schema)` filtrado
 * pelo símbolo `drizzle:Name`. Isso quer dizer que uma tabela criada por
 * migration e **esquecida no `schema.ts`** existe no Postgres, recebe linhas,
 * aparece no `/admin` — e **não entra no backup**. Sem erro, sem aviso: o
 * relatório continua dizendo "banco salvo", contando as tabelas que ele
 * conhece.
 *
 * É a mesma forma do achado que criou `backup-db.ts`: o backup não estava
 * quebrado, estava incompleto, e incompleto é indistinguível de completo até o
 * dia em que alguém precisa dele.
 *
 * ## Por que comparar com as migrations, e não com o banco
 *
 * Comparar com o banco seria o ideal e é o que se mediu à mão em 5/set/2026
 * (25 tabelas no banco, 25 no schema, zero fora) — mas exige Postgres, e a
 * suíte roda sem banco. As migrations são a única descrição versionada da
 * estrutura real: é o `CREATE TABLE` delas que produz o banco. Se uma tabela
 * nasce lá e não existe aqui, o backup nasce cego.
 *
 * O teste anterior (`backup-cobre-o-banco`) cobra que o despejo aconteça e que
 * a tela não minta sobre ele. Este cobra outra coisa: que a **lista** de
 * tabelas esteja completa. `completo: tablesDumped === alvos.length` é
 * verdadeiro mesmo quando `alvos` está faltando uma tabela inteira.
 */

/** O nome que a tabela tem no Postgres, como o despejo o descobre. */
function tabelasDoSchema(): string[] {
  const nomes: string[] = [];
  for (const valor of Object.values(schema) as unknown[]) {
    if (typeof valor !== 'object' || valor === null) continue;
    const simbolo = Object.getOwnPropertySymbols(valor).find(
      (s) => s.description === 'drizzle:Name',
    );
    // Enums e tipos auxiliares não carregam este símbolo — só `pgTable`.
    if (!simbolo) continue;
    nomes.push(String((valor as Record<symbol, unknown>)[simbolo]));
  }
  return nomes.sort();
}

async function tabelasDasMigrations(): Promise<string[]> {
  const dir = path.join(process.cwd(), 'server', 'db', 'migrations');
  const arquivos = (await fs.readdir(dir)).filter((f) => f.endsWith('.sql'));
  const nomes = new Set<string>();
  for (const f of arquivos) {
    const sql = await fs.readFile(path.join(dir, f), 'utf8');
    for (const m of sql.matchAll(/CREATE TABLE(?:\s+IF NOT EXISTS)?\s+"?([a-z_]+)"?/gi)) {
      nomes.add(m[1]!.toLowerCase());
    }
  }
  // Tabela de controle do próprio Drizzle: não é dado da escola.
  nomes.delete('__drizzle_migrations');
  return [...nomes].sort();
}

describe('toda tabela que existe no banco entra no backup', () => {
  it('nenhuma tabela criada por migration ficou fora do schema', async () => {
    const doSchema = new Set(tabelasDoSchema());
    const dasMigrations = await tabelasDasMigrations();
    const cegas = dasMigrations.filter((t) => !doSchema.has(t));

    expect(
      cegas,
      'estas tabelas são criadas por migration e NÃO estão no `schema.ts` — ' +
        'elas recebem dados em produção e o despejo do banco não as copia:\n  ' +
        cegas.join('\n  '),
    ).toEqual([]);
  });

  it('e a lista não está vazia — senão o teste passaria sem medir nada', async () => {
    // A guarda contra o próprio teste: se o regex de `CREATE TABLE` parar de
    // casar (formato novo do drizzle-kit, aspas diferentes), `cegas` fica vazio
    // por acidente e o caso acima vira decoração.
    const dasMigrations = await tabelasDasMigrations();
    expect(dasMigrations.length).toBeGreaterThan(20);
    expect(dasMigrations).toContain('enrollments');
    expect(dasMigrations).toContain('payment_orders');
  });

  it('o despejo enxerga o mesmo tanto de tabelas que o schema declara', async () => {
    const { totalDeTabelas } = await import('../server/db/backup-db');
    expect(totalDeTabelas()).toBe(tabelasDoSchema().length);
  });
});

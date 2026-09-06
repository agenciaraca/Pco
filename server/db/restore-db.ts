// O caminho de volta do despejo lógico.
//
// ## Por que isto faltava, e por que faltar era caro
//
// `backup-db.ts` existe desde 3/set/2026 e despeja uma linha por tabela em
// `db-<tabela>.json`. A auditoria de 4/set achou o outro lado: **não havia
// consumidor desses arquivos em lugar nenhum do repositório**. Nenhum script,
// nenhuma rota, nada. E `docs/deploy.md` ensinava a restaurar um `.tar.gz` que
// o worker não produz, parando o processo com `pkill` de algo que hoje é
// gerenciado por PM2.
//
// Três fontes — mensagem de commit, documentação e código — descrevendo três
// coisas diferentes, e nenhuma executável. Backup que ninguém sabe restaurar
// tem o mesmo problema de fundo do backup incompleto: parece saudável até o dia
// em que alguém precisa dele, e esse é o pior dia para descobrir.
//
// ## O que este módulo restaura, e o que ele NÃO restaura
//
// Restaura **linhas**. Não restaura schema, índices, sequences nem permissões —
// isso vem das migrations, que estão no git. A ordem é sempre:
//
//     migrations primeiro, linhas depois.
//
// ## Chave estrangeira sem saber a ordem das tabelas
//
// O despejo não guarda dependências. Descobri-las a partir do schema seria
// possível e frágil; o caminho usado aqui é mais simples e não depende de
// nenhum metadado: **várias passadas**. Apaga (e depois insere) o que der, e
// repete enquanto houver progresso. Uma tabela que falha por FK numa passada
// costuma passar na seguinte, quando a que ela referencia já foi tratada.
//
// Antes disso ele tenta o atalho — `session_replication_role = 'replica'`
// desliga os gatilhos de FK e torna a ordem irrelevante. Exige superusuário e
// normalmente **não** está disponível em banco gerenciado, então o laço é o
// caminho de verdade, não o plano B.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getTableColumns, sql } from 'drizzle-orm';
import { getDb, schema } from './client';

export interface TabelaRestaurada {
  tabela: string;
  linhasNoArquivo: number;
  linhasGravadas: number;
  erro?: string;
}

export interface RestoreResult {
  /** Houve `--commit`? Sem ele nada é gravado. */
  gravou: boolean;
  /** Arquivos `db-*.json` encontrados na pasta. */
  arquivosEncontrados: number;
  /** Arquivos cuja tabela não existe mais no schema. */
  desconhecidos: string[];
  /** Tabelas do schema que não têm arquivo na snapshot. */
  semArquivo: string[];
  tabelas: TabelaRestaurada[];
  /** Alguma tabela ficou por gravar? */
  completo: boolean;
}

type Tabela = { nome: string; objeto: unknown };

/** As tabelas do schema, pelo nome que têm no arquivo do despejo. */
function tabelasDoSchema(): Tabela[] {
  const out: Tabela[] = [];
  for (const valor of Object.values(schema) as unknown[]) {
    if (typeof valor !== 'object' || valor === null) continue;
    const s = Object.getOwnPropertySymbols(valor).find((x) => x.description === 'drizzle:Name');
    if (!s) continue;
    out.push({ nome: String((valor as Record<symbol, unknown>)[s]), objeto: valor });
  }
  return out;
}

/**
 * JSON não tem data — tem string.
 *
 * O despejo serializa `timestamptz` como ISO. Devolver a string crua faz o
 * driver tentar `.toISOString()` num texto e estourar. A conversão olha o tipo
 * declarado da coluna, não o formato do valor: adivinhar por regex
 * transformaria em data qualquer texto que se pareça com uma.
 */
function coagir(objeto: unknown, linha: Record<string, unknown>): Record<string, unknown> {
  const colunas = getTableColumns(objeto as never) as Record<string, { dataType?: string }>;
  const saida: Record<string, unknown> = {};
  for (const [prop, coluna] of Object.entries(colunas)) {
    if (!(prop in linha)) continue;
    const valor = linha[prop];
    if (coluna.dataType === 'date' && typeof valor === 'string') {
      const d = new Date(valor);
      saida[prop] = Number.isNaN(d.getTime()) ? null : d;
    } else {
      saida[prop] = valor;
    }
  }
  return saida;
}

const LOTE = 500;

/**
 * Restaura as linhas de uma snapshot para dentro do banco de `DATABASE_URL`.
 *
 * **Sem `commit: true` não grava nada** — devolve o mesmo relatório dizendo o
 * que faria. É a regra que este projeto já aprendeu duas vezes com script de
 * manutenção que mirou na base errada: ensaiar primeiro, e conferir a linha do
 * banco a que se conectou.
 */
export async function restoreDatabase(
  dir: string,
  opts: { commit?: boolean } = {},
): Promise<RestoreResult> {
  const db = getDb();
  if (!db) throw new Error('DATABASE_URL ausente — não há banco para restaurar.');

  const arquivos = (await fs.readdir(dir)).filter(
    (f) => f.startsWith('db-') && f.endsWith('.json'),
  );
  const doSchema = new Map(tabelasDoSchema().map((t) => [t.nome, t]));

  const desconhecidos: string[] = [];
  const pendentes: Array<{ tabela: Tabela; linhas: Record<string, unknown>[] }> = [];

  for (const arquivo of arquivos) {
    const nome = arquivo.slice(3, -5);
    const tabela = doSchema.get(nome);
    if (!tabela) {
      // Tabela removida do schema depois da snapshot. Restaurá-la às cegas
      // seria escrever numa tabela que o código não conhece mais.
      desconhecidos.push(nome);
      continue;
    }
    const bruto = await fs.readFile(path.join(dir, arquivo), 'utf8');
    const linhas = JSON.parse(bruto) as Record<string, unknown>[];
    pendentes.push({ tabela, linhas });
  }

  const semArquivo = [...doSchema.keys()].filter(
    (n) => !arquivos.includes(`db-${n}.json`),
  );

  const resultado: RestoreResult = {
    gravou: Boolean(opts.commit),
    arquivosEncontrados: arquivos.length,
    desconhecidos,
    semArquivo,
    tabelas: [],
    completo: false,
  };

  if (!opts.commit) {
    resultado.tabelas = pendentes.map((p) => ({
      tabela: p.tabela.nome,
      linhasNoArquivo: p.linhas.length,
      linhasGravadas: 0,
    }));
    resultado.completo = desconhecidos.length === 0;
    return resultado;
  }

  // Atalho: se o banco deixar, desliga os gatilhos de FK e a ordem some do
  // problema. Em banco gerenciado normalmente não deixa — daí o laço abaixo.
  let semGatilhos = false;
  try {
    await db.execute(sql`set session_replication_role = 'replica'`);
    semGatilhos = true;
  } catch {
    semGatilhos = false;
  }

  const feitas = new Set<string>();
  const erros = new Map<string, string>();

  // ---- apagar, em passadas ----
  let restantes = pendentes.map((p) => p.tabela);
  for (let passada = 0; passada < 6 && restantes.length > 0; passada++) {
    const falharam: Tabela[] = [];
    for (const t of restantes) {
      try {
        await db.delete(t.objeto as never);
      } catch (err) {
        erros.set(t.nome, err instanceof Error ? err.message : String(err));
        falharam.push(t);
      }
    }
    if (falharam.length === restantes.length) break; // sem progresso
    restantes = falharam;
  }

  // ---- inserir, em passadas ----
  let aInserir = [...pendentes];
  for (let passada = 0; passada < 6 && aInserir.length > 0; passada++) {
    const falharam: typeof aInserir = [];
    for (const item of aInserir) {
      try {
        for (let i = 0; i < item.linhas.length; i += LOTE) {
          const lote = item.linhas
            .slice(i, i + LOTE)
            .map((l) => coagir(item.tabela.objeto, l));
          if (lote.length > 0) await db.insert(item.tabela.objeto as never).values(lote as never);
        }
        feitas.add(item.tabela.nome);
        erros.delete(item.tabela.nome);
        resultado.tabelas.push({
          tabela: item.tabela.nome,
          linhasNoArquivo: item.linhas.length,
          linhasGravadas: item.linhas.length,
        });
      } catch (err) {
        erros.set(item.tabela.nome, err instanceof Error ? err.message : String(err));
        falharam.push(item);
      }
    }
    if (falharam.length === aInserir.length) break; // sem progresso
    aInserir = falharam;
  }

  for (const item of aInserir) {
    resultado.tabelas.push({
      tabela: item.tabela.nome,
      linhasNoArquivo: item.linhas.length,
      linhasGravadas: 0,
      erro: erros.get(item.tabela.nome) ?? 'não foi possível inserir',
    });
  }

  if (semGatilhos) {
    try {
      await db.execute(sql`set session_replication_role = 'origin'`);
    } catch {
      // Sessão termina junto com o processo; não vale derrubar a restauração
      // por causa da volta de um ajuste de sessão.
    }
  }

  resultado.completo =
    aInserir.length === 0 && desconhecidos.length === 0 && resultado.tabelas.every((t) => !t.erro);
  return resultado;
}

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
  /**
   * A transação foi desfeita e **nada** foi gravado.
   *
   * Restauração pela metade deixa o banco num estado que ninguém consegue
   * descrever de fora. Quando algo falha, desfazer devolve o operador ao ponto
   * de partida — com o relatório dizendo o que impediu.
   */
  desfeito?: boolean;
}

type Tabela = { nome: string; objeto: unknown };

/**
 * As tabelas do schema, por **todos** os nomes com que podem aparecer no
 * arquivo do despejo.
 *
 * Até 5/set/2026 o despejo nomeava os arquivos pelo **export** em camelCase
 * (`db-aiConfigurations.json`); hoje usa o nome da tabela
 * (`db-ai_configurations.json`). Snapshot antiga precisa continuar restaurável
 * — backup que só a versão nova do código consegue ler não é backup.
 */
function tabelasDoSchema(): Map<string, Tabela> {
  const porNome = new Map<string, Tabela>();
  for (const [exportName, valor] of Object.entries(schema) as Array<[string, unknown]>) {
    if (typeof valor !== 'object' || valor === null) continue;
    const s = Object.getOwnPropertySymbols(valor).find((x) => x.description === 'drizzle:Name');
    if (!s) continue;
    const nome = String((valor as Record<symbol, unknown>)[s]);
    const t: Tabela = { nome, objeto: valor };
    porNome.set(nome, t);
    porNome.set(exportName, t);
  }
  return porNome;
}

/** Só os nomes de tabela — é a lista que `semArquivo` compara. */
function nomesDeTabela(): string[] {
  return [...new Set([...tabelasDoSchema().values()].map((t) => t.nome))];
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
  const doSchema = tabelasDoSchema();

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

  // Uma tabela está coberta se veio por qualquer um dos dois nomes.
  const restauradas = new Set(pendentes.map((p) => p.tabela.nome));
  const semArquivo = nomesDeTabela().filter((n) => !restauradas.has(n));

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

  /*
    **Tudo ou nada, dentro de uma transação.**

    A primeira versão apagava todas as tabelas e só depois inseria, sem
    transação. Se a inserção falhasse — arquivo truncado, coerção de tipo, FK
    que não resolve em seis passadas — as tabelas já estavam vazias e não havia
    volta. O relatório marcava `completo: false`, o que é honesto e inútil: o
    dado já tinha saído.

    Isso importa mais aqui do que em qualquer outro lugar do sistema, porque
    este código roda **no dia do desastre**, quando o banco já está ruim e a
    snapshot é a única cópia. Um restaurador que pode piorar a situação é pior
    do que não ter restaurador, porque dá confiança para ser executado.

    ## Por que cada passo tem o seu savepoint

    No Postgres, um comando que falha **aborta a transação inteira**: todo
    comando seguinte responde `current transaction is aborted`. O laço de
    passadas — que é como este módulo resolve FK sem conhecer a ordem das
    tabelas — depende de tentar, falhar e tentar de novo. As duas coisas só
    convivem com savepoint por tentativa, que é o que `tx.transaction()` cria.
  */
  class RestauracaoIncompleta extends Error {}

  let semGatilhos = false;
  const feitas = new Set<string>();
  const erros = new Map<string, string>();
  let aInserir = [...pendentes];

  try {
    await db.transaction(async (tx) => {
      // Atalho: se o banco deixar, desliga os gatilhos de FK e a ordem some do
      // problema. Em banco gerenciado normalmente não deixa — daí o laço
      // abaixo. `set local` porque estamos numa transação: volta sozinho.
      try {
        await tx.execute(sql`set local session_replication_role = 'replica'`);
        semGatilhos = true;
      } catch {
        semGatilhos = false;
      }

      // ---- apagar, em passadas ----
      let restantes = pendentes.map((p) => p.tabela);
      for (let passada = 0; passada < 6 && restantes.length > 0; passada++) {
        const falharam: Tabela[] = [];
        for (const t of restantes) {
          try {
            // Savepoint: sem ele, a primeira FK que barrar mata a transação e
            // as passadas seguintes não teriam como rodar.
            await tx.transaction(async (sp) => {
              await sp.delete(t.objeto as never);
            });
          } catch (err) {
            erros.set(t.nome, err instanceof Error ? err.message : String(err));
            falharam.push(t);
          }
        }
        if (falharam.length === restantes.length) break; // sem progresso
        restantes = falharam;
      }

      // ---- inserir, em passadas ----
      for (let passada = 0; passada < 6 && aInserir.length > 0; passada++) {
        const falharam: typeof aInserir = [];
        for (const item of aInserir) {
          try {
            await tx.transaction(async (sp) => {
              for (let i = 0; i < item.linhas.length; i += LOTE) {
                const lote = item.linhas
                  .slice(i, i + LOTE)
                  .map((l) => coagir(item.tabela.objeto, l));
                if (lote.length > 0) {
                  await sp.insert(item.tabela.objeto as never).values(lote as never);
                }
              }
            });
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

      /*
        Restauração pela metade é o pior estado possível: o banco fica com
        parte das linhas velhas apagadas e parte das novas ausentes, e ninguém
        consegue dizer de fora qual metade é qual. Desfazer devolve o operador
        a um estado que ele conhece, com o relatório na mão dizendo o que
        impediu.
      */
      if (aInserir.length > 0 || resultado.tabelas.some((t) => t.erro)) {
        throw new RestauracaoIncompleta();
      }
    });
  } catch (err) {
    if (!(err instanceof RestauracaoIncompleta)) {
      // Falha inesperada (conexão caiu, por exemplo): a transação já desfez o
      // que tinha feito. Registrar e devolver o relatório é melhor do que
      // estourar sem dizer o que aconteceu.
      resultado.tabelas.push({
        tabela: '(transação)',
        linhasNoArquivo: 0,
        linhasGravadas: 0,
        erro: err instanceof Error ? err.message : String(err),
      });
    }
    // Nada foi gravado: o `gravou` do relatório mentiria dizendo que sim.
    resultado.gravou = false;
    resultado.desfeito = true;
    resultado.completo = false;
    return resultado;
  }

  void semGatilhos;
  resultado.completo =
    aInserir.length === 0 && desconhecidos.length === 0 && resultado.tabelas.every((t) => !t.erro);
  return resultado;
}

/**
 * Há quanto tempo o banco não é copiado — perguntado ao DISCO, não à memória.
 *
 * ## O buraco que isto fecha
 *
 * `backup-worker.getStatus()` só sabe o que aconteceu **nesta vida do
 * processo**. O worker faz a snapshot numa janela de uma hora (04:00 UTC), e o
 * processo de produção reinicia com frequência — 143 vezes até 9/set/2026. Em
 * quase todo momento do dia, portanto, `lastRunAt` é `null` e o status não tem
 * o que dizer.
 *
 * O disco tem. As snapshots ficam em `data/backups/<AAAA-MM-DD>/`, e as do
 * banco são os arquivos `db-*.json` dentro delas. Ler isso responde *"o banco
 * está copiado?"* logo depois de um restart, que é justamente quando a
 * pergunta aparece e a memória não sabe responder.
 *
 * ## Três coisas que qualquer mexida aqui tem de respeitar
 *
 * - **Não conseguir olhar não é "não há cópia".** Pasta ausente, permissão
 *   negada e disco fora do ar devolvem `null` com o motivo, nunca zero. É a
 *   mesma regra das telas de métrica deste projeto: zero diz *medi e não
 *   houve*, travessão diz *não medi* — e aqui a diferença decide se alguém sai
 *   correndo atrás de um backup que existe.
 * - **A idade sai da DATA no nome da pasta, não do mtime.** O mtime muda
 *   quando o worker apaga snapshots velhas ao lado, e a pergunta é de que dia
 *   é a cópia, não quando alguém encostou nela.
 * - **Contar arquivo não é conferir conteúdo.** O que se afirma é *"existem N
 *   arquivos de tabela nesta data"*. Que as N tabelas certas estejam lá é o
 *   que `backup-db` garante na escrita, com `completo`.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

function getDataDir(): string {
  return process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data');
}

const BACKUP_SUBDIR = 'backups';

export interface CopiaEmDisco {
  /** A data da pasta, `AAAA-MM-DD`. */
  data: string;
  /** Quantos arquivos `db-*.json` — isto é, tabelas despejadas. */
  tabelas: number;
  /** Quantos `*.json` de store (o backup do modo JSON). */
  arquivos: number;
  /** Dias inteiros entre a data da pasta e hoje. 0 = a de hoje. */
  idadeEmDias: number;
}

export interface EstadoDaCopia {
  /** A snapshot mais recente que contém despejo do banco. */
  banco: CopiaEmDisco | null;
  /** A snapshot mais recente, com banco ou sem. */
  qualquer: CopiaEmDisco | null;
  /**
   * Por que não deu para olhar. **`null` aqui com `banco: null` significa
   * "olhei e não há"**; preenchido significa "não consegui olhar", que é outra
   * conversa e outra ação de quem lê.
   */
  erro: string | null;
}

function diasEntre(dataIso: string, agora: Date): number {
  const [a, m, d] = dataIso.split('-').map(Number);
  // UTC dos dois lados: a pasta é nomeada em UTC pelo worker.
  const daPasta = Date.UTC(a!, m! - 1, d!);
  const hoje = Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate());
  return Math.round((hoje - daPasta) / 86_400_000);
}

/**
 * Varre as snapshots em disco e diz qual é a mais recente — e qual é a mais
 * recente que carrega o banco.
 *
 * Nunca lança: quem chama é painel de saúde, e um painel que cai porque não
 * conseguiu ler um diretório troca um problema pequeno por um maior.
 */
export async function copiaMaisRecente(agora: Date = new Date()): Promise<EstadoDaCopia> {
  const raiz = path.join(getDataDir(), BACKUP_SUBDIR);
  let entradas: string[];
  try {
    entradas = await fs.readdir(raiz);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { banco: null, qualquer: null, erro: `não deu para ler ${raiz}: ${msg}` };
  }

  // Só as pastas datadas. Os `.tar.gz` ao lado são de outro backup (um cron de
  // shell) e não carregam o banco — contá-los diria que há cópia do banco onde
  // não há.
  const datas = entradas.filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e)).sort().reverse();

  let banco: CopiaEmDisco | null = null;
  let qualquer: CopiaEmDisco | null = null;
  let erro: string | null = null;

  for (const data of datas) {
    let arquivos: string[];
    try {
      arquivos = await fs.readdir(path.join(raiz, data));
    } catch (err) {
      // Uma pasta ilegível não invalida as outras — mas fica registrado, para
      // o caso de a mais recente ser justamente ela.
      erro ??= `${data}: ${err instanceof Error ? err.message : String(err)}`;
      continue;
    }
    const tabelas = arquivos.filter((a) => a.startsWith('db-') && a.endsWith('.json')).length;
    const jsons = arquivos.filter((a) => a.endsWith('.json')).length;
    const item: CopiaEmDisco = {
      data,
      tabelas,
      arquivos: jsons - tabelas,
      idadeEmDias: diasEntre(data, agora),
    };
    qualquer ??= item;
    if (tabelas > 0) {
      banco = item;
      break;
    }
  }

  /*
    O erro sobrevive enquanto o BANCO não for encontrado.

    A primeira versão descartava o erro assim que qualquer pasta legível
    aparecesse (`banco || qualquer ? null : erro`), e isso reabria justamente o
    buraco que este arquivo existe para fechar: com a pasta mais recente
    ilegível e a anterior sem despejo, o resultado era `banco: null, erro:
    null` — que se lê como "olhei e não há cópia do banco". O painel então
    pinta vermelho e manda alguém atrás de um backup que pode estar ali, dentro
    da pasta que não deu para abrir.

    Achado o despejo, um erro numa pasta mais velha não muda o que se ia fazer,
    e reportá-lo seria ruído.
  */
  return { banco, qualquer, erro: banco ? null : erro };
}

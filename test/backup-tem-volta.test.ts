import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * ARCH3-006 · o despejo existia e o caminho de volta não.
 *
 * `backup-db.ts` grava `db-<tabela>.json` desde 3/set/2026. A auditoria de
 * 4/set achou o outro lado: **nenhum consumidor desses arquivos no
 * repositório** — nem script, nem rota. E `docs/deploy.md` ensinava a restaurar
 * um `.tar.gz` que o worker não produz, parando o processo com `pkill` de algo
 * que hoje é gerenciado por PM2. Três fontes descrevendo três coisas, e nenhuma
 * executável.
 *
 * Backup que ninguém sabe restaurar tem o mesmo problema do backup incompleto:
 * parece saudável até o dia em que alguém precisa dele.
 *
 * ## O que estes casos medem
 *
 * O ensaio, o inventário e as duas assimetrias que fazem uma restauração
 * mentir: arquivo de tabela que o schema não conhece mais, e tabela do schema
 * que não está na snapshot. Nenhum dos dois é erro — os dois são coisas que
 * quem restaura precisa **ver** antes de achar que a base voltou inteira.
 *
 * A gravação em si exige Postgres e não roda aqui; ela é exercida contra o
 * banco de verdade pelo ensaio do script (`scripts/restaurar_banco.ts` sem
 * `--commit`), que é o passo documentado antes de qualquer restauração.
 */

let tmpDir: string;
let restore: typeof import('../server/db/restore-db');

/** Um banco falso que só serve para o módulo achar que há conexão. */
const bancoFalso = vi.hoisted(() => ({
  select: () => ({ from: () => Promise.resolve([]) }),
  delete: () => Promise.resolve(),
  insert: () => ({ values: () => Promise.resolve() }),
  execute: () => Promise.resolve(),
}));

vi.mock('../server/db/client', async () => {
  const real = await vi.importActual<typeof import('../server/db/client')>('../server/db/client');
  return { ...real, getDb: () => bancoFalso, hasDb: () => true };
});

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-restore-'));
  restore = await import('../server/db/restore-db');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
});

async function snapshot(arquivos: Record<string, unknown[]>): Promise<string> {
  const dir = await fs.mkdtemp(path.join(tmpDir, 'snap-'));
  for (const [nome, linhas] of Object.entries(arquivos)) {
    await fs.writeFile(path.join(dir, `db-${nome}.json`), JSON.stringify(linhas), 'utf8');
  }
  // Um arquivo do DATA_DIR, que convive na mesma pasta e não é do banco.
  await fs.writeFile(path.join(dir, 'courses.json'), '[]', 'utf8');
  return dir;
}

describe('o ensaio é o padrão, e ele não grava', () => {
  it('sem --commit, diz o que faria e não escreve nada', async () => {
    const dir = await snapshot({
      users: [{ id: 'u1', email: 'a@b.com' }, { id: 'u2', email: 'c@d.com' }],
      courses: [{ id: 'c1', slug: 'x' }],
    });
    const r = await restore.restoreDatabase(dir);

    expect(r.gravou).toBe(false);
    expect(r.arquivosEncontrados).toBe(2);
    const users = r.tabelas.find((t) => t.tabela === 'users');
    expect(users?.linhasNoArquivo).toBe(2);
    // Ensaio conta o que existe e grava zero. Se algum dia isto virar 2 sem
    // `--commit`, o ensaio deixou de ser ensaio.
    expect(users?.linhasGravadas).toBe(0);
  });

  it('ignora os arquivos do DATA_DIR que dividem a pasta', async () => {
    // A snapshot mistura `db-*.json` (banco) com os JSON stores. Restaurar um
    // `courses.json` como se fosse tabela escreveria lixo.
    const dir = await snapshot({ users: [] });
    const r = await restore.restoreDatabase(dir);
    expect(r.arquivosEncontrados).toBe(1);
    expect(r.tabelas.map((t) => t.tabela)).toEqual(['users']);
  });
});

describe('as duas assimetrias que fariam a restauração mentir', () => {
  it('arquivo de tabela que o schema não conhece mais é declarado, não restaurado', async () => {
    // Tabela removida do schema depois da snapshot. Escrever nela às cegas
    // seria gravar numa tabela que o código não conhece — e omitir o arquivo
    // em silêncio faria alguém achar que restaurou tudo.
    const dir = await snapshot({ users: [], tabela_que_nao_existe_mais: [{ id: 1 }] });
    const r = await restore.restoreDatabase(dir);

    expect(r.desconhecidos).toContain('tabela_que_nao_existe_mais');
    expect(r.tabelas.map((t) => t.tabela)).not.toContain('tabela_que_nao_existe_mais');
    // E isso derruba o "completo": a snapshot tem dado que não foi restaurado.
    expect(r.completo).toBe(false);
  });

  it('tabela do schema sem arquivo na snapshot aparece na lista', async () => {
    const dir = await snapshot({ users: [] });
    const r = await restore.restoreDatabase(dir);

    // A snapshot só tinha `users`; todo o resto do schema está sem arquivo.
    expect(r.semArquivo.length).toBeGreaterThan(20);
    expect(r.semArquivo).toContain('enrollments');
    expect(r.semArquivo).toContain('payment_orders');
    expect(r.semArquivo).not.toContain('users');
  });
});

describe('o restaurador e o despejo falam do mesmo conjunto de tabelas', () => {
  it('o que o despejo escreve, a restauração sabe ler', async () => {
    // Se os dois lados descobrissem tabelas por caminhos diferentes, o backup
    // poderia gravar um arquivo que a volta ignora — e ninguém notaria até o
    // dia da restauração.
    const { totalDeTabelas } = await import('../server/db/backup-db');
    const dir = await snapshot({ users: [] });
    const r = await restore.restoreDatabase(dir);
    expect(r.semArquivo.length + r.tabelas.length).toBe(totalDeTabelas());
  });
});

/**
 * A documentação não pode voltar a ensinar um formato que o código não produz.
 *
 * Não é preciosismo de texto: `docs/deploy.md` descrevia
 * `snap-YYYY-MM-DD.tar.gz` extraído com `tar xzf` e o processo parado com
 * `pkill`. Quem seguisse aquilo no dia do desastre não restauraria nada — e
 * pior, o `pkill` é a armadilha conhecida deste servidor: o PM2 reergue o que
 * foi morto, os dois disputam a 3035 e produção entra em laço de reinício.
 *
 * O teste olha as seções operacionais. O que está marcado como histórico fica
 * como está — registro do que já foi verdade é diferente de instrução.
 */
describe('o que a documentação manda fazer é o que o código faz', () => {
  async function deploy(): Promise<string[]> {
    const doc = await fs.readFile(path.join(process.cwd(), 'docs', 'deploy.md'), 'utf8');
    return doc.split('\n').map((l) => l.replace('\r', ''));
  }

  it('a seção de restauração aponta para o script que existe', async () => {
    const linhas = (await deploy()).join(' ');
    expect(linhas).toContain('scripts/restaurar_banco.ts');
    // E ensina a ordem que importa: estrutura antes de linhas.
    expect(linhas).toContain('server/db/migrate.ts');
  });

  it('não manda extrair um .tar.gz que o worker não grava', async () => {
    const ensinaTar = (await deploy()).filter(
      // A nota que explica o defeito antigo cita o comando de propósito, e
      // citação começa com `>`.
      (l) => /tar\s+xzf/.test(l) && !l.trimStart().startsWith('>'),
    );
    expect(ensinaTar, `ainda manda extrair tar.gz: ${ensinaTar.join(' | ')}`).toEqual([]);
  });

  it('não manda matar o processo por fora do PM2', async () => {
    const linhas = await deploy();
    const ensinaPkill = linhas.filter((l, i) => {
      if (!/pkill\s+-f/.test(l)) return false;
      if (l.trimStart().startsWith('>')) return false;
      // O bloco "Caminho histórico" é registro, não instrução.
      return !linhas.slice(Math.max(0, i - 12), i).join(' ').includes('Caminho histórico');
    });
    expect(ensinaPkill, `ainda manda pkill: ${ensinaPkill.join(' | ')}`).toEqual([]);
  });
});

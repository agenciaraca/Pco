import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * PRIV2-005 · o backup copiava a metade que não importa.
 *
 * Até 3/set/2026 `runBackup` copiava **só `data/*.json`**. Em produção
 * `DATABASE_URL` está definida desde sempre e `AUTH_STORE=db` desde
 * 19/ago/2026 — ou seja, contas e credenciais, fichas de aluno, matrículas,
 * pedidos, agendamentos, certificados e uso de IA vivem no Postgres, e
 * **nenhum worker os copiava**.
 *
 * O que torna este o achado mais caro da auditoria não é o tamanho do buraco,
 * é a aparência dele: o backup **não estava quebrado, estava incompleto**.
 * Todo dia às 04:00 UTC ele rodava, copiava dezenas de arquivos, somava
 * quilobytes e reportava zero erros. `/admin/jobs` mostrava verde. Um número
 * que sobe todo dia dá impressão de saúde mais forte do que um número parado —
 * e um backup incompleto é indistinguível de um completo até o dia em que
 * alguém precisa dele.
 *
 * Por isso os casos abaixo cobram duas coisas separadas:
 *
 * 1. **O despejo acontece** e leva as linhas.
 * 2. **A tela não mente** quando ele não acontece. `bancoCoberto` distingue
 *    "não há banco" (`null`) de "há banco e não foi copiado" (`false`) — que
 *    era o estado real da instalação, e o que nenhuma tela sabia dizer.
 */

let tmpDir: string;

async function tmp(prefixo: string) {
  return await fs.mkdtemp(path.join(os.tmpdir(), prefixo));
}

beforeAll(async () => {
  tmpDir = await tmp('ava-pco-bkdb-');
  process.env.DATA_DIR = tmpDir;
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
  vi.resetModules();
});

describe('a descoberta de tabelas não pode ser vazia', () => {
  // Timeout generoso porque este é o primeiro caso a importar
  // `server/db/schema` — um módulo grande, cujo custo de importação aparece
  // inteiro aqui (meio segundo em máquina ociosa, mais na suíte cheia rodando
  // em paralelo). Com o padrão de 5s isto falha por carga, não por defeito, e
  // teste que pisca é pior que teste que falta: ensina a ignorar vermelho.
  it('encontra as tabelas do schema — e não zero', async () => {
    // **Esta é a guarda anti-vacuidade do arquivo inteiro.**
    //
    // `completo` é calculado como `tablesDumped === alvos.length`. Com
    // `alvos` vazio isso é **trivialmente verdadeiro**: o despejo cobriria
    // nada, reportaria `completo: true`, e a tela diria "banco salvo" — que é
    // exatamente o tipo de mentira que este trabalho todo persegue, reposto
    // num lugar novo.
    //
    // A detecção usa um símbolo interno do Drizzle. Se uma versão futura o
    // renomear, o filtro passa a devolver lista vazia **sem erro nenhum**, e é
    // este caso que avisa.
    const { totalDeTabelas } = await import('../server/db/backup-db');
    expect(totalDeTabelas(), 'nenhuma tabela encontrada — a detecção quebrou').toBeGreaterThan(20);
  }, 30_000);
});

describe('sem banco configurado, o despejo não se aplica', () => {
  it('devolve enabled:false e não inventa falha', async () => {
    const { dumpDatabase } = await import('../server/db/backup-db');
    const destino = await tmp('ava-pco-dump-vazio-');
    try {
      const r = await dumpDatabase(destino);
      // Modo JSON: `data/*.json` já é a base inteira, então não há o que
      // despejar e isso não é problema nenhum.
      expect(r.enabled).toBe(false);
      expect(r.errors).toEqual([]);
      expect(await fs.readdir(destino)).toEqual([]);
    } finally {
      await fs.rm(destino, { recursive: true, force: true });
    }
  });

  it('getStatus diz `null`, que é "não se aplica" e não "está tudo bem"', async () => {
    const backup = await import('../server/db/backup-worker');
    expect(backup.getStatus().bancoCoberto).toBeNull();
  });

  it('nunca ter rodado é `null`, não `false` — não medido não é ruim', async () => {
    const backup = await import('../server/db/backup-worker');
    expect(backup.getStatus().saudavel, 'zero e travessão são coisas diferentes').toBeNull();
  });
});

describe('com banco, o despejo grava uma linha por tabela', () => {
  it('escreve db-<tabela>.json e conta linhas', async () => {
    vi.resetModules();
    const destino = await tmp('ava-pco-dump-cheio-');

    // Um banco de mentira que devolve duas linhas para toda tabela. O que se
    // mede aqui é o caminho de gravação — que tabela vira arquivo, que linha
    // vira conteúdo — e não o Drizzle.
    vi.doMock('../server/db/client', async () => {
      const real = await vi.importActual<typeof import('../server/db/client')>(
        '../server/db/client',
      );
      return {
        ...real,
        hasDb: () => true,
        getDb: () => ({
          select: () => ({
            from: async () => [
              { id: 'linha-1', valor: 'a' },
              { id: 'linha-2', valor: 'b' },
            ],
          }),
        }),
      };
    });

    try {
      const { dumpDatabase, totalDeTabelas } = await import('../server/db/backup-db');
      const r = await dumpDatabase(destino);

      expect(r.enabled).toBe(true);
      expect(r.tablesDumped).toBe(totalDeTabelas());
      expect(r.rowsTotal).toBe(totalDeTabelas() * 2);
      expect(r.errors).toEqual([]);
      expect(r.completo).toBe(true);

      const arquivos = await fs.readdir(destino);
      expect(arquivos.length).toBe(totalDeTabelas());
      expect(arquivos.every((f) => f.startsWith('db-') && f.endsWith('.json'))).toBe(true);

      // As tabelas que doem mais se sumirem — as que a passada 002 nomeou.
      for (const tabela of ['users', 'students', 'enrollments', 'paymentOrders', 'certificates']) {
        expect(arquivos, `${tabela} tem de estar na snapshot`).toContain(`db-${tabela}.json`);
      }

      const conteudo = JSON.parse(await fs.readFile(path.join(destino, 'db-users.json'), 'utf8'));
      expect(conteudo).toHaveLength(2);
      expect(conteudo[0].id).toBe('linha-1');
    } finally {
      vi.doUnmock('../server/db/client');
      vi.resetModules();
      await fs.rm(destino, { recursive: true, force: true });
    }
  });

  it('tabela que falha não interrompe as outras, mas derruba `completo`', async () => {
    vi.resetModules();
    const destino = await tmp('ava-pco-dump-falho-');

    let chamadas = 0;
    vi.doMock('../server/db/client', async () => {
      const real = await vi.importActual<typeof import('../server/db/client')>(
        '../server/db/client',
      );
      return {
        ...real,
        hasDb: () => true,
        getDb: () => ({
          select: () => ({
            from: async () => {
              chamadas++;
              // A primeira tabela falha; as demais seguem.
              if (chamadas === 1) throw new Error('conexão caiu no meio');
              return [{ id: 'ok' }];
            },
          }),
        }),
      };
    });

    try {
      const { dumpDatabase, totalDeTabelas } = await import('../server/db/backup-db');
      const r = await dumpDatabase(destino);

      // Perder uma tabela é ruim; perder as outras 24 por causa dela é pior.
      expect(r.tablesDumped).toBe(totalDeTabelas() - 1);
      expect(r.errors.length).toBe(1);
      expect(r.errors[0]).toContain('conexão caiu no meio');
      // E o essencial: a tela não pode dizer que o banco está salvo.
      expect(r.completo, 'despejo parcial não é despejo').toBe(false);
    } finally {
      vi.doUnmock('../server/db/client');
      vi.resetModules();
      await fs.rm(destino, { recursive: true, force: true });
    }
  });
});

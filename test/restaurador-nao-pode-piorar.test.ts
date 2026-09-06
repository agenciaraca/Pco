import { describe, it, expect } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * SEC4-002 · o restaurador apagava tudo antes de inserir, sem transação.
 *
 * `restoreDatabase` executava `db.delete()` em **todas** as tabelas da snapshot
 * e só depois inseria. Se a inserção falhasse — arquivo truncado, coerção de
 * tipo, FK que não resolve em seis passadas — as tabelas já estavam vazias e
 * não havia volta. O relatório marcava `completo: false`, o que é honesto e
 * inútil: o dado já tinha saído.
 *
 * Isso pesa mais aqui do que em qualquer outro lugar do sistema, porque este
 * código roda **no dia do desastre**: o banco já está ruim e a snapshot é a
 * única cópia. Um restaurador que pode piorar a situação é pior do que não ter
 * restaurador, porque dá confiança para ser executado.
 *
 * E o script que o chama carregava `dotenv/config` sem nenhuma confirmação além
 * do `--commit`, numa máquina cujo `.env` aponta para produção. O `CLAUDE.md`
 * registra dois scripts de manutenção que já miraram na base errada assim — os
 * dois imprimindo o alvo, como este imprimia. **Imprimir não é exigir que
 * alguém leia.**
 *
 * ## Por que estes testes leem o arquivo
 *
 * Exercitar rollback de verdade exige um Postgres, e a suíte roda sem banco. O
 * que precisa ser garantido aqui é estrutural: existe transação, existe
 * savepoint por tentativa (sem ele o laço de passadas não sobrevive ao primeiro
 * erro, porque no Postgres um comando que falha aborta a transação inteira),
 * e existe o portão de ambiente.
 */

async function restore(): Promise<string> {
  return await fs.readFile(path.join(process.cwd(), 'server', 'db', 'restore-db.ts'), 'utf8');
}

async function script(): Promise<string> {
  return await fs.readFile(path.join(process.cwd(), 'scripts', 'restaurar_banco.ts'), 'utf8');
}

describe('a gravação é tudo ou nada', () => {
  it('apagar e inserir acontecem dentro de uma transação', async () => {
    const s = await restore();
    expect(s).toContain('await db.transaction(');
    // E o delete tem de estar DENTRO dela: era essa a falha.
    const i = s.indexOf('await db.transaction(');
    const dentro = s.slice(i);
    expect(dentro).toContain('.delete(');
    expect(dentro).toContain('.insert(');
  });

  it('cada tentativa tem savepoint — senão o laço de passadas não roda', async () => {
    // No Postgres, comando que falha aborta a transação: todo comando seguinte
    // responde `current transaction is aborted`. O laço que resolve FK sem
    // conhecer a ordem das tabelas depende de tentar, falhar e tentar de novo.
    const s = await restore();
    expect(s).toContain('tx.transaction(');
    expect(s).toContain('sp.delete(');
    expect(s).toContain('sp.insert(');
  });

  it('pendência desfaz tudo, e o relatório diz isso', async () => {
    // Restauração pela metade deixa o banco num estado que ninguém consegue
    // descrever de fora: parte das linhas velhas apagada, parte das novas
    // ausente. Desfazer devolve o operador a um estado conhecido.
    const s = await restore();
    expect(s).toContain('RestauracaoIncompleta');
    expect(s).toContain('desfeito');
    // E `gravou` não pode continuar dizendo `true` depois do rollback.
    expect(s).toMatch(/resultado\.gravou = false;/);
  });

  it('o ajuste de sessão é `set local` — some junto com a transação', async () => {
    const s = await restore();
    expect(s).toContain("set local session_replication_role = 'replica'");
  });
});

describe('o script exige confirmação de ambiente para gravar', () => {
  it('`--commit` sem `SEI_O_QUE_FACO` é recusado', async () => {
    // Mesmo portão de `restart_vps.py` e `update_vps_pwd.py`. Era o único
    // caminho destrutivo do repositório sem o equivalente.
    const s = await script();
    expect(s).toContain('SEI_O_QUE_FACO');
    expect(s).toMatch(/commit && !process\.env\.SEI_O_QUE_FACO/);
    expect(s).toContain('RECUSADO');
  });

  it('o ensaio NÃO exige a variável', async () => {
    // Ensaio é leitura pura e é o que se roda para decidir. Exigi-lo faria
    // decidir às cegas — mesma razão pela qual o ensaio do expurgo não exige
    // aprovação prévia.
    const s = await script();
    // A primeira ocorrência é a do cabeçalho; a guarda é a do código.
    const i = s.indexOf('if (commit && !process.env.SEI_O_QUE_FACO)');
    expect(i, 'a guarda não está condicionada a --commit').toBeGreaterThan(0);
    // E o `restoreDatabase` é chamado depois dela, não antes.
    expect(s.indexOf('await restoreDatabase(')).toBeGreaterThan(i);
  });

  it('a recusa mostra o banco alvo, e nunca a senha', async () => {
    const s = await script();
    const i = s.indexOf('RECUSADO');
    expect(s.slice(i, i + 600)).toContain('alvoLegivel()');
    // `alvoLegivel` extrai usuário, host e base — a senha fica de fora.
    expect(s).toMatch(/Nunca imprime a senha/);
  });
});

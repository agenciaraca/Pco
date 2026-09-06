/**
 * Restaura as tabelas do Postgres a partir de uma snapshot do backup.
 *
 * ```bash
 * # 1. ENSAIO — não grava nada, diz o que faria
 * DATABASE_URL=<owner> npx tsx scripts/restaurar_banco.ts data/backups/2026-09-05
 *
 * # 2. Depois de ler o ensaio, e só depois:
 * SEI_O_QUE_FACO=1 DATABASE_URL=<owner> \
 *   npx tsx scripts/restaurar_banco.ts data/backups/2026-09-05 --commit
 * ```
 *
 * A variável não é burocracia: o `.env` da máquina de quem desenvolve aponta
 * para produção, e este script apaga antes de inserir. O ensaio não a exige.
 *
 * **É tudo ou nada.** A gravação roda dentro de uma transação; se qualquer
 * tabela falhar, tudo é desfeito e o banco fica como estava. Restauração pela
 * metade deixa o banco num estado que ninguém consegue descrever de fora — e
 * este código roda no dia do desastre, quando a snapshot é a única cópia.
 *
 * **As migrations vêm antes.** Este script restaura *linhas*; a estrutura vem
 * de `server/db/migrate.ts`. Restaurar para um banco vazio sem rodar as
 * migrations não funciona, e restaurar para um banco com schema mais novo que a
 * snapshot deixa as colunas novas nulas — que é o comportamento certo.
 *
 * ## Ele apaga
 *
 * Restaurar é substituir: cada tabela da snapshot é esvaziada antes de receber
 * as linhas. Por isso o ensaio é o padrão e o `--commit` é explícito, e por isso
 * o script imprime **em qual banco vai mexer** antes de qualquer coisa — este
 * projeto já teve dois scripts de manutenção que miraram na base errada por não
 * carregarem o `.env`.
 */

import 'dotenv/config';
import path from 'node:path';
import { restoreDatabase } from '../server/db/restore-db';
import { getDb } from '../server/db/client';

function alvoLegivel(): string {
  const url = process.env.DATABASE_URL ?? '';
  // Nunca imprime a senha. O que importa é usuário, host e base.
  const m = /^[a-z]+:\/\/([^:]+):[^@]*@([^/]+)\/([^?]+)/i.exec(url);
  return m ? `${m[1]}@${m[2]}/${m[3]}` : '(DATABASE_URL não reconhecida)';
}

async function main() {
  const args = process.argv.slice(2);
  const dir = args.find((a) => !a.startsWith('--'));
  const commit = args.includes('--commit');

  if (!dir) {
    console.error('uso: npx tsx scripts/restaurar_banco.ts <pasta-da-snapshot> [--commit]');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('[restore] DATABASE_URL ausente — não há banco para restaurar.');
    process.exit(1);
  }
  if (!getDb()) {
    console.error('[restore] não foi possível abrir conexão com o banco.');
    process.exit(1);
  }

  const pasta = path.resolve(dir);
  console.log(`[restore] snapshot: ${pasta}`);
  console.log(`[restore] banco:    ${alvoLegivel()}`);
  console.log(`[restore] modo:     ${commit ? 'GRAVANDO (--commit)' : 'ensaio (nada é gravado)'}`);
  console.log('');

  /*
    **Imprimir o alvo não é o mesmo que exigir que alguém o leia.**

    Este é o script mais destrutivo do repositório: ele esvazia cada tabela da
    snapshot antes de reinseri-la. E ele carrega `dotenv/config` numa máquina
    cujo `.env` aponta para **produção** — o `CLAUDE.md` registra dois scripts
    de manutenção que já miraram na base errada exatamente assim, os dois
    imprimindo o que iam fazer.

    O projeto já respondeu a esse risco em outros lugares: `playwright.config`
    zera `DATABASE_URL` à força, e `restart_vps.py` exige `SEI_O_QUE_FACO=1`.
    Era o único caminho perigoso sem o portão equivalente.

    O ensaio **não** passa por aqui: é leitura pura, e é justamente o que se
    precisa rodar antes de decidir.
  */
  if (commit && !process.env.SEI_O_QUE_FACO) {
    console.error('RECUSADO: --commit APAGA cada tabela da snapshot antes de reinserir.');
    console.error('');
    console.error(`  banco alvo:  ${alvoLegivel()}`);
    console.error('');
    console.error('Confira a linha acima. Se for mesmo esse o banco, repita com:');
    console.error('');
    console.error(`  SEI_O_QUE_FACO=1 npx tsx scripts/restaurar_banco.ts ${dir} --commit`);
    console.error('');
    console.error('Rode antes o ensaio (sem --commit): ele lê e não grava nada.');
    process.exit(1);
  }

  const r = await restoreDatabase(pasta, { commit });

  const totalLinhas = r.tabelas.reduce((s, t) => s + t.linhasNoArquivo, 0);
  console.log(`[restore] ${r.arquivosEncontrados} arquivo(s), ${totalLinhas} linha(s) na snapshot`);

  for (const t of r.tabelas.sort((a, b) => b.linhasNoArquivo - a.linhasNoArquivo)) {
    const marca = t.erro ? 'FALHOU' : commit ? 'ok' : 'restauraria';
    console.log(
      `   ${t.tabela.padEnd(28)} ${String(t.linhasNoArquivo).padStart(6)} ${marca}` +
        (t.erro ? ` — ${t.erro.slice(0, 120)}` : ''),
    );
  }

  if (r.desconhecidos.length > 0) {
    console.log(
      `\n[restore] ${r.desconhecidos.length} arquivo(s) de tabela que o schema não conhece mais ` +
        `(não serão restaurados): ${r.desconhecidos.join(', ')}`,
    );
  }
  if (r.semArquivo.length > 0) {
    // Não é erro: tabela criada depois da snapshot simplesmente não tem linhas
    // para restaurar. Mas é o tipo de coisa que se quer ver antes de assumir
    // que a base voltou inteira.
    console.log(
      `\n[restore] ${r.semArquivo.length} tabela(s) do schema sem arquivo na snapshot: ` +
        r.semArquivo.join(', '),
    );
  }

  console.log('');
  if (!commit) {
    console.log('[restore] ENSAIO — nada foi gravado. Releia acima e repita com --commit.');
  } else if (r.completo) {
    console.log('[restore] concluído: todas as tabelas da snapshot foram restauradas.');
  } else if (r.desfeito) {
    // A transação inteira foi desfeita. O banco está como estava — dizer isso
    // é a informação que muda o que o operador faz em seguida.
    console.log('[restore] DESFEITO — nada foi gravado, o banco está como antes.');
    console.log('[restore] Veja as linhas marcadas FALHOU acima e corrija a causa.');
    process.exit(2);
  } else {
    console.log('[restore] TERMINOU COM PENDÊNCIA — veja as linhas marcadas FALHOU acima.');
    process.exit(2);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('[restore] falhou:', err instanceof Error ? err.message : err);
  process.exit(1);
});

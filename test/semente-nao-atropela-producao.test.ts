import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * PRIV2-016 · o que está versionado em `data/` sobrescreve produção no deploy.
 *
 * Os dois caminhos de deploy fazem `git reset --hard origin/main`, e
 * `git reset --hard` **reverte arquivo versionado**. Ou seja: todo arquivo de
 * `data/` que estiver no git é, na prática, uma ordem para apagar o
 * equivalente em produção no próximo deploy.
 *
 * Isso já foi caro antes: a lista era por arquivo até 2/set/2026 e **vinte
 * tinham ficado de fora**, incluindo os hashes dos tokens `pcok_*` e o
 * registro de pedidos de exclusão. Corrigiu-se invertendo o padrão
 * (`data/*` ignorado, exceções nominais por `!`) — e duas exceções nominais
 * ficaram erradas.
 *
 * ## As duas que saíram em 3/set/2026
 *
 * `data/course-reviews.json` e `data/notification-prefs.json` estavam
 * versionados **como `[]`**. Não eram semente de nada: a única coisa que
 * faziam era zerar produção a cada deploy.
 *
 * - `notification-prefs.json` guarda quem pediu para **não** receber
 *   comunicado. Zerar isso faz o sistema voltar a escrever para quem se
 *   descadastrou — consentimento revogado que ressuscita sozinho, e o pedido
 *   de descadastro é justamente o que a pessoa fez para não ser incomodada.
 * - `course-reviews.json` guarda as avaliações escritas pelos alunos. Zerar
 *   apaga o texto deles.
 *
 * Nenhum dos dois precisa existir no repositório: o `JsonStore` cria o arquivo
 * com `() => []` na primeira leitura.
 *
 * ## As quatro que ficam, e por que ficam
 *
 * As outras quatro são padrão de instalação nova — sem elas um clone limpo
 * sobe sem nome de escola, sem texto na tela de login e sem horário para os
 * relatórios. **Mas também são editáveis em tela**, e por isso os dois
 * scripts de deploy passaram a preservá-las: guardam a versão de produção
 * antes do reset e devolvem depois.
 *
 * Este arquivo cobra as duas metades. Sem a segunda, versionar um padrão
 * continuaria significando apagar o ajuste do admin — em silêncio, porque a
 * tela salva, responde 200, e o valor só some no deploy seguinte.
 */

const raiz = process.cwd();

function versionadosEmData(): string[] {
  const saida = execFileSync('git', ['ls-files', 'data/'], {
    cwd: raiz,
    encoding: 'utf-8',
  });
  return saida.split('\n').filter(Boolean).sort();
}

/** Estado de execução: nasce vazio e é escrito pelo uso. Nunca versionar. */
const NUNCA_VERSIONAR = [
  'data/course-reviews.json',
  'data/notification-prefs.json',
];

/** Padrão de instalação nova. Versionar é decisão — e exige preservação no deploy. */
const SEMENTES_DE_CONFIGURACAO = [
  'data/admin-weekly-config.json',
  'data/login-config.json',
  'data/settings.json',
  'data/student-progress-email-config.json',
];

describe('o que está versionado em data/', () => {
  it('estado de execução não é versionado', () => {
    const versionados = versionadosEmData();
    for (const arquivo of NUNCA_VERSIONAR) {
      expect(
        versionados,
        `${arquivo} versionado significa apagá-lo em produção no próximo ` +
          '`git reset --hard` do deploy — e ele guarda escolha de pessoa, não padrão',
      ).not.toContain(arquivo);
    }
  });

  it('a lista versionada é exatamente a de configuração — nada entrou por acidente', () => {
    // Comparação exata, nos dois sentidos: arquivo novo em `data/` que alguém
    // versione sem pensar aparece aqui, e é o momento de perguntar "isto some
    // em produção no próximo deploy?".
    expect(versionadosEmData()).toEqual([...SEMENTES_DE_CONFIGURACAO].sort());
  });
});

describe('os dois deploys preservam a configuração que revertem', () => {
  const scriptBruto = readFileSync(resolve(raiz, 'scripts/deploy_producao.sh'), 'utf-8');
  const workflowBruto = readFileSync(resolve(raiz, '.github/workflows/deploy.yml'), 'utf-8');

  /**
   * Só os comandos, sem as linhas de comentário.
   *
   * Os comentários destes dois arquivos **precisam citar** `git reset --hard`
   * e `$CARIMBO` para explicar por que a proteção existe — e sem esta limpeza
   * os casos abaixo casavam com a explicação em vez do comando, e falhavam
   * apontando para o texto que documenta o próprio conserto. Mesmo motivo do
   * `routerCodigo` em `test/numeros-do-site.test.ts`.
   */
  function semComentarios(texto: string): string {
    return texto
      .split(/\r?\n/)
      .filter((l) => !/^\s*#/.test(l))
      .join('|');
  }

  const script = semComentarios(scriptBruto);
  const workflow = semComentarios(workflowBruto);

  it('ambos fazem `git reset --hard` — é daí que vem o problema', () => {
    // Se um dia deixarem de fazer, esta suíte inteira perde o motivo e alguém
    // deve reler o arquivo em vez de remover a proteção por parecer inútil.
    expect(script).toContain('git reset --hard');
    expect(workflow).toContain('git reset --hard');
  });

  it('cada semente de configuração é restaurada nos dois caminhos', () => {
    for (const caminho of SEMENTES_DE_CONFIGURACAO) {
      const nome = caminho.replace('data/', '').replace('.json', '');
      expect(script, `${nome} não é preservado por scripts/deploy_producao.sh`).toContain(nome);
      expect(workflow, `${nome} não é preservado pelo workflow`).toContain(nome);
    }
  });

  it('o script do servidor não depende de variável de outra sessão SSH', () => {
    // A primeira versão desta correção usava `$CARIMBO`, definido no passo do
    // backup — que roda **noutra sessão SSH**. A variável não atravessa, o
    // `tar` não acharia nada, e a restauração falharia em silêncio: o mesmo
    // defeito que ela conserta, dentro do conserto.
    const trechoRestauracao = script.slice(script.indexOf('git reset --hard'));
    expect(trechoRestauracao).toContain('backups-deploy/data-*.tar.gz');
    expect(
      trechoRestauracao.includes('CARIMBO'),
      'o passo de restauração não pode ler $CARIMBO — ele é de outra sessão',
    ).toBe(false);
  });

  it('o workflow guarda a cópia ANTES do reset, não depois', () => {
    // Ordem importa: copiar depois do reset copiaria o padrão do repositório
    // por cima dele mesmo, e a tela continuaria voltando ao padrão a cada
    // deploy — com um passo a mais dando a impressão de estar resolvido.
    const posCopia = workflow.indexOf('CFG=$(mktemp -d)');
    const posReset = workflow.indexOf('git reset --hard');
    expect(posCopia).toBeGreaterThan(-1);
    expect(posCopia, 'a cópia tem de vir antes do reset').toBeLessThan(posReset);
  });
});

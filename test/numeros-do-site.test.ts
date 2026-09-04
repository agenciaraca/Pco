import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { numerosDoSite } from '../server/public/projections';

/**
 * Número em página de venda é afirmação de resultado a quem ainda vai comprar
 * — e afirmação de resultado tem dono (CDC, art. 37).
 *
 * A sessão de 27/ago tirou quatro estatísticas inventadas da `/ava-pco` e
 * deixou o motivo escrito lá. Agora a home mede: avaliação sai das avaliações
 * reais e anda com a base, "formados" é contagem de certificado emitido,
 * "anos" é calculado da fundação, "aulas" é contagem das aulas públicas.
 *
 * ## Por que este arquivo foi reescrito em 3/set/2026
 *
 * A versão anterior deste teste era uma **lista negra de quatro frases
 * literais** — `'centenas de alunos'`, `'96% de satisfação'`, `'4,7/5'` e
 * `'data-count-to="1000"'` — e cobrava que nenhuma aparecesse no router.
 *
 * Eram exatamente as quatro que já tinham sido removidas. **O teste só podia
 * passar.** Ele não protegia a regra; ele registrava o passado. E enquanto
 * passava verde, a home no ar dizia:
 *
 * - `"+800 Alunos Formados"` no quadro e `"mais de 1000 alunos"` no parágrafo
 *   imediatamente abaixo — a escola discordando de si mesma a dois centímetros
 *   de distância;
 * - `"96,6% de Índice de Satisfação"` e `"índice de satisfação de mais de
 *   96%"`, sobre uma pesquisa que **não existe** — e o comentário de
 *   `projections.ts` diz isso por escrito, no arquivo ao lado;
 * - `"+100 aulas exclusivas"`, quando são mais de 500.
 *
 * Nenhuma das três casava com as quatro strings da lista. É a mesma classe de
 * defeito que esta auditoria persegue no código: **a regra existir não é a
 * regra rodar**, e um teste com o nome certo é a pior forma de não ter teste,
 * porque ninguém procura de novo.
 *
 * ## O que este arquivo faz agora
 *
 * Em vez de proibir frases, ele **inventaria afirmações numéricas**, no mesmo
 * molde de `test/rotas-publicas-inventario.test.ts`: toda aparição de número
 * junto de palavra de resultado precisa estar na lista abaixo **com o motivo
 * escrito**. Número novo na home não passa sem alguém justificar.
 *
 * E a comparação é nos **dois sentidos**. Entrada que não casa mais também
 * falha — foi assim que a lista velha apodreceu sem ninguém perceber.
 */

const routerSrc = readFileSync(resolve(process.cwd(), 'server/public/router.ts'), 'utf-8');

/**
 * Só o código, sem os comentários — que precisam poder CITAR a afirmação
 * proibida para explicar por que ela saiu. Sem isso, documentar o motivo
 * derrubaria o próprio teste.
 */
const routerCodigo = routerSrc
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter((l) => !/^\s*(\/\/|\*)/.test(l))
  .join('\n');

/**
 * As três formas que uma afirmação numérica toma neste arquivo.
 *
 * `PERCENTUAL` ignora o que vem depois de `:` porque `width:100%` e
 * `border-radius:50%` são CSS, não alegação. `PAR_DE_QUADRO` existe porque o
 * valor e o rótulo moram em elementos separados do array
 * (`['+800', 'Alunos Formados']`) e nenhuma regra de adjacência os enxerga.
 */
const REGRAS = {
  PERCENTUAL: /(?<![:\w-])\d[\d.,]*\s*%/g,
  NUMERO_COM_SUBSTANTIVO:
    /\+?\d[\d.,]*\s*(?:alunos?|aulas?|anos?|horas?|m[oó]dulos?|professores?)/gi,
  PAR_DE_QUADRO: /'\+?\d[\d.,]*%?'\s*,\s*'[^']*(?:alunos?|aulas?|satisfa|anos?|m[oó]dulos?)/gi,
};

/**
 * O inventário. Chave = o trecho exato que a regra casa; valor = por que ele
 * pode ficar.
 *
 * **Acrescentar aqui é uma decisão, não um passo burocrático.** Se o motivo
 * que você escreveria é "porque está na home", o número não devia estar na
 * home.
 */
const AFIRMACOES_PERMITIDAS: Record<string, string> = {
  "'+800', 'Alunos": [
    'Histórico da escola, DECLARADO pelo dono — não é medição do sistema, e não',
    'pode ser: o AVA existe há menos tempo que a PCO, então os formados de antes',
    'dele não têm certificado emitido aqui. Fica como afirmação da escola, que é',
    'de quem é. A contagem medida vive na barra "Medido no sistema, hoje", logo',
    'abaixo e separada de propósito.',
  ].join(' '),

  '800 alunos': 'O mesmo número do quadro acima, repetido no parágrafo. Antes o parágrafo dizia "mais de 1000" e contradizia o quadro; agora os dois dizem 800.',

  '24 horas':
    'Descreve disponibilidade de acesso ("24 horas por dia"), não resultado de aluno. Não é promessa de desempenho.',

  '100%':
    'Duas ocorrências, ambas legítimas: um depoimento citado, em que a aluna diz "minha satisfação é de 100%" — fala atribuída a ela, não afirmação da escola — e "as formações são 100% online", que descreve a modalidade de entrega e não um resultado.',
};

function acharAfirmacoes(): string[] {
  const achados = new Set<string>();
  for (const regra of Object.values(REGRAS)) {
    for (const m of routerCodigo.matchAll(regra)) {
      achados.add(m[0].trim());
    }
  }
  return [...achados].sort();
}

describe('números da home: inventário, não lista negra', () => {
  it('toda afirmação numérica está no inventário, com motivo escrito', () => {
    const naoInventariadas = acharAfirmacoes().filter((a) => !(a in AFIRMACOES_PERMITIDAS));
    expect(
      naoInventariadas,
      'número novo na home sem justificativa no inventário deste arquivo — ' +
        'afirmação de resultado a quem ainda vai comprar tem dono (CDC, art. 37)',
    ).toEqual([]);
  });

  it('o inventário não apodrece: entrada que não casa mais também falha', () => {
    // Foi exatamente isto que faltou na versão anterior. As quatro frases
    // proibidas já não existiam no arquivo, e o teste seguiu verde por semanas
    // enquanto três afirmações novas entravam por baixo dele.
    const achadas = new Set(acharAfirmacoes());
    const orfas = Object.keys(AFIRMACOES_PERMITIDAS).filter((k) => !achadas.has(k));
    expect(
      orfas,
      'entrada do inventário que não corresponde a nada no router — ' +
        'remova a linha, senão a lista vira registro do passado',
    ).toEqual([]);
  });

  it('todo motivo é uma frase de verdade, não um carimbo', () => {
    for (const [afirmacao, motivo] of Object.entries(AFIRMACOES_PERMITIDAS)) {
      expect(motivo.length, `motivo curto demais para "${afirmacao}"`).toBeGreaterThan(40);
    }
  });

  it('satisfação não aparece como número em lugar nenhum do router', () => {
    // O caso que motivou a reescrita, cobrado à parte porque é o único com
    // regra escrita em outro arquivo: `projections.ts` diz, com todas as
    // letras, que "96% de satisfação não entra: não existe pesquisa de
    // satisfação neste sistema".
    const linhas = routerCodigo.split('\n').filter((l) => /satisfa/i.test(l));
    for (const l of linhas) {
      // Depoimento citado é fala de aluna, não medição da escola — e é o único
      // lugar em que a palavra pode conviver com um número.
      const ehDepoimento = /Acabei de concluir|minha satisfação/i.test(l);
      if (ehDepoimento) continue;
      expect(l, 'índice de satisfação sem pesquisa por trás').not.toMatch(/\d/);
    }
  });
});

describe('o que a home mede', () => {
  it('calcula os anos a partir da fundação, em vez de escrevê-los', async () => {
    const r = await numerosDoSite('2018');
    expect(r.anos).toBe(new Date().getFullYear() - 2018);
  });

  it('devolve null — nunca zero — quando não há o que medir', async () => {
    // Zero diz "medi e deu zero"; numa página de venda isso é pior do que não
    // mostrar. Quem não tem medição sai da tela.
    const r = await numerosDoSite('2018');

    expect(r.formados === null || (typeof r.formados === 'number' && r.formados > 0)).toBe(true);
    expect(r.aulas === null || (typeof r.aulas === 'number' && r.aulas > 0)).toBe(true);

    if (r.avaliacao !== null) {
      expect(r.avaliacao.total).toBeGreaterThan(0);
      expect(r.avaliacao.media).toBeGreaterThan(0);
      expect(r.avaliacao.media).toBeLessThanOrEqual(5);
    }
  });

  it('não quebra com fundação ausente ou inválida', async () => {
    expect((await numerosDoSite(undefined)).anos).toBeNull();
    expect((await numerosDoSite('ontem')).anos).toBeNull();
  });
});

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { numerosDoSite } from '../server/public/projections';

/**
 * Número em página de venda é afirmação de resultado a quem ainda vai comprar
 * — e afirmação de resultado tem dono (CDC, art. 37).
 *
 * A sessão de 27/ago tirou quatro estatísticas inventadas da `/ava-pco` e
 * deixou o motivo escrito lá. As mesmas afirmações continuaram no site SSR:
 * o hero dizia "★★★★★ 4,7/5 · centenas de alunos formados" e a barra dizia
 * "1000+ alunos formados" e "4,7 avaliação média" — nada disso era medido. O
 * protótipo de design ainda propunha "96% de satisfação", que também não tem
 * pesquisa por trás.
 *
 * Agora a home mede: avaliação sai das avaliações reais e anda com a base,
 * "formados" é contagem de certificado emitido, "anos" é calculado da fundação.
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

describe('números da home', () => {
  it('não traz afirmação escrita à mão no router', () => {
    // Se algum desses voltar como literal, é porque alguém escreveu um número
    // em vez de medi-lo.
    for (const inventado of [
      'centenas de alunos',
      '96% de satisfação',
      '4,7/5',
      'data-count-to="1000"',
    ]) {
      expect(routerCodigo, `voltou a afirmar sem medir: ${inventado}`).not.toContain(inventado);
    }
  });

  it('calcula os anos a partir da fundação, em vez de escrevê-los', () => {
    const n = numerosDoSite('2018');
    return n.then((r) => {
      expect(r.anos).toBe(new Date().getFullYear() - 2018);
    });
  });

  it('devolve null — nunca zero — quando não há o que medir', async () => {
    // Zero diz "medi e deu zero"; numa página de venda isso é pior do que não
    // mostrar. Quem não tem medição sai da tela.
    const r = await numerosDoSite('2018');

    expect(r.formados === null || (typeof r.formados === 'number' && r.formados > 0)).toBe(true);

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

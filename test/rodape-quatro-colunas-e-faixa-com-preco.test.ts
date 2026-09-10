import { describe, it, expect, beforeAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Duas correções pedidas pelo dono em 10/set/2026.
 *
 * ## 1. O rodapé tinha duas colunas, e devia ter quatro
 *
 * A grade do rodapé era `1fr 1fr 1.3fr` — logo/contato, selo RNTP, e uma
 * terceira coluna de texto de privacidade. Quando não há texto de privacidade
 * (o estado de produção), ela caía para `cols-2`: **o site mostrava duas
 * colunas**. As oito âncoras institucionais viviam empilhadas numa linha só,
 * sob o copyright, quebrando em duas ou três fileiras.
 *
 * Agora são quatro colunas fixas: as duas de antes + duas de links. O resumo
 * de privacidade, quando configurado, virou uma **faixa** abaixo das colunas —
 * não disputa mais largura com elas.
 *
 * ## 2. A faixa "Faça já sua matrícula" ganhou textura e o preço do carro-chefe
 *
 * A faixa era degradê liso com dois botões. Ganhou a textura de ondas
 * (`.com-textura`, a mesma da `.cta-final` e da faixa RNTP) e o preço do Curso
 * de Psicanálise Clínica — que **vem da projeção**, nunca cravado: é o que
 * impede o "12x fantasma".
 */

let layout: string;
let css: string;
let router: string;

beforeAll(async () => {
  const raiz = process.cwd();
  [layout, css, router] = await Promise.all([
    fs.readFile(path.join(raiz, 'server/public/layout.ts'), 'utf8'),
    fs.readFile(path.join(raiz, 'server/public/styles.ts'), 'utf8'),
    fs.readFile(path.join(raiz, 'server/public/router.ts'), 'utf8'),
  ]);
});

describe('o rodapé tem quatro colunas', () => {
  it('a grade é de quatro, e não há mais o fallback para duas', () => {
    const regra = /\.site-footer \.cols\{[^}]*grid-template-columns:([^;]+);/.exec(css);
    expect(regra, 'regra .site-footer .cols sumiu').not.toBeNull();
    // Quatro tracks.
    expect(regra![1].trim().split(/\s+/)).toHaveLength(4);
    // O `.cols-2` era o que fazia produção mostrar duas colunas.
    expect(css).not.toContain('.cols.cols-2');
    expect(css).not.toContain('cols-2');
  });

  it('as duas colunas novas são de links, com rótulo', () => {
    const foot = layout.slice(layout.indexOf('function footer('), layout.indexOf('</footer>'));
    expect(foot).toContain("colunaLinks('Institucional'");
    expect(foot).toContain("colunaLinks('Ajuda e transparência'");
    // As oito âncoras continuam alcançáveis.
    for (const href of [
      '/sobre',
      '/como-funciona',
      '/contato',
      '/perguntas-frequentes',
      '/legalidade',
      '/termos',
      '/privacidade',
    ]) {
      expect(foot, `${href} sumiu do rodapé`).toContain(`'${href}'`);
    }
  });

  it('a linha do copyright não carrega mais a lista de links', () => {
    const foot = layout.slice(layout.indexOf('function footer('), layout.indexOf('</footer>'));
    const legal = foot.slice(foot.indexOf('class="wrap legal"'));
    expect(legal).toContain('Todos os direitos reservados');
    expect(legal).not.toContain('href="/termos"');
    expect(legal).not.toContain('Perguntas frequentes');
  });

  it('o resumo de privacidade é faixa, não coluna', () => {
    // Fora do grid `.cols` — dentro de um `.wrap` próprio.
    const foot = layout.slice(layout.indexOf('function footer('), layout.indexOf('</footer>'));
    expect(foot).toContain('class="wrap rodape-privacidade"');
    expect(foot).not.toContain('rodape-col rodape-privacidade');
  });

  it('a paridade com o link de "Quem ensina" continua respeitada', () => {
    const foot = layout.slice(layout.indexOf('function footer('), layout.indexOf('</footer>'));
    // O link só entra quando o autor não é placeholder — a regra de sempre.
    expect(foot).toContain('AUTHOR_IS_PLACEHOLDER');
    expect(foot).toContain("'/quem-ensina'");
  });
});

describe('a faixa "Faça já sua matrícula"', () => {
  it('usa a classe da textura, não uma cópia da regra', () => {
    // A seção da faixa, do <section ...faixa-cta...> até o fim dela.
    const abre = router.indexOf('class="section-tight faixa-cta');
    expect(abre, 'a seção da faixa mudou de assinatura').toBeGreaterThan(0);
    const secao = router.slice(abre, router.indexOf('</section>', abre));
    expect(secao).toContain('com-textura');
    expect(secao).toContain('Faça já sua matrícula');
  });

  it('sobre o fundo escuro a textura é reforçada', () => {
    // .com-textura base é opacity .09, calibrada para o laranja da cta-final.
    expect(css).toMatch(/\.faixa-cta\.com-textura::before\{opacity:\.1[0-9]?\}/);
  });

  it('o preço vem da projeção do carro-chefe, nunca cravado', () => {
    const i = router.indexOf('const precoMatricula');
    expect(i).toBeGreaterThan(0);
    const bloco = router.slice(i, i + 400);
    // Da mesma projeção que monta os cartões.
    expect(bloco).toContain('carroChefe');
    expect(bloco).toContain('priceFormatted');
    expect(bloco).toContain('condicoesFormatted');
    // Nenhum "12x" ou "R$" literal na faixa.
    const secao = router.slice(
      router.lastIndexOf('<section', router.indexOf('Faça já sua matrícula')),
      router.indexOf('Faça já sua matrícula') + 500,
    );
    expect(secao).not.toMatch(/\d+x de R\$/);
    expect(secao).not.toMatch(/R\$\s?\d/);
  });

  it('sem preço na vitrine, a faixa fica só com os botões', () => {
    const i = router.indexOf('const precoMatricula');
    const bloco = router.slice(i, i + 400);
    // O ternário devolve string vazia quando não há priceFormatted.
    expect(bloco).toMatch(/priceFormatted[\s\S]*:\s*''/);
  });
});

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PUBLIC_CSS_SERVIDO } from '../server/public/styles';

/**
 * O contrato de botão do site público vem de UM lugar: a biblioteca de
 * componentes do handoff de design — `design pagina publicas pco/
 * design_handoff_ava_paginas_publicas/pages/Componentes.dc.html`.
 *
 * Em 31/ago/2026 o dono apontou que "os botões e CTAs ainda não são os do
 * desenho". Conferido: existiam três variantes das cinco, e **nenhum estado**.
 * Botão desabilitado ficava idêntico a botão clicável, não havia carregando,
 * não havia ghost, e o foco era o contorno cru do `:focus-visible` global, e
 * não o anel macio que o desenho especifica. Campo tinha o mesmo problema:
 * bloqueado e com erro eram iguais a campo normal.
 *
 * Estado que não se vê é tela que mente — a mesma regra que já vale para os
 * números do site. Por isso isto é teste, e não observação em documento.
 */
const layout = readFileSync(resolve(process.cwd(), 'server/public/layout.ts'), 'utf-8');
const router = readFileSync(resolve(process.cwd(), 'server/public/router.ts'), 'utf-8');

describe('botões do site público seguem o desenho', () => {
  it('tem as cinco variantes do desenho, não três', () => {
    for (const variante of ['.btn-cta{', '.btn-primary{', '.btn-outline{', '.btn-ghost{', '.btn-wa{']) {
      expect(PUBLIC_CSS_SERVIDO, `variante ausente: ${variante}`).toContain(variante);
    }
  });

  it('tem os estados que faltavam: foco, desabilitado e carregando', () => {
    // Anel macio de acento, e não o contorno global.
    expect(PUBLIC_CSS_SERVIDO).toContain('.btn:focus-visible{outline:3px solid var(--accent-soft)');
    // Desabilitado precisa ser visível: sem isto, botão sem ação parece com ação.
    expect(PUBLIC_CSS_SERVIDO).toMatch(/\.btn\[disabled\][^{]*\{[^}]*cursor:not-allowed/);
    // Carregando: o desenho pede o giro dentro do próprio botão.
    expect(PUBLIC_CSS_SERVIDO).toContain('.btn-spin{');
    expect(PUBLIC_CSS_SERVIDO).toContain('@keyframes btn-spin');
  });

  it('tem os três tamanhos do desenho', () => {
    // padrão 13/24, par de CTAs do curso 14/26, herói 17/34.
    expect(PUBLIC_CSS_SERVIDO).toContain('padding:13px 24px');
    expect(PUBLIC_CSS_SERVIDO).toContain('.curso-cta-par .btn{padding:14px 26px}');
    expect(PUBLIC_CSS_SERVIDO).toContain('.btn-lg{padding:17px 34px');
  });

  it('campo tem foco em anel, desabilitado e erro', () => {
    expect(PUBLIC_CSS_SERVIDO).toContain('box-shadow:0 0 0 3px var(--accent-soft)');
    expect(PUBLIC_CSS_SERVIDO).toMatch(/\.fi\[disabled\]/);
    expect(PUBLIC_CSS_SERVIDO).toMatch(/\.fi\.err/);
    // Erro nunca é só cor — tem de haver lugar para a mensagem.
    expect(PUBLIC_CSS_SERVIDO).toContain('.fi-erro{');
  });

  it('o laranja é do CTA de compra, e o CTA de compra é laranja', () => {
    // A regra do desenho: um acento manda (ciano); laranja só onde há decisão
    // de compra. Se alguém pintar o primário de laranja, cai aqui.
    expect(PUBLIC_CSS_SERVIDO).toContain('.btn-cta{background:var(--cta-gradient)');
    expect(PUBLIC_CSS_SERVIDO).toContain('.btn-primary{background:var(--accent)');
  });
});

describe('o topo de toda página leva à compra', () => {
  /**
   * O cabeçalho aparece em toda página do site. Até 31/ago ele levava só para
   * o login — a única porta de conversão no topo era "Entrar", que é para quem
   * JÁ comprou. O protótipo do cabeçalho traz "Matricular-se" no degradê
   * laranja, e é essa a chamada que estava faltando.
   */
  it('o cabeçalho tem a CTA de matrícula em laranja', () => {
    expect(layout).toContain('btn-topo-cta');
    expect(layout).toMatch(/class="btn btn-cta btn-topo-cta" href="\/formacoes"/);
  });

  it('a CTA do cabeçalho não aponta para rota que redireciona', () => {
    // /catalogo, /comparar e /landing viraram 301 em 30/ago. Link interno para
    // 301 foi exatamente o defeito que devolvia o comprador para a lista.
    const alvos = [...layout.matchAll(/class="[^"]*btn-cta[^"]*" href="([^"]+)"/g)].map((m) => m[1]);
    expect(alvos.length).toBeGreaterThan(0);
    for (const alvo of alvos) {
      expect(['/catalogo', '/comparar', '/landing']).not.toContain(alvo);
    }
  });

  it('no celular a CTA e o login vivem dentro do menu aberto', () => {
    expect(layout).toContain('class="nav-cta" href="/formacoes"');
    expect(layout).toContain('class="nav-entrar" href="/login"');
    // Escondidos por padrão; só as media queries os acendem.
    expect(PUBLIC_CSS_SERVIDO).toContain('.nav-cta,.nav-entrar{display:none}');
    expect(PUBLIC_CSS_SERVIDO).toContain('.nav.open .nav-cta{');
    expect(PUBLIC_CSS_SERVIDO).toContain('.nav.open .nav-entrar{');
  });

  it('o herói da home abre com a CTA grande, não com a ação secundária', () => {
    expect(router).toMatch(/class="btn btn-cta btn-lg" href="\/formacoes"/);
  });
});

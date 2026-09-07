/**
 * O menu mobile do site público precisa ser um diálogo de verdade.
 *
 * O teste E2E `e2e/mobile-smoke.spec.ts` cobrava isso desde 5/set/2026 e ficava
 * vermelho: o painel era um `<nav>` com uma classe `.open`, sem papel de
 * diálogo, sem Esc e sem foco preso. A CI ficou vermelha em onze commits
 * seguidos, e o deploy automático — que roda condicionado a ela — não rodou em
 * nenhum deles.
 *
 * Este teste existe porque o E2E é caro e roda tarde: ele prova o mesmo
 * contrato em milissegundos, na suíte que quem programa roda antes de commitar.
 *
 * O que ele NÃO pode deixar passar, e é a razão de o papel ser dinâmico: o
 * mesmo `<nav>` é a barra de navegação no desktop. Um `role="dialog"` fixo no
 * markup mentiria em toda tela larga.
 *
 * O script é avaliado UMA vez: seus ouvintes vivem em `document`, e avaliá-lo
 * por caso empilharia handlers — dois toggles no mesmo clique se anulariam, e
 * o teste passaria a medir a si mesmo.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { renderPage } from '../server/public/layout';
import { PUBLIC_JS } from '../server/public/client';

let htmlServido = '';
let corpo = '';

function tecla(key: string, shiftKey = false) {
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }),
  );
}

const botao = () => document.querySelector('[data-menu-toggle]') as HTMLButtonElement;
const painel = () => document.getElementById('site-nav') as HTMLElement;

beforeAll(async () => {
  htmlServido = String(
    await renderPage({
      title: 'Teste',
      description: 'Página de teste',
      path: '/',
      bodyHtml: 'conteúdo',
    }),
  );
  corpo = htmlServido.slice(htmlServido.indexOf('<body'), htmlServido.indexOf('</body>'));
  corpo = corpo.slice(corpo.indexOf('>') + 1);
  new Function(PUBLIC_JS)();
});

beforeEach(() => {
  document.body.innerHTML = corpo;
  // O estado "aberto" vive no fechamento do script, não no DOM: Esc o zera
  // mesmo depois de o painel anterior ter sido substituído.
  tecla('Escape');
});

describe('menu mobile do site público', () => {
  it('o HTML servido não anuncia um diálogo — no desktop o mesmo nav é a navegação', () => {
    expect(htmlServido).not.toMatch(/role="dialog"/);
    expect(htmlServido).toMatch(/id="site-nav"/);
    expect(htmlServido).toMatch(/aria-label="Principal"/);
    // O botão precisa existir, dizer o próprio nome e apontar para o painel.
    expect(htmlServido).toMatch(/aria-label="Menu"/);
    expect(htmlServido).toMatch(/aria-expanded="false"/);
    expect(htmlServido).toMatch(/aria-controls="site-nav"/);
  });

  it('abrir vira diálogo com nome acessível e leva o foco para dentro', () => {
    botao().click();

    expect(painel().classList.contains('open')).toBe(true);
    expect(painel().getAttribute('role')).toBe('dialog');
    expect(painel().getAttribute('aria-modal')).toBe('true');
    expect(painel().getAttribute('aria-label')).toMatch(/menu/i);
    expect(botao().getAttribute('aria-expanded')).toBe('true');
    // O foco tem de estar DENTRO do painel, não continuar no botão.
    expect(painel().contains(document.activeElement)).toBe(true);
  });

  it('Esc fecha, devolve o papel de navegação e o foco ao botão', () => {
    botao().click();

    tecla('Escape');

    expect(painel().classList.contains('open')).toBe(false);
    expect(painel().hasAttribute('role')).toBe(false);
    expect(painel().hasAttribute('aria-modal')).toBe(false);
    expect(painel().getAttribute('aria-label')).toBe('Principal');
    expect(botao().getAttribute('aria-expanded')).toBe('false');
    // Quem fechou pelo teclado não pode ficar com o foco no nada.
    expect(document.activeElement).toBe(botao());
  });

  it('o Tab não escapa do painel aberto', () => {
    botao().click();

    const focaveis = Array.from(
      painel().querySelectorAll<HTMLElement>('a[href],button:not([disabled])'),
    );
    expect(focaveis.length).toBeGreaterThan(1);
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];

    ultimo.focus();
    tecla('Tab');
    expect(document.activeElement).toBe(primeiro);

    tecla('Tab', true);
    expect(document.activeElement).toBe(ultimo);
  });

  it('clique fora fecha, porque o painel não tem cortina', () => {
    botao().click();
    expect(painel().classList.contains('open')).toBe(true);

    // Um elemento real fora do painel: a logomarca, no mesmo cabeçalho.
    (document.querySelector('.brand') as HTMLElement).dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );

    expect(painel().classList.contains('open')).toBe(false);
    expect(painel().hasAttribute('role')).toBe(false);
  });

  it('o botão alterna: segundo toque fecha', () => {
    botao().click();
    expect(painel().classList.contains('open')).toBe(true);
    botao().click();
    expect(painel().classList.contains('open')).toBe(false);
    expect(botao().getAttribute('aria-expanded')).toBe('false');
  });
});

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import VideoAula, { ehArquivoDeMidia } from '../src/app/components/VideoAula';
import { montarCsp, HOST_DO_PLAYER } from '../server/public/csp';

/**
 * Por que estes testes existem.
 *
 * As aulas não tocavam em produção, e a explicação corrente era a Vimeo — que
 * restringe embed por domínio. Medido, o domínio estava autorizado: o player
 * respondia 200 com o `Referer` do site e 403 sem ele. As duas causas reais
 * eram nossas, e nenhuma aparecia em teste:
 *
 * 1. A CSP não emitia `frame-src` quando não havia tag de marketing, então caía
 *    em `default-src 'self'` e o próprio site bloqueava o player.
 * 2. O site responde `Referrer-Policy: same-origin` (posto por um proxy à
 *    frente), o que zera o `Referer` para terceiros — e sem ele a Vimeo recusa.
 *    A política por elemento no iframe vence a do documento.
 *
 * Some-se a preview pública, que usava `<video>` para uma URL de embed: HTML
 * não toca em tag de mídia, e ela nunca funcionou.
 */

const SEM_TAGS = { script: [], img: [], connect: [], frame: [] };

describe('CSP: o site não pode bloquear o próprio player', () => {
  it('libera o player mesmo sem tag de marketing cadastrada', () => {
    const csp = montarCsp(SEM_TAGS);
    expect(csp).toContain(`frame-src 'self' ${HOST_DO_PLAYER}`);
  });

  it('sem frame-src o player cairia em default-src — que é só self', () => {
    const csp = montarCsp(SEM_TAGS);
    expect(csp).toContain("default-src 'self'");
    // A diretiva precisa EXISTIR: é a ausência dela que causava o bloqueio.
    expect(csp.includes('frame-src')).toBe(true);
  });

  it('os hosts de marketing continuam entrando junto, não no lugar', () => {
    const csp = montarCsp({
      script: ['https://www.googletagmanager.com'],
      img: [],
      connect: [],
      frame: ['https://www.googletagmanager.com'],
    });
    expect(csp).toContain(`frame-src 'self' ${HOST_DO_PLAYER} https://www.googletagmanager.com`);
    expect(csp).toContain("script-src 'self' https://www.googletagmanager.com");
  });

  it('não afrouxa script-src: nada de unsafe-inline', () => {
    expect(montarCsp(SEM_TAGS)).not.toContain("script-src 'self' 'unsafe-inline'");
  });
});

describe('VideoAula', () => {
  const VIMEO = 'https://player.vimeo.com/video/1131295150';

  it('URL de embed vira iframe, não tag de vídeo', () => {
    const { container } = render(<VideoAula url={VIMEO} titulo="Aula 1" />);
    expect(container.querySelector('iframe')).not.toBeNull();
    expect(container.querySelector('video')).toBeNull();
  });

  it('o iframe manda o referer — é isso que a Vimeo exige', () => {
    const { container } = render(<VideoAula url={VIMEO} titulo="Aula 1" />);
    const frame = container.querySelector('iframe')!;
    // `same-origin` do proxy zeraria o referer; a política do elemento vence.
    expect(frame.getAttribute('referrerpolicy')).toBe('strict-origin-when-cross-origin');
  });

  it('arquivo de mídia solto continua no player nativo', () => {
    const { container } = render(
      <VideoAula url="https://exemplo.test/uploads/aula.mp4" titulo="Aula 2" />,
    );
    expect(container.querySelector('video')).not.toBeNull();
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('reconhece arquivo mesmo com query string', () => {
    expect(ehArquivoDeMidia('https://x.test/a.mp4?v=2')).toBe(true);
    expect(ehArquivoDeMidia('https://player.vimeo.com/video/123')).toBe(false);
    expect(ehArquivoDeMidia('https://www.youtube.com/embed/abc')).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import { urlDeEmbed } from '../src/app/lib/videoEmbed';

/**
 * Os podcasts em vídeo não tocavam — nenhum.
 *
 * O acervo que veio do LMS antigo guardou `videoUrl` como
 * `https://vimeo.com/1116765460`: a URL da página de assistir, não a do
 * player. `VideoAula` punha isso direto no `<iframe src>`, e aí:
 *
 * 1. `vimeo.com/<id>` é a página do site da Vimeo e recusa ser embutida
 *    (`X-Frame-Options`) — nenhum `Referer` conserta;
 * 2. a CSP libera `frame-src` só para `player.vimeo.com`, então `vimeo.com`
 *    nem carrega.
 *
 * As aulas escaparam porque o HTML de embed do LearnDash já vinha com
 * `player.vimeo.com/video/<id>`. Medido contra a Vimeo: 40 dos 43 vídeos
 * respondem 200 no endereço de player com o nosso `Referer` — ou seja, o
 * problema era 100% a forma da URL, não a conta.
 *
 * `urlDeEmbed` normaliza no ponto único (`VideoAula`), o que conserta o acervo
 * inteiro sem tocar no banco.
 */

describe('urlDeEmbed', () => {
  it('a URL da página vira a URL do player — o caso do acervo', () => {
    expect(urlDeEmbed('https://vimeo.com/1116765460')).toBe(
      'https://player.vimeo.com/video/1116765460',
    );
  });

  it('é idempotente: a URL de player já boa não muda', () => {
    const boa = 'https://player.vimeo.com/video/1116765460';
    expect(urlDeEmbed(boa)).toBe(boa);
    expect(urlDeEmbed('https://player.vimeo.com/video/123?h=abc&autopause=0')).toBe(
      'https://player.vimeo.com/video/123?h=abc&autopause=0',
    );
  });

  it('preserva o hash do vídeo não listado', () => {
    // vimeo.com/<id>/<hash> — o token que libera o embed de um vídeo oculto.
    expect(urlDeEmbed('https://vimeo.com/1116765460/9f2ab7c1d4')).toBe(
      'https://player.vimeo.com/video/1116765460?h=9f2ab7c1d4',
    );
  });

  it('aceita as variações de vimeo.com', () => {
    expect(urlDeEmbed('https://www.vimeo.com/1116765460')).toBe(
      'https://player.vimeo.com/video/1116765460',
    );
    expect(urlDeEmbed('http://vimeo.com/1116765460')).toBe(
      'https://player.vimeo.com/video/1116765460',
    );
    expect(urlDeEmbed('https://vimeo.com/channels/staffpicks/1116765460')).toBe(
      'https://player.vimeo.com/video/1116765460',
    );
    expect(urlDeEmbed('https://vimeo.com/groups/psi/videos/1116765460')).toBe(
      'https://player.vimeo.com/video/1116765460',
    );
  });

  it('converte o watch do YouTube para o embed', () => {
    expect(urlDeEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
    );
    expect(urlDeEmbed('https://youtu.be/dQw4w9WgXcQ')).toBe(
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
    );
    // com parâmetros extras antes do v=
    expect(urlDeEmbed('https://www.youtube.com/watch?feature=share&v=dQw4w9WgXcQ')).toBe(
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
    );
  });

  it('o que não reconhece volta como veio — não inventa', () => {
    expect(urlDeEmbed('https://uploads.exemplo.com/aula.mp4')).toBe(
      'https://uploads.exemplo.com/aula.mp4',
    );
    expect(urlDeEmbed('')).toBe('');
    expect(urlDeEmbed('   ')).toBe('');
  });

  it('todo endereço de player que sai daqui está na whitelist da CSP', () => {
    // A CSP libera frame-src só para player.vimeo.com e (se um dia) youtube.
    // O que urlDeEmbed produz TEM de casar, senão o iframe não carrega.
    const entradas = [
      'https://vimeo.com/1116765460',
      'https://vimeo.com/1116765460/abc123',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    ];
    for (const e of entradas) {
      const saida = urlDeEmbed(e);
      expect(
        /^https:\/\/(player\.vimeo\.com\/video\/|www\.youtube\.com\/embed\/)/.test(saida),
        `${e} → ${saida} não é um host de player conhecido`,
      ).toBe(true);
    }
  });
});

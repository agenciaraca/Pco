import { describe, it, expect } from 'vitest';
import {
  applyTransforms,
  listTransformNames,
  DEFAULT_WC_STATUS_MAP,
} from '../server/imports/pipeline/transforms';

describe('transforms pipeline', () => {
  it('lista todos os transforms disponíveis', () => {
    const names = listTransformNames();
    expect(names).toContain('trim');
    expect(names).toContain('lowercase');
    expect(names).toContain('parse_date');
    expect(names).toContain('parse_money');
    expect(names).toContain('parse_boolean');
    expect(names.length).toBeGreaterThanOrEqual(10);
  });

  it('aplica transforms em sequência', () => {
    expect(applyTransforms('  HELLO WORLD  ', ['trim', 'lowercase'])).toBe(
      'hello world',
    );
  });

  it('ignora pipeline vazio ou undefined', () => {
    expect(applyTransforms('xyz', [])).toBe('xyz');
    expect(applyTransforms('xyz', undefined)).toBe('xyz');
  });

  it('ignora nome desconhecido sem quebrar', () => {
    expect(applyTransforms('abc', ['trim', 'unknown_transform', 'uppercase'])).toBe(
      'ABC',
    );
  });

  it('parse_date aceita ISO, YYYY-MM-DD e DD/MM/YYYY', () => {
    const a = applyTransforms('2024-03-15', ['parse_date']) as string;
    const b = applyTransforms('15/03/2024', ['parse_date']) as string;
    const c = applyTransforms('2024-03-15T10:30:00Z', ['parse_date']) as string;
    expect(a).toContain('2024-03-15');
    expect(b).toContain('2024-03-15');
    expect(c).toContain('2024-03-15');
  });

  it('parse_date retorna null para input vazio', () => {
    expect(applyTransforms('', ['parse_date'])).toBeNull();
  });

  it('parse_money: BRL formato brasileiro', () => {
    expect(applyTransforms('R$ 1.234,56', ['parse_money'])).toBe(123456);
    expect(applyTransforms('199,90', ['parse_money'])).toBe(19990);
  });

  it('parse_money: formato US ou simples', () => {
    expect(applyTransforms('199.90', ['parse_money'])).toBe(19990);
    expect(applyTransforms('1234.56', ['parse_money'])).toBe(123456);
  });

  it('parse_money: número direto', () => {
    expect(applyTransforms(199.9, ['parse_money'])).toBe(19990);
  });

  it('parse_boolean reconhece variantes', () => {
    expect(applyTransforms('true', ['parse_boolean'])).toBe(true);
    expect(applyTransforms('yes', ['parse_boolean'])).toBe(true);
    expect(applyTransforms('sim', ['parse_boolean'])).toBe(true);
    expect(applyTransforms('1', ['parse_boolean'])).toBe(true);
    expect(applyTransforms('false', ['parse_boolean'])).toBe(false);
    expect(applyTransforms('0', ['parse_boolean'])).toBe(false);
  });

  it('titlecase capitaliza cada palavra', () => {
    expect(applyTransforms('joão da SILVA', ['titlecase'])).toBe('João Da Silva');
  });

  /**
   * A URL de vídeo é extraída de dentro de um atributo HTML, e ali `&` vem
   * escapado. Sem desfazer, `?autopause=0&amp;dnt=true` chega ao player como
   * os parâmetros `amp;autopause` e `amp;dnt` — que o Vimeo ignora em silêncio:
   * o vídeo toca e a configuração não vale. Três aulas em produção estavam
   * assim, e nada na tela denunciava.
   */
  describe('extract_video_url', () => {
    it('desfaz o &amp; que veio do atributo HTML', () => {
      expect(
        applyTransforms(
          '<iframe src="https://player.vimeo.com/video/656716015?autopause=0&amp;dnt=true"></iframe>',
          ['extract_video_url'],
        ),
      ).toBe('https://player.vimeo.com/video/656716015?autopause=0&dnt=true');
    });

    it('URL já limpa passa intacta', () => {
      const url = 'https://player.vimeo.com/video/652548705?autopause=0&loop=0';
      expect(applyTransforms(url, ['extract_video_url'])).toBe(url);
    });

    it('sem URL de vídeo, devolve o valor original', () => {
      expect(applyTransforms('nenhum vídeo aqui', ['extract_video_url'])).toBe('nenhum vídeo aqui');
    });

    it('desescapar acontece depois de casar, não antes', () => {
      // `&lt;` antes do casamento viraria `<`, e o regex para em `<`: a URL
      // seria cortada no meio. Depois, ele fica onde está.
      expect(
        applyTransforms('src="https://youtu.be/abcdefghijk?x=1&amp;y=2"', ['extract_video_url']),
      ).toBe('https://youtu.be/abcdefghijk?x=1&y=2');
    });
  });

  it('DEFAULT_WC_STATUS_MAP cobre status WooCommerce comuns', () => {
    expect(DEFAULT_WC_STATUS_MAP.completed).toBe('active');
    expect(DEFAULT_WC_STATUS_MAP.pending).toBe('pending');
    expect(DEFAULT_WC_STATUS_MAP.cancelled).toBe('cancelled');
    expect(DEFAULT_WC_STATUS_MAP.refunded).toBe('cancelled');
  });
});

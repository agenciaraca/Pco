import { describe, it, expect } from 'vitest';
import {
  identificarVideo,
  iso8601ParaMinutos,
  segundosParaMinutos,
} from '../scripts/resolver_duracoes_aulas';

/**
 * Duração real das aulas.
 *
 * O import gravou 15 minutos para todas — número que não veio de lugar nenhum e
 * que distorce toda métrica de estudo que o aluno vê. A duração de verdade está
 * no vídeo.
 *
 * Estes testes cobrem as partes puras, que são onde um erro passaria sem ser
 * notado: reconhecer o vídeo na URL e converter a duração. A busca no provedor
 * é rede e fica de fora — o que ela devolve é problema do provedor; o que este
 * script faz com o que recebe é problema nosso.
 */

describe('identificar o vídeo na URL', () => {
  it('reconhece os formatos que o scraper grava', () => {
    // scripts/scrape_lesson_media.ts normaliza para estes dois.
    expect(identificarVideo('https://www.youtube.com/embed/dQw4w9WgXcQ')).toEqual({
      provedor: 'youtube',
      id: 'dQw4w9WgXcQ',
    });
    expect(identificarVideo('https://player.vimeo.com/video/123456789')).toEqual({
      provedor: 'vimeo',
      id: '123456789',
    });
  });

  it('reconhece também as formas soltas que sobraram de imports antigos', () => {
    expect(identificarVideo('https://youtu.be/dQw4w9WgXcQ')?.id).toBe('dQw4w9WgXcQ');
    expect(identificarVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ')?.id).toBe(
      'dQw4w9WgXcQ',
    );
    expect(identificarVideo('https://vimeo.com/987654321')?.id).toBe('987654321');
    expect(identificarVideo('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')?.provedor).toBe(
      'youtube',
    );
  });

  it('devolve null para o que não é vídeo — e null vira "não mexer"', () => {
    expect(identificarVideo(null)).toBeNull();
    expect(identificarVideo(undefined)).toBeNull();
    expect(identificarVideo('')).toBeNull();
    expect(identificarVideo('https://open.spotify.com/episode/abc')).toBeNull();
    expect(identificarVideo('https://exemplo.com/aula.mp4')).toBeNull();
  });
});

describe('converter duração', () => {
  it('lê o formato ISO-8601 do YouTube', () => {
    expect(iso8601ParaMinutos('PT15M')).toBe(15);
    expect(iso8601ParaMinutos('PT1H')).toBe(60);
    expect(iso8601ParaMinutos('PT1H30M')).toBe(90);
  });

  it('arredonda para cima: 14min01s é uma aula de 15, não de 14', () => {
    expect(iso8601ParaMinutos('PT14M1S')).toBe(15);
    expect(iso8601ParaMinutos('PT30S')).toBe(1);
    expect(segundosParaMinutos(841)).toBe(15);
    expect(segundosParaMinutos(1)).toBe(1);
  });

  it('duração ausente ou zerada NÃO vira zero minutos', () => {
    // Zero seria gravado como duração legítima e sumiria com a aula das
    // métricas. Melhor não resolver do que resolver errado.
    expect(iso8601ParaMinutos('PT0S')).toBeNull();
    expect(iso8601ParaMinutos('lixo')).toBeNull();
    expect(iso8601ParaMinutos('')).toBeNull();
    expect(segundosParaMinutos(0)).toBeNull();
    expect(segundosParaMinutos(-5)).toBeNull();
    expect(segundosParaMinutos(Number.NaN)).toBeNull();
  });
});

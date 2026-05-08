import { describe, it, expect } from 'vitest';
import { inferFilenameFromUrl } from '../server/ai/whisper';

describe('Whisper helpers', () => {
  describe('inferFilenameFromUrl', () => {
    it('extrai filename de URL com extensao', () => {
      expect(inferFilenameFromUrl('https://cdn.example.com/videos/aula-01.mp4')).toBe(
        'aula-01.mp4',
      );
    });

    it('adiciona .mp4 se nao tem extensao', () => {
      expect(inferFilenameFromUrl('https://cdn.example.com/v/abc123')).toBe(
        'abc123.mp4',
      );
    });

    it('fallback pra video.mp4 em URL invalida', () => {
      expect(inferFilenameFromUrl('not a url')).toBe('video.mp4');
    });

    it('preserva m4a/wav/etc', () => {
      expect(inferFilenameFromUrl('https://x.com/a/audio.m4a')).toBe('audio.m4a');
      expect(inferFilenameFromUrl('https://x.com/a/track.wav')).toBe('track.wav');
    });

    it('lida com query string', () => {
      // URL.pathname ignora query, então retorna só o path
      expect(inferFilenameFromUrl('https://x.com/a/aula.mp4?t=10')).toBe(
        'aula.mp4',
      );
    });

    it('aceita slash final', () => {
      // se path termina com /, last é '' → audio.mp4
      const r = inferFilenameFromUrl('https://x.com/');
      // O fallback retorna 'audio' que ganha .mp4
      expect(r).toMatch(/\.mp4$/);
    });
  });
});

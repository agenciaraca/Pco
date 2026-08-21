import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
  const base = process.env.TEMP ?? process.env.TMPDIR ?? '/tmp';
  process.env.DATA_DIR = `${base}/ava-pco-conteudo-${process.pid}-${Date.now()}`;
});

import { createLessonSchema, updateLessonSchema } from '../shared/schemas';

// A aula tem DOIS campos de texto, e a diferença entre eles custou caro: a
// importação gravou `description` cortada em 500 caracteres e `content` inteiro,
// mas a tabela não tinha coluna para o conteúdo. Resultado: 309 aulas em
// produção terminando no meio da frase, com o texto completo dormindo num
// arquivo. Estes testes fixam o contrato para que a distinção não se perca.

describe('conteúdo da aula — o campo que faltava no banco', () => {
  it('o contrato aceita conteúdo longo, não só o resumo', () => {
    // 500 caracteres é o tamanho do corte que causou o problema; o conteúdo
    // real chega a 24 mil.
    const longo = 'a'.repeat(24_000);
    const r = createLessonSchema.safeParse({
      title: 'Aula com texto de verdade',
      order: 1,
      content: longo,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.content).toHaveLength(24_000);
  });

  it('descrição continua limitada — ela é resumo, não corpo da aula', () => {
    const r = createLessonSchema.safeParse({
      title: 'Aula',
      order: 1,
      description: 'a'.repeat(4_001),
    });
    expect(r.success).toBe(false);
  });

  it('aula sem conteúdo continua válida — vídeo-aula não tem corpo de texto', () => {
    const r = createLessonSchema.safeParse({ title: 'Vídeo-aula', order: 1 });
    expect(r.success).toBe(true);
  });

  it('o patch permite gravar só o conteúdo, sem tocar no resto', () => {
    // É exatamente o que o script de restauração faz: preenche o conteúdo e não
    // encosta em título, ordem nem descrição.
    const r = updateLessonSchema.safeParse({ content: '<p>Texto integral</p>' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.content).toBe('<p>Texto integral</p>');
      expect(r.data.description).toBeUndefined();
      expect(r.data.title).toBeUndefined();
    }
  });

  it('há um teto, para que HTML corrompido não vire uma linha de 5 MB', () => {
    const r = createLessonSchema.safeParse({
      title: 'Aula',
      order: 1,
      content: 'a'.repeat(200_001),
    });
    expect(r.success).toBe(false);
  });
});

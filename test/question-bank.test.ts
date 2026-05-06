import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let bank: typeof import('../server/repositories/question-bank');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-qbank-'));
  process.env.DATA_DIR = tmpDir;
  bank = await import('../server/repositories/question-bank');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

beforeEach(async () => {
  await bank._resetForTests();
});

const validMc = {
  courseId: 'c1',
  type: 'multiple_choice' as const,
  prompt: 'Qual é o conceito chave de Lacan sobre o estádio do espelho?',
  options: [
    { text: 'A formação do eu como imagem', correct: true },
    { text: 'O complexo de Édipo', correct: false },
    { text: 'O recalcamento primário', correct: false },
  ],
};

const validTf = {
  courseId: 'c1',
  type: 'true_false' as const,
  prompt: 'O inconsciente é estruturado como uma linguagem.',
  options: [
    { text: 'Verdadeiro', correct: true },
    { text: 'Falso', correct: false },
  ],
};

describe('question-bank', () => {
  describe('createQuestion validation', () => {
    it('cria multiple_choice válida', async () => {
      const q = await bank.createQuestion(validMc);
      expect(q.id).toMatch(/^q-/);
      expect(q.options).toHaveLength(3);
      expect(q.options[0].id).toMatch(/^o-/);
      expect(q.tags).toEqual([]);
      expect(q.difficulty).toBe(3);
      expect(q.active).toBe(true);
    });

    it('cria true_false válida', async () => {
      const q = await bank.createQuestion(validTf);
      expect(q.type).toBe('true_false');
    });

    it('rejeita tipo inválido', async () => {
      await expect(
        bank.createQuestion({ ...validMc, type: 'essay' as never }),
      ).rejects.toMatchObject({ code: 'INVALID_TYPE' });
    });

    it('rejeita prompt vazio', async () => {
      await expect(
        bank.createQuestion({ ...validMc, prompt: '   ' }),
      ).rejects.toMatchObject({ code: 'INVALID_PROMPT' });
    });

    it('rejeita multiple_choice com 1 opção', async () => {
      await expect(
        bank.createQuestion({ ...validMc, options: [{ text: 'a', correct: true }] }),
      ).rejects.toMatchObject({ code: 'INVALID_OPTIONS' });
    });

    it('rejeita multiple_choice com 7 opções', async () => {
      await expect(
        bank.createQuestion({
          ...validMc,
          options: Array.from({ length: 7 }, (_, i) => ({
            text: `opt${i}`,
            correct: i === 0,
          })),
        }),
      ).rejects.toMatchObject({ code: 'INVALID_OPTIONS' });
    });

    it('rejeita true_false com 3 opções', async () => {
      await expect(
        bank.createQuestion({
          ...validTf,
          options: [
            { text: 'a', correct: true },
            { text: 'b', correct: false },
            { text: 'c', correct: false },
          ],
        }),
      ).rejects.toMatchObject({ code: 'INVALID_OPTIONS' });
    });

    it('rejeita sem nenhuma opção correta', async () => {
      await expect(
        bank.createQuestion({
          ...validMc,
          options: validMc.options.map((o) => ({ ...o, correct: false })),
        }),
      ).rejects.toMatchObject({ code: 'NO_CORRECT' });
    });

    it('rejeita true_false com 2 corretas', async () => {
      await expect(
        bank.createQuestion({
          ...validTf,
          options: [
            { text: 'V', correct: true },
            { text: 'F', correct: true },
          ],
        }),
      ).rejects.toMatchObject({ code: 'NO_CORRECT' });
    });

    it('aceita multiple_choice com múltiplas corretas (multi-select)', async () => {
      const q = await bank.createQuestion({
        ...validMc,
        options: [
          { text: 'a', correct: true },
          { text: 'b', correct: true },
          { text: 'c', correct: false },
        ],
      });
      expect(q.options.filter((o) => o.correct)).toHaveLength(2);
    });

    it('clamp difficulty pra 1-5', async () => {
      const q1 = await bank.createQuestion({ ...validMc, difficulty: 0 });
      expect(q1.difficulty).toBe(1);
      await bank._resetForTests();
      const q2 = await bank.createQuestion({ ...validMc, difficulty: 999 });
      expect(q2.difficulty).toBe(5);
    });

    it('normaliza tags em lowercase', async () => {
      const q = await bank.createQuestion({
        ...validMc,
        tags: ['Lacan', 'FUNDAMENTOS', '  Espelho  '],
      });
      expect(q.tags).toEqual(['lacan', 'fundamentos', 'espelho']);
    });
  });

  describe('updateQuestion', () => {
    it('atualiza prompt e mantém options', async () => {
      const q = await bank.createQuestion(validMc);
      const u = await bank.updateQuestion(q.id, { prompt: 'Novo enunciado' });
      expect(u.prompt).toBe('Novo enunciado');
      expect(u.options).toHaveLength(3);
    });

    it('atualiza tipo + options junto', async () => {
      const q = await bank.createQuestion(validMc);
      const u = await bank.updateQuestion(q.id, {
        type: 'true_false',
        options: [
          { text: 'V', correct: true },
          { text: 'F', correct: false },
        ],
      });
      expect(u.type).toBe('true_false');
      expect(u.options).toHaveLength(2);
    });

    it('NOT_FOUND', async () => {
      await expect(bank.updateQuestion('q-x', { active: false })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  describe('listByCourse', () => {
    it('filtra por courseId', async () => {
      await bank.createQuestion(validMc);
      await bank.createQuestion({ ...validMc, courseId: 'c2' });
      const c1 = await bank.listByCourse('c1');
      expect(c1).toHaveLength(1);
    });
  });

  describe('sampleForQuiz', () => {
    it('retorna até maxQuestions de questões ativas', async () => {
      for (let i = 0; i < 5; i++) {
        await bank.createQuestion({ ...validMc, prompt: `Q${i + 1}` });
      }
      const sample = await bank.sampleForQuiz('c1', 3);
      expect(sample).toHaveLength(3);
    });

    it('ignora questões inativas', async () => {
      const q = await bank.createQuestion(validMc);
      await bank.updateQuestion(q.id, { active: false });
      const sample = await bank.sampleForQuiz('c1', 5);
      expect(sample).toHaveLength(0);
    });

    it('filtra por moduleId quando passado', async () => {
      await bank.createQuestion({ ...validMc, moduleId: 'm1' });
      await bank.createQuestion({ ...validMc, moduleId: 'm2' });
      const m1 = await bank.sampleForQuiz('c1', 10, 'm1');
      expect(m1).toHaveLength(1);
      expect(m1[0].moduleId).toBe('m1');
    });
  });

  describe('gradeAnswer', () => {
    it('correto quando aluno marca exatamente as opções corretas', async () => {
      const q = await bank.createQuestion(validMc);
      const correctIds = q.options.filter((o) => o.correct).map((o) => o.id);
      const r = bank.gradeAnswer(q, correctIds);
      expect(r.correct).toBe(true);
      expect(r.correctOptionIds).toEqual(correctIds);
    });

    it('incorreto se faltou marcar uma correta', async () => {
      const q = await bank.createQuestion({
        ...validMc,
        options: [
          { text: 'a', correct: true },
          { text: 'b', correct: true },
          { text: 'c', correct: false },
        ],
      });
      const correctIds = q.options.filter((o) => o.correct).map((o) => o.id);
      const r = bank.gradeAnswer(q, [correctIds[0]]); // só 1 das 2
      expect(r.correct).toBe(false);
    });

    it('incorreto se marcou opção errada', async () => {
      const q = await bank.createQuestion(validMc);
      const wrongId = q.options.find((o) => !o.correct)!.id;
      const r = bank.gradeAnswer(q, [wrongId]);
      expect(r.correct).toBe(false);
    });

    it('incorreto sem nenhuma marcação', async () => {
      const q = await bank.createQuestion(validMc);
      const r = bank.gradeAnswer(q, []);
      expect(r.correct).toBe(false);
    });
  });

  describe('deleteQuestion', () => {
    it('deleta e retorna true', async () => {
      const q = await bank.createQuestion(validMc);
      expect(await bank.deleteQuestion(q.id)).toBe(true);
      expect(await bank.findById(q.id)).toBeNull();
    });

    it('false se não existe', async () => {
      expect(await bank.deleteQuestion('q-nope')).toBe(false);
    });
  });
});

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let bank: typeof import('../server/repositories/question-bank');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-qbank-oe-'));
  process.env.DATA_DIR = tmpDir;
  process.env.AI_KEY_ENCRYPTION_SECRET = 'a'.repeat(64);
  bank = await import('../server/repositories/question-bank');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

beforeEach(async () => {
  await bank._resetForTests();
});

const validOpenEnded = {
  courseId: 'c1',
  type: 'open_ended' as const,
  prompt: 'Explique o conceito de transferência em Freud.',
  expectedAnswer: 'A transferência é o deslocamento de sentimentos do paciente para o analista.',
};

describe('question-bank open_ended', () => {
  describe('createQuestion', () => {
    it('cria questão open_ended sem options', async () => {
      const q = await bank.createQuestion(validOpenEnded);
      expect(q.type).toBe('open_ended');
      expect(q.options).toEqual([]);
      expect(q.expectedAnswer).toBe(validOpenEnded.expectedAnswer);
      expect(q.prompt).toBe(validOpenEnded.prompt);
    });

    it('open_ended sem expectedAnswer é válido', async () => {
      const q = await bank.createQuestion({
        courseId: 'c1',
        type: 'open_ended',
        prompt: 'Discorra sobre o conceito de pulsão.',
        options: [],
      });
      expect(q.type).toBe('open_ended');
      expect(q.expectedAnswer).toBeUndefined();
    });

    it('open_ended ignora options passadas', async () => {
      const q = await bank.createQuestion({
        ...validOpenEnded,
        options: [{ text: 'ignorar', correct: true }],
      });
      expect(q.options).toEqual([]);
    });

    it('open_ended valida prompt', async () => {
      await expect(
        bank.createQuestion({
          courseId: 'c1',
          type: 'open_ended',
          prompt: '',
          options: [],
        }),
      ).rejects.toThrow('Enunciado');
    });
  });

  describe('updateQuestion', () => {
    it('atualiza expectedAnswer de open_ended', async () => {
      const q = await bank.createQuestion(validOpenEnded);
      const updated = await bank.updateQuestion(q.id, {
        expectedAnswer: 'Nova rubrica atualizada.',
      });
      expect(updated.expectedAnswer).toBe('Nova rubrica atualizada.');
    });
  });

  describe('sampleForQuiz', () => {
    it('inclui open_ended no sample', async () => {
      await bank.createQuestion(validOpenEnded);
      await bank.createQuestion({
        courseId: 'c1',
        type: 'multiple_choice',
        prompt: 'MC question',
        options: [
          { text: 'A', correct: true },
          { text: 'B', correct: false },
        ],
      });
      const sampled = await bank.sampleForQuiz('c1', 10);
      expect(sampled.length).toBe(2);
      const types = sampled.map((q) => q.type).sort();
      expect(types).toContain('open_ended');
      expect(types).toContain('multiple_choice');
    });
  });

  describe('gradeOpenEndedWithAi', () => {
    it('retorna null quando nenhum provider de grading configurado', async () => {
      const q = await bank.createQuestion(validOpenEnded);
      const result = await bank.gradeOpenEndedWithAi(q, 'Resposta do aluno aqui.');
      expect(result).toBeNull();
    });
  });

  describe('gradeAnswer com open_ended', () => {
    it('gradeAnswer retorna correct=true vacuamente para open_ended (sem options)', async () => {
      const q = await bank.createQuestion(validOpenEnded);
      const grade = bank.gradeAnswer(q, []);
      expect(grade.correct).toBe(true);
      expect(grade.correctOptionIds).toEqual([]);
    });
  });
});

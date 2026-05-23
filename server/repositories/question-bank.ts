// Banco de questões: questões reutilizáveis por curso/módulo. Permite
// criar avaliações com pool maior do que o número de questões aplicadas
// (ex: banco de 50, prova sorteia 10).

import crypto from 'node:crypto';
import { JsonStore } from '../db/json-store';
import { getActiveByModule } from '../ai/store';
import { getProvider } from '../ai/providers';

export type QuestionType = 'multiple_choice' | 'true_false' | 'open_ended';

export interface QuestionOption {
  id: string;
  text: string;
  /** Verdadeira pra essa alternativa? */
  correct: boolean;
}

export interface Question {
  id: string;
  /** Vínculo com curso (sempre). Módulo é opcional. */
  courseId: string;
  moduleId?: string;
  type: QuestionType;
  /** Enunciado da questão (pode usar markdown lite). */
  prompt: string;
  /** Para multiple_choice: 2-6 opções. Pra true_false: 2 fixas. Vazio para open_ended. */
  options: QuestionOption[];
  /** Resposta esperada/rubrica para correção IA (open_ended). */
  expectedAnswer?: string;
  /** Justificativa exibida após o aluno responder. */
  explanation?: string;
  /** Tags pra filtragem (ex: "fundamentos", "lacan"). */
  tags: string[];
  /** Difícil 1-5 (usado pra balancear sorteios). */
  difficulty: number;
  /** Ativa: pode entrar em sorteios novos. */
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

const store = new JsonStore<Question>('question-bank.json', () => []);

function newId(): string {
  return `q-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

function newOptionId(): string {
  return `o-${crypto.randomBytes(4).toString('hex')}`;
}

export class QuestionError extends Error {
  constructor(
    public code:
      | 'INVALID_PROMPT'
      | 'INVALID_OPTIONS'
      | 'INVALID_TYPE'
      | 'NO_CORRECT'
      | 'NOT_FOUND',
    message: string,
  ) {
    super(message);
    this.name = 'QuestionError';
  }
}

export interface CreateQuestionInput {
  courseId: string;
  moduleId?: string;
  type: QuestionType;
  prompt: string;
  options?: { text: string; correct: boolean }[];
  expectedAnswer?: string;
  explanation?: string;
  tags?: string[];
  difficulty?: number;
  active?: boolean;
}

const VALID_TYPES: QuestionType[] = ['multiple_choice', 'true_false', 'open_ended'];

function validateInput(input: CreateQuestionInput): void {
  if (!VALID_TYPES.includes(input.type)) {
    throw new QuestionError('INVALID_TYPE', `Tipo inválido: "${input.type}".`);
  }
  const prompt = input.prompt?.trim() ?? '';
  if (!prompt || prompt.length > 2000) {
    throw new QuestionError('INVALID_PROMPT', 'Enunciado deve ter 1-2000 caracteres.');
  }
  if (input.type === 'open_ended') {
    return;
  }
  if (!Array.isArray(input.options) || input.options.length === 0) {
    throw new QuestionError('INVALID_OPTIONS', 'options deve ser array.');
  }
  if (input.type === 'multiple_choice') {
    if (input.options.length < 2 || input.options.length > 6) {
      throw new QuestionError(
        'INVALID_OPTIONS',
        'Multiple choice precisa de 2-6 opções.',
      );
    }
  }
  if (input.type === 'true_false' && input.options.length !== 2) {
    throw new QuestionError(
      'INVALID_OPTIONS',
      'True/false precisa de exatamente 2 opções.',
    );
  }
  for (const o of input.options) {
    const text = o.text?.trim() ?? '';
    if (!text || text.length > 500) {
      throw new QuestionError(
        'INVALID_OPTIONS',
        'Cada opção precisa de 1-500 caracteres.',
      );
    }
  }
  const corrects = input.options.filter((o) => o.correct).length;
  if (corrects === 0) {
    throw new QuestionError('NO_CORRECT', 'Pelo menos uma opção deve ser correta.');
  }
  if (input.type === 'true_false' && corrects !== 1) {
    throw new QuestionError(
      'NO_CORRECT',
      'True/false aceita apenas uma opção correta.',
    );
  }
}

export async function createQuestion(input: CreateQuestionInput): Promise<Question> {
  validateInput(input);
  const now = new Date().toISOString();
  const q: Question = {
    id: newId(),
    courseId: input.courseId,
    moduleId: input.moduleId,
    type: input.type,
    prompt: input.prompt.trim(),
    options:
      input.type === 'open_ended'
        ? []
        : (input.options ?? []).map((o) => ({
            id: newOptionId(),
            text: o.text.trim(),
            correct: !!o.correct,
          })),
    expectedAnswer: input.type === 'open_ended' ? input.expectedAnswer?.trim() || undefined : undefined,
    explanation: input.explanation?.trim() || undefined,
    tags: (input.tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean),
    difficulty: clampDifficulty(input.difficulty ?? 3),
    active: input.active ?? true,
    createdAt: now,
    updatedAt: now,
  };
  await store.unshift(q);
  return q;
}

function clampDifficulty(n: number): number {
  if (!Number.isFinite(n)) return 3;
  return Math.max(1, Math.min(5, Math.round(n)));
}

export async function listAll(): Promise<Question[]> {
  return await store.getAll();
}

export async function listByCourse(courseId: string): Promise<Question[]> {
  return await store.filter((q) => q.courseId === courseId);
}

export async function findById(id: string): Promise<Question | null> {
  const all = await store.getAll();
  return all.find((q) => q.id === id) ?? null;
}

export interface UpdateQuestionInput {
  type?: QuestionType;
  prompt?: string;
  options?: { text: string; correct: boolean }[];
  expectedAnswer?: string;
  explanation?: string;
  tags?: string[];
  difficulty?: number;
  active?: boolean;
  moduleId?: string | null;
}

export async function updateQuestion(
  id: string,
  patch: UpdateQuestionInput,
): Promise<Question> {
  const q = await findById(id);
  if (!q) throw new QuestionError('NOT_FOUND', 'Questão não encontrada.');
  // Re-valida se afetar tipo/options
  if (patch.type !== undefined || patch.options !== undefined || patch.prompt !== undefined) {
    validateInput({
      courseId: q.courseId,
      type: patch.type ?? q.type,
      prompt: patch.prompt ?? q.prompt,
      options: patch.options ?? q.options.map((o) => ({ text: o.text, correct: o.correct })),
    });
  }
  const updates: Partial<Question> = {};
  if (patch.type !== undefined) updates.type = patch.type;
  if (patch.prompt !== undefined) updates.prompt = patch.prompt.trim();
  if (patch.options !== undefined) {
    updates.options = patch.options.map((o) => ({
      id: newOptionId(),
      text: o.text.trim(),
      correct: !!o.correct,
    }));
  }
  if (patch.expectedAnswer !== undefined)
    updates.expectedAnswer = patch.expectedAnswer.trim() || undefined;
  if (patch.explanation !== undefined)
    updates.explanation = patch.explanation.trim() || undefined;
  if (patch.tags !== undefined) {
    updates.tags = patch.tags.map((t) => t.trim().toLowerCase()).filter(Boolean);
  }
  if (patch.difficulty !== undefined) updates.difficulty = clampDifficulty(patch.difficulty);
  if (patch.active !== undefined) updates.active = patch.active;
  if (patch.moduleId !== undefined) {
    updates.moduleId = patch.moduleId ?? undefined;
  }
  updates.updatedAt = new Date().toISOString();
  await store.update((x) => x.id === id, (x) => Object.assign(x, updates));
  return (await findById(id))!;
}

export async function deleteQuestion(id: string): Promise<boolean> {
  const q = await findById(id);
  if (!q) return false;
  await store.modify((arr) => {
    const idx = arr.findIndex((x) => x.id === id);
    if (idx >= 0) arr.splice(idx, 1);
  });
  return true;
}

/**
 * Sorteia N questões ativas do curso. Se moduleId fornecido, filtra
 * apenas as desse módulo. Embaralha e retorna até maxQuestions.
 */
export async function sampleForQuiz(
  courseId: string,
  maxQuestions: number,
  moduleId?: string,
): Promise<Question[]> {
  let pool = await listByCourse(courseId);
  pool = pool.filter((q) => q.active);
  if (moduleId) pool = pool.filter((q) => q.moduleId === moduleId);
  if (pool.length === 0) return [];
  // Fisher-Yates shuffle
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(maxQuestions, shuffled.length));
}

/**
 * Verifica se o aluno acertou: dados as IDs de opção marcadas pelo aluno,
 * compara com as flags `correct` da questão.
 */
export function gradeAnswer(
  question: Question,
  selectedOptionIds: string[],
): { correct: boolean; correctOptionIds: string[] } {
  const correctIds = question.options.filter((o) => o.correct).map((o) => o.id);
  const correct =
    selectedOptionIds.length === correctIds.length &&
    correctIds.every((cid) => selectedOptionIds.includes(cid));
  return { correct, correctOptionIds: correctIds };
}

const AI_GRADING_SYSTEM = `Você é um avaliador acadêmico da plataforma PCO (Psicanálise Clínica Online).
Recebe a pergunta, a resposta esperada (rubrica) e a resposta do aluno.
Avalie a resposta do aluno e retorne EXATAMENTE neste formato JSON (sem markdown, sem código):
{"score":N,"feedback":"..."}

Onde:
- score: número inteiro de 0 a 100 (0=totalmente errado, 100=perfeito)
- feedback: 1-3 frases em português brasileiro explicando a nota. Seja construtivo.

Critérios: aderência ao conteúdo da rubrica, clareza, uso correto de conceitos.
Não penalize estilo ou formatação. Valorize respostas que demonstrem compreensão mesmo com palavras diferentes.`;

export interface AiGradeResult {
  score: number;
  feedback: string;
  provider: string;
  model: string;
}

export async function gradeOpenEndedWithAi(
  question: Question,
  studentAnswer: string,
): Promise<AiGradeResult | null> {
  const cfg = getActiveByModule('grading');
  if (!cfg) return null;

  const provider = getProvider(cfg.provider);
  if (!provider) return null;

  const userMessage = [
    `**Pergunta:** ${question.prompt}`,
    question.expectedAnswer
      ? `**Resposta esperada (rubrica):** ${question.expectedAnswer}`
      : '',
    `**Resposta do aluno:** ${studentAnswer}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  try {
    const result = await provider.chat({
      apiKey: cfg.apiKey,
      model: cfg.model,
      messages: [{ role: 'user', content: userMessage }],
      systemPrompt: AI_GRADING_SYSTEM,
      temperature: cfg.temperature ?? 0.2,
      maxTokens: cfg.maxTokens ?? 400,
      timeoutMs: 20_000,
    });

    const parsed = JSON.parse(result.text) as { score: number; feedback: string };
    const score = Math.max(0, Math.min(100, Math.round(parsed.score)));
    return {
      score,
      feedback: parsed.feedback ?? '',
      provider: cfg.provider,
      model: cfg.model,
    };
  } catch (err) {
    console.error('[question-bank] AI grading falhou:', err);
    return null;
  }
}

export async function _resetForTests(): Promise<void> {
  await store.setAll([]);
}

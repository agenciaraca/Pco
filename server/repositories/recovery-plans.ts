import crypto from 'node:crypto';
import { JsonStore } from '../db/json-store';
import { getActiveByModule } from '../ai/store';
import { getProvider } from '../ai/providers';

export interface RecoveryPlan {
  id: string;
  studentId: string;
  studentName: string;
  tone: 'acolhedor' | 'direto' | 'motivacional';
  channel: 'email' | 'whatsapp' | 'in_app';
  intensity: 'leve' | 'media' | 'intensa';
  goal: string;
  diagnosis: string;
  message: string;
  recommendedLessonId?: string;
  suggestedTutorPrompt?: string;
  weeklyGoalMinutes: number;
  status: 'draft' | 'sent' | 'in_followup' | 'completed';
  aiProvider?: string;
  aiModel?: string;
  createdAt: string;
  updatedAt: string;
}

const store = new JsonStore<RecoveryPlan>('recovery-plans.json', () => []);

function newId(): string {
  return `rp-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

export async function listAll(): Promise<RecoveryPlan[]> {
  const all = await store.getAll();
  return [...all].sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
}

export async function listForStudent(studentId: string): Promise<RecoveryPlan[]> {
  return await store.filter((p) => p.studentId === studentId);
}

export async function findById(id: string): Promise<RecoveryPlan | null> {
  return await store.findOne((p) => p.id === id);
}

export async function updateStatus(
  id: string,
  status: RecoveryPlan['status'],
): Promise<RecoveryPlan | null> {
  return await store.update(
    (p) => p.id === id,
    (p) => ({ ...p, status, updatedAt: new Date().toISOString() }),
  );
}

export interface GenerateInput {
  studentId: string;
  studentName: string;
  riskScore: number;
  riskReasons: string[];
  realProgress: number;
  expectedProgress: number;
  tone: 'acolhedor' | 'direto' | 'motivacional';
  channel: 'email' | 'whatsapp' | 'in_app';
  intensity: 'leve' | 'media' | 'intensa';
  goal: string;
}

const RECOVERY_SYSTEM = `Você é um especialista em retenção de alunos da PCO (Psicanálise Clínica Online).
Gere um plano de retomada personalizado em português brasileiro.

Retorne EXATAMENTE neste formato JSON (sem markdown):
{"diagnosis":"...","message":"...","weeklyGoalMinutes":N,"suggestedTutorPrompt":"..."}

Onde:
- diagnosis: 2-3 frases identificando por que o aluno está em risco
- message: mensagem de até 500 caracteres no tom solicitado para enviar ao aluno
- weeklyGoalMinutes: meta semanal em minutos (30-300)
- suggestedTutorPrompt: uma pergunta que o aluno poderia fazer ao tutor para retomar

Adapte o tom (acolhedor/direto/motivacional) e a intensidade (leve/media/intensa) conforme solicitado.`;

export async function generateWithAi(
  input: GenerateInput,
): Promise<RecoveryPlan> {
  const cfg = getActiveByModule('recovery_plan');
  let diagnosis = `Aluno com score de risco ${input.riskScore}/100. Progresso real ${input.realProgress}% vs esperado ${input.expectedProgress}%.`;
  let message = `Olá ${input.studentName}, notamos que você está afastado(a). Que tal retomar seus estudos? Estamos aqui para ajudar.`;
  let weeklyGoalMinutes = 120;
  let suggestedTutorPrompt: string | undefined;
  let aiProvider: string | undefined;
  let aiModel: string | undefined;

  if (cfg) {
    const provider = getProvider(cfg.provider);
    if (provider) {
      const userMessage = [
        `Aluno: ${input.studentName}`,
        `Score de risco: ${input.riskScore}/100`,
        `Razões: ${input.riskReasons.join('; ')}`,
        `Progresso real: ${input.realProgress}% | Esperado: ${input.expectedProgress}%`,
        `Tom: ${input.tone} | Canal: ${input.channel} | Intensidade: ${input.intensity}`,
        `Objetivo: ${input.goal}`,
      ].join('\n');

      try {
        const result = await provider.chat({
          apiKey: cfg.apiKey,
          model: cfg.model,
          messages: [{ role: 'user', content: userMessage }],
          systemPrompt: RECOVERY_SYSTEM,
          temperature: cfg.temperature ?? 0.5,
          maxTokens: cfg.maxTokens ?? 600,
          timeoutMs: 25_000,
        });
        const parsed = JSON.parse(result.text) as {
          diagnosis: string;
          message: string;
          weeklyGoalMinutes: number;
          suggestedTutorPrompt?: string;
        };
        diagnosis = parsed.diagnosis || diagnosis;
        message = parsed.message || message;
        weeklyGoalMinutes = parsed.weeklyGoalMinutes || weeklyGoalMinutes;
        suggestedTutorPrompt = parsed.suggestedTutorPrompt;
        aiProvider = cfg.provider;
        aiModel = cfg.model;
      } catch (err) {
        console.error('[recovery-plans] AI falhou, usando fallback:', err);
      }
    }
  }

  const now = new Date().toISOString();
  const plan: RecoveryPlan = {
    id: newId(),
    studentId: input.studentId,
    studentName: input.studentName,
    tone: input.tone,
    channel: input.channel,
    intensity: input.intensity,
    goal: input.goal,
    diagnosis,
    message,
    weeklyGoalMinutes,
    suggestedTutorPrompt,
    status: 'draft',
    aiProvider,
    aiModel,
    createdAt: now,
    updatedAt: now,
  };
  await store.unshift(plan);
  return plan;
}

export async function _resetForTests(): Promise<void> {
  await store.setAll([]);
}

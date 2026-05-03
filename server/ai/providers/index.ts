import type { AiProvider, ProviderId } from '../types';
import { anthropicProvider } from './anthropic';
import { openaiProvider } from './openai';
import { googleProvider } from './google';
import { mistralProvider } from './mistral';
import { deepseekProvider } from './deepseek';
import { groqProvider } from './groq';

export const providers: Record<ProviderId, AiProvider> = {
  anthropic: anthropicProvider,
  openai: openaiProvider,
  google: googleProvider,
  mistral: mistralProvider,
  deepseek: deepseekProvider,
  groq: groqProvider,
};

export function getProvider(id: ProviderId): AiProvider | null {
  return providers[id] ?? null;
}

export function listProviders(): AiProvider[] {
  return Object.values(providers);
}

export function calculateCost(
  providerId: ProviderId,
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const model = providers[providerId]?.info.models.find((m) => m.id === modelId);
  if (!model || !model.inputCostPerMTok || !model.outputCostPerMTok) return 0;
  const inputCost = (inputTokens / 1_000_000) * model.inputCostPerMTok;
  const outputCost = (outputTokens / 1_000_000) * model.outputCostPerMTok;
  return Number((inputCost + outputCost).toFixed(6));
}

// Contrato comum para todos os providers de IA.
// A interface é minimalista de propósito: qualquer provider que faça
// chat completion HTTP cabe aqui.

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatOptions {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface ChatResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  costUsd?: number;
  model: string;
  provider: ProviderId;
}

export type ProviderId =
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'mistral'
  | 'deepseek'
  | 'groq';

export interface ModelInfo {
  id: string;
  label: string;
  contextWindow: number;
  inputCostPerMTok?: number;
  outputCostPerMTok?: number;
  recommendedFor?: string;
}

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  homepageUrl: string;
  consoleUrl: string;
  apiKeyDocsUrl: string;
  defaultModel: string;
  models: ModelInfo[];
}

export interface AiProvider {
  info: ProviderInfo;
  chat(opts: ChatOptions): Promise<ChatResult>;
  /** Faz uma chamada barata para validar a API key. */
  testKey(apiKey: string): Promise<{ ok: true } | { ok: false; error: string }>;
}

export class AiError extends Error {
  constructor(
    public code: 'INVALID_KEY' | 'RATE_LIMIT' | 'UPSTREAM' | 'TIMEOUT' | 'UNKNOWN',
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'AiError';
  }
}

const DEFAULT_TIMEOUT_MS = 30_000;

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new AiError('TIMEOUT', `Provider não respondeu em ${timeoutMs}ms`);
    }
    throw new AiError('UPSTREAM', `Falha ao chamar provider: ${String(err)}`);
  } finally {
    clearTimeout(timer);
  }
}

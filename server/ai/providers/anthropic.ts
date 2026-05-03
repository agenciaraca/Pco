import { AiError, fetchWithTimeout, type AiProvider, type ChatOptions } from '../types';

export const anthropicProvider: AiProvider = {
  info: {
    id: 'anthropic',
    name: 'Anthropic Claude',
    homepageUrl: 'https://www.anthropic.com',
    consoleUrl: 'https://console.anthropic.com',
    apiKeyDocsUrl: 'https://docs.anthropic.com/en/api/getting-started',
    defaultModel: 'claude-sonnet-4-6',
    models: [
      {
        id: 'claude-opus-4-7',
        label: 'Claude Opus 4.7',
        contextWindow: 200000,
        inputCostPerMTok: 15,
        outputCostPerMTok: 75,
        recommendedFor: 'Casos clínicos complexos, raciocínio profundo',
      },
      {
        id: 'claude-sonnet-4-6',
        label: 'Claude Sonnet 4.6 (recomendado)',
        contextWindow: 200000,
        inputCostPerMTok: 3,
        outputCostPerMTok: 15,
        recommendedFor: 'Tutor pedagógico, melhor custo/benefício',
      },
      {
        id: 'claude-haiku-4-5-20251001',
        label: 'Claude Haiku 4.5',
        contextWindow: 200000,
        inputCostPerMTok: 0.8,
        outputCostPerMTok: 4,
        recommendedFor: 'Respostas rápidas e baratas',
      },
    ],
  },

  async chat(opts: ChatOptions) {
    const body = {
      model: opts.model,
      max_tokens: opts.maxTokens ?? 1200,
      temperature: opts.temperature ?? 0.3,
      ...(opts.systemPrompt ? { system: opts.systemPrompt } : {}),
      messages: opts.messages.map((m) => ({ role: m.role, content: m.content })),
    };

    const r = await fetchWithTimeout(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': opts.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      },
      opts.timeoutMs,
    );

    if (r.status === 401) throw new AiError('INVALID_KEY', 'Chave Anthropic inválida');
    if (r.status === 429) throw new AiError('RATE_LIMIT', 'Limite de requests atingido');
    if (!r.ok) throw new AiError('UPSTREAM', `Anthropic ${r.status}`, await r.text());

    const data = (await r.json()) as {
      content?: Array<{ text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
      model?: string;
    };

    return {
      text: data.content?.[0]?.text ?? '',
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
      model: data.model ?? opts.model,
      provider: 'anthropic' as const,
    };
  },

  async testKey(apiKey: string) {
    try {
      const r = await fetchWithTimeout(
        'https://api.anthropic.com/v1/messages',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 4,
            messages: [{ role: 'user', content: 'ping' }],
          }),
        },
        10_000,
      );
      if (r.status === 401) return { ok: false, error: 'Chave inválida' };
      if (!r.ok) return { ok: false, error: `Provider retornou ${r.status}` };
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};

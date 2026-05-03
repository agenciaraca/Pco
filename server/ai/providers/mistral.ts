import { AiError, fetchWithTimeout, type AiProvider, type ChatOptions } from '../types';

// Mistral usa contrato OpenAI-compatível
export const mistralProvider: AiProvider = {
  info: {
    id: 'mistral',
    name: 'Mistral AI',
    homepageUrl: 'https://mistral.ai',
    consoleUrl: 'https://console.mistral.ai',
    apiKeyDocsUrl: 'https://docs.mistral.ai/getting-started/quickstart',
    defaultModel: 'mistral-small-latest',
    models: [
      {
        id: 'mistral-large-latest',
        label: 'Mistral Large',
        contextWindow: 128000,
        inputCostPerMTok: 2,
        outputCostPerMTok: 6,
        recommendedFor: 'Raciocínio complexo, multi-idioma',
      },
      {
        id: 'mistral-small-latest',
        label: 'Mistral Small (recomendado)',
        contextWindow: 32000,
        inputCostPerMTok: 0.2,
        outputCostPerMTok: 0.6,
        recommendedFor: 'Custo baixo, multi-idioma',
      },
      {
        id: 'open-mistral-nemo',
        label: 'Mistral Nemo (open)',
        contextWindow: 128000,
        inputCostPerMTok: 0.15,
        outputCostPerMTok: 0.15,
      },
    ],
  },

  async chat(opts: ChatOptions) {
    const messages = [
      ...(opts.systemPrompt
        ? [{ role: 'system' as const, content: opts.systemPrompt }]
        : []),
      ...opts.messages,
    ];

    const r = await fetchWithTimeout(
      'https://api.mistral.ai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${opts.apiKey}`,
        },
        body: JSON.stringify({
          model: opts.model,
          messages,
          max_tokens: opts.maxTokens ?? 1200,
          temperature: opts.temperature ?? 0.3,
        }),
      },
      opts.timeoutMs,
    );

    if (r.status === 401) throw new AiError('INVALID_KEY', 'Chave Mistral inválida');
    if (r.status === 429) throw new AiError('RATE_LIMIT', 'Limite atingido');
    if (!r.ok) throw new AiError('UPSTREAM', `Mistral ${r.status}`, await r.text());

    const data = (await r.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      model?: string;
    };

    return {
      text: data.choices?.[0]?.message?.content ?? '',
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
      model: data.model ?? opts.model,
      provider: 'mistral' as const,
    };
  },

  async testKey(apiKey: string) {
    try {
      const r = await fetchWithTimeout(
        'https://api.mistral.ai/v1/models',
        { method: 'GET', headers: { authorization: `Bearer ${apiKey}` } },
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

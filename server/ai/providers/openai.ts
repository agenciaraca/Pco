import { AiError, fetchWithTimeout, type AiProvider, type ChatOptions } from '../types';

export const openaiProvider: AiProvider = {
  info: {
    id: 'openai',
    name: 'OpenAI',
    homepageUrl: 'https://openai.com',
    consoleUrl: 'https://platform.openai.com',
    apiKeyDocsUrl: 'https://platform.openai.com/api-keys',
    defaultModel: 'gpt-4o-mini',
    models: [
      {
        id: 'gpt-4o',
        label: 'GPT-4o',
        contextWindow: 128000,
        inputCostPerMTok: 2.5,
        outputCostPerMTok: 10,
        recommendedFor: 'Casos complexos, multimodal',
      },
      {
        id: 'gpt-4o-mini',
        label: 'GPT-4o mini (recomendado)',
        contextWindow: 128000,
        inputCostPerMTok: 0.15,
        outputCostPerMTok: 0.6,
        recommendedFor: 'Custo baixo, qualidade boa',
      },
      {
        id: 'gpt-4.1',
        label: 'GPT-4.1',
        contextWindow: 1000000,
        inputCostPerMTok: 2,
        outputCostPerMTok: 8,
        recommendedFor: 'Janela de contexto enorme',
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
      'https://api.openai.com/v1/chat/completions',
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

    if (r.status === 401) throw new AiError('INVALID_KEY', 'Chave OpenAI inválida');
    if (r.status === 429) throw new AiError('RATE_LIMIT', 'Limite de requests atingido');
    if (!r.ok) throw new AiError('UPSTREAM', `OpenAI ${r.status}`, await r.text());

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
      provider: 'openai' as const,
    };
  },

  async testKey(apiKey: string) {
    try {
      const r = await fetchWithTimeout(
        'https://api.openai.com/v1/models',
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

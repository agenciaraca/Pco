import { AiError, fetchWithTimeout, type AiProvider, type ChatOptions } from '../types';

// Groq hospeda modelos open (Llama, Mixtral, Gemma) com inferência ultra rápida.
// Usa contrato OpenAI-compatível.
export const groqProvider: AiProvider = {
  info: {
    id: 'groq',
    name: 'Groq (Llama / Mixtral)',
    homepageUrl: 'https://groq.com',
    consoleUrl: 'https://console.groq.com',
    apiKeyDocsUrl: 'https://console.groq.com/keys',
    defaultModel: 'llama-3.3-70b-versatile',
    models: [
      {
        id: 'llama-3.3-70b-versatile',
        label: 'Llama 3.3 70B (recomendado)',
        contextWindow: 128000,
        inputCostPerMTok: 0.59,
        outputCostPerMTok: 0.79,
        recommendedFor: 'Velocidade alta, custo baixo, open weights',
      },
      {
        id: 'llama-3.1-8b-instant',
        label: 'Llama 3.1 8B Instant',
        contextWindow: 128000,
        inputCostPerMTok: 0.05,
        outputCostPerMTok: 0.08,
        recommendedFor: 'Tier ultra-barato',
      },
      {
        id: 'mixtral-8x7b-32768',
        label: 'Mixtral 8x7B',
        contextWindow: 32768,
        inputCostPerMTok: 0.24,
        outputCostPerMTok: 0.24,
      },
      {
        id: 'gemma2-9b-it',
        label: 'Gemma 2 9B',
        contextWindow: 8192,
        inputCostPerMTok: 0.2,
        outputCostPerMTok: 0.2,
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
      'https://api.groq.com/openai/v1/chat/completions',
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

    if (r.status === 401) throw new AiError('INVALID_KEY', 'Chave Groq inválida');
    if (r.status === 429) throw new AiError('RATE_LIMIT', 'Limite atingido');
    if (!r.ok) throw new AiError('UPSTREAM', `Groq ${r.status}`, await r.text());

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
      provider: 'groq' as const,
    };
  },

  async testKey(apiKey: string) {
    try {
      const r = await fetchWithTimeout(
        'https://api.groq.com/openai/v1/models',
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

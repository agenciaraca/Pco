import { AiError, fetchWithTimeout, type AiProvider, type ChatOptions } from '../types';

// DeepSeek usa contrato OpenAI-compatível
export const deepseekProvider: AiProvider = {
  info: {
    id: 'deepseek',
    name: 'DeepSeek',
    homepageUrl: 'https://www.deepseek.com',
    consoleUrl: 'https://platform.deepseek.com',
    apiKeyDocsUrl: 'https://platform.deepseek.com/api_keys',
    defaultModel: 'deepseek-chat',
    models: [
      {
        id: 'deepseek-chat',
        label: 'DeepSeek-V3 Chat (recomendado)',
        contextWindow: 64000,
        inputCostPerMTok: 0.27,
        outputCostPerMTok: 1.1,
        recommendedFor: 'Custo muito baixo, raciocínio forte',
      },
      {
        id: 'deepseek-reasoner',
        label: 'DeepSeek-R1 Reasoner',
        contextWindow: 64000,
        inputCostPerMTok: 0.55,
        outputCostPerMTok: 2.19,
        recommendedFor: 'Raciocínio profundo, casos clínicos',
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
      'https://api.deepseek.com/v1/chat/completions',
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

    if (r.status === 401) throw new AiError('INVALID_KEY', 'Chave DeepSeek inválida');
    if (r.status === 429) throw new AiError('RATE_LIMIT', 'Limite atingido');
    if (!r.ok) throw new AiError('UPSTREAM', `DeepSeek ${r.status}`, await r.text());

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
      provider: 'deepseek' as const,
    };
  },

  async testKey(apiKey: string) {
    try {
      const r = await fetchWithTimeout(
        'https://api.deepseek.com/v1/models',
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

import { AiError, fetchWithTimeout, type AiProvider, type ChatOptions } from '../types';

export const googleProvider: AiProvider = {
  info: {
    id: 'google',
    name: 'Google Gemini',
    homepageUrl: 'https://ai.google.dev',
    consoleUrl: 'https://aistudio.google.com',
    apiKeyDocsUrl: 'https://aistudio.google.com/apikey',
    defaultModel: 'gemini-2.0-flash',
    models: [
      {
        id: 'gemini-2.0-pro',
        label: 'Gemini 2.0 Pro',
        contextWindow: 2000000,
        inputCostPerMTok: 1.25,
        outputCostPerMTok: 5,
        recommendedFor: 'Janela enorme, raciocínio complexo',
      },
      {
        id: 'gemini-2.0-flash',
        label: 'Gemini 2.0 Flash (recomendado)',
        contextWindow: 1000000,
        inputCostPerMTok: 0.075,
        outputCostPerMTok: 0.3,
        recommendedFor: 'Velocidade + custo baixo, tier gratuito',
      },
      {
        id: 'gemini-1.5-flash-8b',
        label: 'Gemini 1.5 Flash 8B',
        contextWindow: 1000000,
        inputCostPerMTok: 0.0375,
        outputCostPerMTok: 0.15,
        recommendedFor: 'Tier mais barato',
      },
    ],
  },

  async chat(opts: ChatOptions) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(opts.model)}:generateContent?key=${encodeURIComponent(opts.apiKey)}`;
    const body = {
      ...(opts.systemPrompt
        ? { systemInstruction: { parts: [{ text: opts.systemPrompt }] } }
        : {}),
      contents: opts.messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      generationConfig: {
        temperature: opts.temperature ?? 0.3,
        maxOutputTokens: opts.maxTokens ?? 1200,
      },
    };

    const r = await fetchWithTimeout(
      url,
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) },
      opts.timeoutMs,
    );

    if (r.status === 401 || r.status === 403)
      throw new AiError('INVALID_KEY', 'Chave Google inválida');
    if (r.status === 429) throw new AiError('RATE_LIMIT', 'Limite atingido');
    if (!r.ok) throw new AiError('UPSTREAM', `Gemini ${r.status}`, await r.text());

    const data = (await r.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };

    const text =
      data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';

    return {
      text,
      inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      model: opts.model,
      provider: 'google' as const,
    };
  },

  async testKey(apiKey: string) {
    try {
      const r = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
        { method: 'GET' },
        10_000,
      );
      if (r.status === 401 || r.status === 403)
        return { ok: false, error: 'Chave inválida' };
      if (!r.ok) return { ok: false, error: `Provider retornou ${r.status}` };
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};

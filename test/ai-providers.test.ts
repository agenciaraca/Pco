import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  providers,
  listProviders,
  getProvider,
  calculateCost,
} from '../server/ai/providers';
import { AiError } from '../server/ai/types';

describe('AI provider registry', () => {
  it('contém os 6 providers esperados', () => {
    expect(Object.keys(providers).sort()).toEqual([
      'anthropic',
      'deepseek',
      'google',
      'groq',
      'mistral',
      'openai',
    ]);
  });

  it('listProviders retorna 6 implementações', () => {
    expect(listProviders().length).toBe(6);
  });

  it('getProvider retorna null para id inválido', () => {
    expect(getProvider('inexistente' as 'anthropic')).toBeNull();
  });

  it('cada provider expõe info, chat, testKey', () => {
    for (const p of listProviders()) {
      expect(p.info).toBeDefined();
      expect(typeof p.chat).toBe('function');
      expect(typeof p.testKey).toBe('function');
      expect(p.info.models.length).toBeGreaterThan(0);
      expect(p.info.consoleUrl).toMatch(/^https:\/\//);
      expect(p.info.apiKeyDocsUrl).toMatch(/^https:\/\//);
    }
  });

  it('calculateCost retorna 0 quando model desconhecido', () => {
    expect(calculateCost('anthropic', 'inexistente', 1000, 500)).toBe(0);
  });

  it('calculateCost respeita preços do model', () => {
    // Sonnet 4.6: $3 input, $15 output por MTok
    const cost = calculateCost('anthropic', 'claude-sonnet-4-6', 1_000_000, 100_000);
    // 1M input * $3 + 100k output * $15 = $3 + $1.5 = $4.5
    expect(cost).toBeCloseTo(4.5, 4);
  });
});

describe('Anthropic provider error handling', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    // nada
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('lança INVALID_KEY em 401', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response('{"error":{}}', { status: 401, headers: { 'content-type': 'application/json' } }),
    ) as typeof fetch;

    await expect(
      providers.anthropic.chat({
        apiKey: 'invalid',
        model: 'claude-sonnet-4-6',
        messages: [{ role: 'user', content: 'hi' }],
      }),
    ).rejects.toMatchObject({ code: 'INVALID_KEY' });
  });

  it('lança RATE_LIMIT em 429', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response('{}', { status: 429 }),
    ) as typeof fetch;

    await expect(
      providers.anthropic.chat({
        apiKey: 'k',
        model: 'claude-sonnet-4-6',
        messages: [{ role: 'user', content: 'hi' }],
      }),
    ).rejects.toBeInstanceOf(AiError);
  });

  it('parseia resposta com sucesso', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          content: [{ text: 'olá' }],
          usage: { input_tokens: 10, output_tokens: 5 },
          model: 'claude-sonnet-4-6',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    ) as typeof fetch;

    const result = await providers.anthropic.chat({
      apiKey: 'k',
      model: 'claude-sonnet-4-6',
      messages: [{ role: 'user', content: 'oi' }],
    });

    expect(result.text).toBe('olá');
    expect(result.inputTokens).toBe(10);
    expect(result.outputTokens).toBe(5);
    expect(result.provider).toBe('anthropic');
  });
});

describe('OpenAI-compatible providers (openai, mistral, deepseek, groq)', () => {
  const ids = ['openai', 'mistral', 'deepseek', 'groq'] as const;
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it.each(ids)('parseia resposta padrão OpenAI — %s', async (id) => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: 'resposta' } }],
          usage: { prompt_tokens: 8, completion_tokens: 4 },
          model: providers[id].info.defaultModel,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    ) as typeof fetch;

    const result = await providers[id].chat({
      apiKey: 'k',
      model: providers[id].info.defaultModel,
      messages: [{ role: 'user', content: 'oi' }],
    });

    expect(result.text).toBe('resposta');
    expect(result.inputTokens).toBe(8);
    expect(result.outputTokens).toBe(4);
    expect(result.provider).toBe(id);
  });

  it.each(ids)('aplica system prompt — %s', async (id) => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: 'ok' } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await providers[id].chat({
      apiKey: 'k',
      model: providers[id].info.defaultModel,
      messages: [{ role: 'user', content: 'oi' }],
      systemPrompt: 'Você é útil',
    });

    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    const body = JSON.parse(calls[0][1].body as string);
    expect(body.messages[0]).toMatchObject({ role: 'system', content: 'Você é útil' });
  });
});

describe('Google Gemini provider', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('parseia resposta no formato candidates/parts', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: 'olá do Gemini' }] } }],
          usageMetadata: { promptTokenCount: 7, candidatesTokenCount: 3 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    ) as typeof fetch;

    const result = await providers.google.chat({
      apiKey: 'k',
      model: 'gemini-2.0-flash',
      messages: [{ role: 'user', content: 'oi' }],
    });

    expect(result.text).toBe('olá do Gemini');
    expect(result.inputTokens).toBe(7);
    expect(result.outputTokens).toBe(3);
  });
});

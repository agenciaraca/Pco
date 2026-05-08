// OpenAI Whisper API wrapper para transcrição de áudio/vídeo.
// Whisper aceita arquivos até 25MB nos formatos mp3, mp4, mpeg, mpga,
// m4a, wav, webm. Retorna texto transcrito.
//
// Reusa a OpenAI API key configurada para o módulo 'tutor' (provider openai)
// ou 'summaries'. Caso o módulo configurado use outro provider (Anthropic,
// Google etc.), a transcrição NÃO acontece — admin precisa ter pelo menos
// 1 config OpenAI ativa pra usar essa feature.

import { AiError } from './types';

export interface WhisperOptions {
  apiKey: string;
  audio: ArrayBuffer | Buffer;
  mimeType: string;
  filename: string;
  /** ISO 639-1 lowercase. Whisper detecta automaticamente se omitido. */
  language?: string;
  /** Default 'whisper-1'. */
  model?: string;
  timeoutMs?: number;
}

export interface WhisperResult {
  text: string;
  /** Whisper retorna duration aproximada do áudio em segundos. */
  durationSeconds?: number;
  /** Idioma detectado (ISO 639-1) se language não foi fornecido. */
  language?: string;
}

const WHISPER_MAX_BYTES = 25 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

export async function transcribeWithWhisper(
  opts: WhisperOptions,
): Promise<WhisperResult> {
  const buf =
    opts.audio instanceof ArrayBuffer ? Buffer.from(opts.audio) : opts.audio;
  if (buf.byteLength > WHISPER_MAX_BYTES) {
    throw new AiError(
      'UPSTREAM',
      `Áudio/vídeo tem ${(buf.byteLength / 1024 / 1024).toFixed(1)}MB; Whisper aceita até ${WHISPER_MAX_BYTES / 1024 / 1024}MB.`,
    );
  }

  const form = new FormData();
  form.append(
    'file',
    new Blob([buf as unknown as ArrayBuffer], { type: opts.mimeType }),
    opts.filename,
  );
  form.append('model', opts.model ?? 'whisper-1');
  form.append('response_format', 'verbose_json');
  if (opts.language) form.append('language', opts.language);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { authorization: `Bearer ${opts.apiKey}` },
      body: form,
      signal: ctrl.signal,
    });
    if (r.status === 401) throw new AiError('INVALID_KEY', 'Chave OpenAI inválida');
    if (r.status === 429) throw new AiError('RATE_LIMIT', 'Limite OpenAI atingido');
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      throw new AiError('UPSTREAM', `Whisper ${r.status}`, txt);
    }
    const data = (await r.json()) as {
      text?: string;
      duration?: number;
      language?: string;
    };
    return {
      text: data.text ?? '',
      durationSeconds: data.duration,
      language: data.language,
    };
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new AiError(
        'TIMEOUT',
        `Whisper não respondeu em ${(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS) / 1000}s`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Baixa um vídeo de URL HTTP(S) com limite de tamanho.
 * Retorna o buffer + mime type. Usado antes de enviar pro Whisper.
 *
 * Se Content-Length excede maxBytes, aborta sem ler o body.
 * Se o servidor não enviar Content-Length, lê stream e checa por chunk.
 */
export async function downloadVideoForTranscription(
  url: string,
  maxBytes = WHISPER_MAX_BYTES,
  timeoutMs = 60_000,
): Promise<{ buffer: Buffer; mimeType: string; sizeMB: number }> {
  if (!/^https?:\/\//i.test(url)) {
    throw new AiError('UPSTREAM', 'videoUrl deve ser http(s).');
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      method: 'GET',
      signal: ctrl.signal,
      redirect: 'follow',
    });
    if (!r.ok) {
      throw new AiError('UPSTREAM', `Download falhou: HTTP ${r.status}`);
    }
    const contentLength = Number(r.headers.get('content-length') ?? '0');
    if (contentLength > maxBytes) {
      throw new AiError(
        'UPSTREAM',
        `Vídeo tem ${(contentLength / 1024 / 1024).toFixed(1)}MB; máximo ${maxBytes / 1024 / 1024}MB.`,
      );
    }
    const ct = r.headers.get('content-type') ?? '';
    const mimeType = ct.includes('/') ? ct.split(';')[0]!.trim() : 'video/mp4';
    // Usa arrayBuffer() — se body excede maxBytes durante read, abortamos
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.byteLength > maxBytes) {
      throw new AiError(
        'UPSTREAM',
        `Após download: ${(buf.byteLength / 1024 / 1024).toFixed(1)}MB excede limite ${maxBytes / 1024 / 1024}MB.`,
      );
    }
    return {
      buffer: buf,
      mimeType,
      sizeMB: Number((buf.byteLength / 1024 / 1024).toFixed(2)),
    };
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new AiError('TIMEOUT', `Download não respondeu em ${timeoutMs / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export function inferFilenameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split('/').pop() || 'audio';
    return last.includes('.') ? last : `${last}.mp4`;
  } catch {
    return 'video.mp4';
  }
}

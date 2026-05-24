import type {
  TranscriptionProvider,
  TranscribeOptions,
  TranscriptionResult,
  TranscriptionSegment,
} from '../types';

export const whisperProvider: TranscriptionProvider = {
  id: 'whisper',
  name: 'OpenAI Whisper',

  async transcribe(opts: TranscribeOptions): Promise<TranscriptionResult> {
    if (!opts.audioUrl && !opts.audioBuffer) {
      throw new Error('audioUrl ou audioBuffer obrigatório.');
    }

    let audioData: Blob;
    if (opts.audioBuffer) {
      audioData = new Blob([new Uint8Array(opts.audioBuffer)], { type: 'audio/mp4' });
    } else {
      const res = await fetch(opts.audioUrl!);
      if (!res.ok) throw new Error(`Falha ao baixar áudio: ${res.status}`);
      audioData = await res.blob();
    }

    const form = new FormData();
    form.append('file', audioData, 'audio.mp4');
    form.append('model', opts.model ?? 'whisper-1');
    form.append('response_format', 'verbose_json');
    form.append('timestamp_granularities[]', 'segment');
    if (opts.language) form.append('language', opts.language);
    if (opts.customVocabulary?.length) {
      form.append('prompt', opts.customVocabulary.join(', '));
    }

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${opts.apiKey}` },
      body: form,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Whisper API ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      text: string;
      language: string;
      duration: number;
      segments?: Array<{
        start: number;
        end: number;
        text: string;
        avg_logprob?: number;
      }>;
    };

    const segments: TranscriptionSegment[] = (data.segments ?? []).map((s) => ({
      start: s.start,
      end: s.end,
      text: s.text.trim(),
      confidence: s.avg_logprob ? Math.exp(s.avg_logprob) : undefined,
    }));

    return {
      segments,
      fullText: data.text,
      language: data.language ?? opts.language ?? 'pt',
      durationSeconds: data.duration ?? 0,
      provider: 'whisper',
      model: opts.model ?? 'whisper-1',
    };
  },

  async testKey(apiKey: string) {
    try {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.ok) return { ok: true as const };
      return { ok: false as const, error: `HTTP ${res.status}` };
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
    }
  },
};

import type {
  TranscriptionProvider,
  TranscribeOptions,
  TranscriptionResult,
  TranscriptionSegment,
} from '../types';

export const deepgramProvider: TranscriptionProvider = {
  id: 'deepgram',
  name: 'Deepgram',

  async transcribe(opts: TranscribeOptions): Promise<TranscriptionResult> {
    if (!opts.audioUrl && !opts.audioBuffer) {
      throw new Error('audioUrl ou audioBuffer obrigatório.');
    }

    const model = opts.model ?? 'nova-2';
    const lang = opts.language ?? 'pt-BR';
    const params = new URLSearchParams({
      model,
      language: lang,
      punctuate: 'true',
      diarize: 'true',
      smart_format: 'true',
    });
    if (opts.customVocabulary?.length) {
      params.set('keywords', opts.customVocabulary.slice(0, 100).join(':1,') + ':1');
    }

    let audioBlob: Blob;

    if (opts.audioBuffer) {
      audioBlob = new Blob([new Uint8Array(opts.audioBuffer)], { type: 'audio/mp4' });
    } else {
      const res = await fetch(opts.audioUrl!);
      if (!res.ok) throw new Error(`Falha ao baixar áudio: ${res.status}`);
      audioBlob = await res.blob();
    }

    const res = await fetch(
      `https://api.deepgram.com/v1/listen?${params.toString()}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Token ${opts.apiKey}`,
          'Content-Type': audioBlob.type || 'audio/mp4',
        },
        body: audioBlob,
      },
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Deepgram API ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      results?: {
        channels?: Array<{
          alternatives?: Array<{
            transcript?: string;
            words?: Array<{
              word: string;
              start: number;
              end: number;
              confidence: number;
              speaker?: number;
            }>;
          }>;
        }>;
      };
      metadata?: { duration?: number };
    };

    const alt = data.results?.channels?.[0]?.alternatives?.[0];
    const words = alt?.words ?? [];

    const segments: TranscriptionSegment[] = [];
    let currentSegment: TranscriptionSegment | null = null;
    const PAUSE_THRESHOLD = 1.5;

    for (const w of words) {
      if (
        !currentSegment ||
        w.start - currentSegment.end > PAUSE_THRESHOLD ||
        (w.speaker !== undefined &&
          currentSegment.speaker !== undefined &&
          `speaker-${w.speaker}` !== currentSegment.speaker)
      ) {
        if (currentSegment) segments.push(currentSegment);
        currentSegment = {
          start: w.start,
          end: w.end,
          text: w.word,
          speaker: w.speaker !== undefined ? `speaker-${w.speaker}` : undefined,
          confidence: w.confidence,
        };
      } else {
        currentSegment.end = w.end;
        currentSegment.text += ' ' + w.word;
        currentSegment.confidence = currentSegment.confidence
          ? (currentSegment.confidence + w.confidence) / 2
          : w.confidence;
      }
    }
    if (currentSegment) segments.push(currentSegment);

    return {
      segments,
      fullText: alt?.transcript ?? '',
      language: lang,
      durationSeconds: data.metadata?.duration ?? 0,
      provider: 'deepgram',
      model,
    };
  },

  async testKey(apiKey: string) {
    try {
      const res = await fetch('https://api.deepgram.com/v1/projects', {
        headers: { Authorization: `Token ${apiKey}` },
      });
      if (res.ok) return { ok: true as const };
      return { ok: false as const, error: `HTTP ${res.status}` };
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
    }
  },
};

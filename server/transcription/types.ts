export type TranscriptionProviderId = 'whisper' | 'deepgram' | 'assemblyai';

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
  confidence?: number;
}

export interface TranscriptionResult {
  segments: TranscriptionSegment[];
  fullText: string;
  language: string;
  durationSeconds: number;
  provider: TranscriptionProviderId;
  model: string;
}

export interface TranscribeOptions {
  apiKey: string;
  audioUrl?: string;
  audioBuffer?: Buffer;
  language?: string;
  customVocabulary?: string[];
  model?: string;
}

export interface TranscriptionProvider {
  id: TranscriptionProviderId;
  name: string;
  transcribe(opts: TranscribeOptions): Promise<TranscriptionResult>;
  testKey(apiKey: string): Promise<{ ok: true } | { ok: false; error: string }>;
}

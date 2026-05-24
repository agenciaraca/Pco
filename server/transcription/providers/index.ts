import type { TranscriptionProvider, TranscriptionProviderId } from '../types';
import { whisperProvider } from './whisper';
import { deepgramProvider } from './deepgram';

const providers: Record<TranscriptionProviderId, TranscriptionProvider> = {
  whisper: whisperProvider,
  deepgram: deepgramProvider,
  assemblyai: whisperProvider, // placeholder — usa whisper como fallback
};

export function getTranscriptionProvider(
  id: TranscriptionProviderId,
): TranscriptionProvider | null {
  return providers[id] ?? null;
}

export function listTranscriptionProviders(): TranscriptionProvider[] {
  return [whisperProvider, deepgramProvider];
}

import crypto from 'node:crypto';
import { JsonStore } from '../db/json-store';
import type { TranscriptionSegment, TranscriptionProviderId } from './types';

export interface SessionTranscript {
  id: string;
  sessionId: string;
  segments: TranscriptionSegment[];
  fullText: string;
  language: string;
  durationSeconds: number;
  provider: TranscriptionProviderId;
  model: string;
  aiSummary?: string;
  status: 'processing' | 'completed' | 'failed';
  error?: string;
  createdAt: string;
  updatedAt: string;
}

const store = new JsonStore<SessionTranscript>(
  'session-transcripts.json',
  () => [],
);

function newId(): string {
  return `tr-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

export async function listAll(): Promise<SessionTranscript[]> {
  const all = await store.getAll();
  return [...all].sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
}

export async function findBySessionId(
  sessionId: string,
): Promise<SessionTranscript | null> {
  return await store.findOne((t) => t.sessionId === sessionId);
}

export async function findById(id: string): Promise<SessionTranscript | null> {
  return await store.findOne((t) => t.id === id);
}

export async function createProcessing(
  sessionId: string,
): Promise<SessionTranscript> {
  const now = new Date().toISOString();
  const t: SessionTranscript = {
    id: newId(),
    sessionId,
    segments: [],
    fullText: '',
    language: '',
    durationSeconds: 0,
    provider: 'whisper',
    model: '',
    status: 'processing',
    createdAt: now,
    updatedAt: now,
  };
  await store.unshift(t);
  return t;
}

export async function markCompleted(
  id: string,
  result: {
    segments: TranscriptionSegment[];
    fullText: string;
    language: string;
    durationSeconds: number;
    provider: TranscriptionProviderId;
    model: string;
  },
): Promise<SessionTranscript | null> {
  return await store.update(
    (t) => t.id === id,
    (t) => ({
      ...t,
      ...result,
      status: 'completed' as const,
      updatedAt: new Date().toISOString(),
    }),
  );
}

export async function markFailed(
  id: string,
  error: string,
): Promise<SessionTranscript | null> {
  return await store.update(
    (t) => t.id === id,
    (t) => ({
      ...t,
      status: 'failed' as const,
      error,
      updatedAt: new Date().toISOString(),
    }),
  );
}

export async function setAiSummary(
  id: string,
  summary: string,
): Promise<SessionTranscript | null> {
  return await store.update(
    (t) => t.id === id,
    (t) => ({ ...t, aiSummary: summary, updatedAt: new Date().toISOString() }),
  );
}

export async function _resetForTests(): Promise<void> {
  await store.setAll([]);
}

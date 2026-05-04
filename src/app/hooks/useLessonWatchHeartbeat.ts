// Heartbeat de tempo assistido. Manda 30s para o servidor a cada 30s,
// só quando a aba está visível (document.hidden=false) e enabled=true.

import { useEffect, useRef } from 'react';
import { postWatchHeartbeat } from '../data/api';

const CHUNK_SECONDS = 30;
const TICK_MS = CHUNK_SECONDS * 1000;

interface Options {
  lessonId: string | undefined;
  courseId: string | undefined;
  enabled: boolean;
  lessonDurationSeconds?: number;
}

export function useLessonWatchHeartbeat({
  lessonId,
  courseId,
  enabled,
  lessonDurationSeconds,
}: Options): void {
  const lastSentRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled || !lessonId || !courseId) return;
    let mounted = true;
    let interval: NodeJS.Timeout | null = null;

    function tick() {
      if (typeof document !== 'undefined' && document.hidden) return;
      // Cap delta a CHUNK_SECONDS por tick — anti-burst
      const now = Date.now();
      const delta = Math.min(
        CHUNK_SECONDS,
        Math.max(0, Math.round((now - (lastSentRef.current || now)) / 1000)),
      );
      if (delta === 0) {
        lastSentRef.current = now;
        return;
      }
      lastSentRef.current = now;
      void postWatchHeartbeat(
        lessonId!,
        courseId!,
        delta,
        lessonDurationSeconds,
      ).catch(() => {
        // ignora — não vamos travar a UX por causa de telemetria
      });
      if (!mounted) return;
    }

    lastSentRef.current = Date.now();
    interval = setInterval(tick, TICK_MS);
    return () => {
      mounted = false;
      if (interval) clearInterval(interval);
    };
  }, [lessonId, courseId, enabled, lessonDurationSeconds]);
}

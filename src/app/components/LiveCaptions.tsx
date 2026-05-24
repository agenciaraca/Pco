import { useEffect, useRef, useState } from 'react';
import { Subtitles, X } from 'lucide-react';
import * as api from '../data/api';

interface Props {
  sessionId: string;
  visible: boolean;
  onToggle: () => void;
}

export default function LiveCaptions({ sessionId, visible, onToggle }: Props) {
  const [transcript, setTranscript] = useState<api.SessionTranscriptDto | null>(null);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible || !sessionId) return;
    let cancelled = false;
    let interval: ReturnType<typeof setInterval>;

    const poll = async () => {
      try {
        const data = await api.fetchSessionTranscript(sessionId);
        if (!cancelled) {
          setTranscript(data);
          setError('');
        }
      } catch {
        if (!cancelled) setError('Transcrição não disponível.');
      }
    };

    void poll();
    interval = setInterval(poll, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [sessionId, visible]);

  useEffect(() => {
    if (visible && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcript?.segments.length, visible]);

  if (!visible) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-4 right-4 z-30 pco-btn-secondary text-xs shadow-lg"
        title="Mostrar legendas"
      >
        <Subtitles size={14} />
        Legendas
      </button>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-black/80 backdrop-blur-sm max-h-[200px] overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-3 relative">
        <button
          onClick={onToggle}
          className="absolute top-2 right-2 text-white/60 hover:text-white"
        >
          <X size={14} />
        </button>

        {error && (
          <p className="text-xs text-white/50 text-center">{error}</p>
        )}

        {transcript?.status === 'processing' && (
          <p className="text-xs text-pco-cyan text-center animate-pulse">
            Transcrição em andamento...
          </p>
        )}

        {transcript?.segments && transcript.segments.length > 0 && (
          <div className="space-y-1">
            {transcript.segments.slice(-10).map((seg, i) => (
              <p key={i} className="text-sm text-white leading-relaxed">
                {seg.speaker && (
                  <span className="text-pco-cyan text-xs font-medium mr-1">
                    [{seg.speaker}]
                  </span>
                )}
                {seg.text}
              </p>
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

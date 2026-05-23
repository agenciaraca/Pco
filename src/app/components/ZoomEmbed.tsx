import { useEffect, useRef, useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import * as api from '../data/api';

interface Props {
  meetingNumber: string;
  password?: string;
  userName: string;
}

export default function ZoomEmbed({ meetingNumber, password, userName }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'joining' | 'joined' | 'error'>('loading');
  const [error, setError] = useState('');
  const clientRef = useRef<unknown>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const { default: ZoomMtgEmbedded } = await import('@zoom/meetingsdk/embedded');

        if (cancelled || !containerRef.current) return;

        const client = ZoomMtgEmbedded.createClient();
        clientRef.current = client;

        await client.init({
          zoomAppRoot: containerRef.current,
          language: 'pt-PT',
          patchJsMedia: true,
          leaveOnPageUnload: true,
        });

        if (cancelled) return;
        setStatus('joining');

        const { signature, sdkKey } = await api.fetchZoomSignature(meetingNumber);

        if (cancelled) return;

        await client.join({
          sdkKey,
          signature,
          meetingNumber,
          password: password ?? '',
          userName,
        });

        if (!cancelled) setStatus('joined');
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Falha ao conectar ao Zoom.';
          setError(msg);
          setStatus('error');
        }
      }
    }

    void init();

    return () => {
      cancelled = true;
      if (clientRef.current) {
        try {
          (clientRef.current as { leaveMeeting?: () => void }).leaveMeeting?.();
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, [meetingNumber, password, userName]);

  if (status === 'error') {
    return (
      <div className="pco-card p-6 text-center space-y-3">
        <AlertCircle size={32} className="mx-auto text-status-danger" />
        <p className="text-sm text-ink-strong font-medium">Erro ao carregar Zoom</p>
        <p className="text-xs text-ink-muted">{error}</p>
        <p className="text-xs text-ink-subtle">
          Tente recarregar a pagina ou acesse o link direto da reuniao.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {(status === 'loading' || status === 'joining') && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-surface-off rounded-xl">
          <div className="text-center space-y-2">
            <Loader2 size={24} className="animate-spin mx-auto text-pco-blue" />
            <p className="text-sm text-ink-muted">
              {status === 'loading' ? 'Carregando Zoom SDK...' : 'Entrando na reuniao...'}
            </p>
          </div>
        </div>
      )}
      <div
        ref={containerRef}
        className="w-full min-h-[500px] rounded-xl overflow-hidden bg-black"
      />
    </div>
  );
}

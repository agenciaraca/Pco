import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, FileText, Clock, Bot, Loader2, Copy } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import * as api from '../data/api';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { CardListSkeleton } from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function SessionTranscript() {
  const { id } = useParams<{ id: string }>();
  useDocumentMeta({ title: 'Transcricao — AVA PCO' });

  const transcriptQ = useQuery({
    queryKey: ['transcript', id],
    queryFn: () => api.fetchSessionTranscript(id!),
    enabled: !!id,
    refetchInterval: (query) =>
      query.state.data?.status === 'processing' ? 5000 : false,
  });

  const transcript = transcriptQ.data;

  if (transcriptQ.isLoading) return <CardListSkeleton count={2} />;

  if (!transcript) {
    return (
      <div className="space-y-4">
        <Link to={`/eventos/${id}`} className="text-xs text-pco-blue hover:underline inline-flex items-center gap-1">
          <ArrowLeft size={11} /> Voltar
        </Link>
        <EmptyState title="Transcricao nao disponivel" description="Esta sessao ainda nao foi transcrita." />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <Link to={`/eventos/${id}`} className="text-xs text-pco-blue hover:underline inline-flex items-center gap-1">
        <ArrowLeft size={11} /> Voltar a sessao
      </Link>

      <header className="pco-card p-6">
        <h1 className="text-xl font-bold text-pco-deep flex items-center gap-2">
          <FileText size={18} className="text-pco-blue" />
          Transcricao
        </h1>
        <div className="flex flex-wrap gap-3 mt-2 text-xs text-ink-muted">
          <span className="flex items-center gap-1">
            <Clock size={11} />
            {formatTime(transcript.durationSeconds)} de audio
          </span>
          <span className={`pco-badge ${
            transcript.status === 'completed' ? 'bg-status-success/10 text-status-success'
              : transcript.status === 'processing' ? 'bg-pco-blue/10 text-pco-blue'
              : 'bg-status-danger/10 text-status-danger'
          }`}>
            {transcript.status === 'completed' ? 'Concluida'
              : transcript.status === 'processing' ? 'Em andamento...'
              : 'Falhou'}
          </span>
          <span>{transcript.provider} / {transcript.model}</span>
          <span>{transcript.language}</span>
        </div>
      </header>

      {transcript.status === 'processing' && (
        <div className="pco-card p-8 text-center">
          <Loader2 size={24} className="animate-spin mx-auto text-pco-blue mb-2" />
          <p className="text-sm text-ink-muted">Transcrevendo audio... Atualizando automaticamente.</p>
        </div>
      )}

      {transcript.status === 'failed' && (
        <div className="pco-card p-6 border-status-danger/30 bg-status-danger/5">
          <p className="text-sm text-status-danger font-medium">Erro na transcricao</p>
          <p className="text-xs text-ink-muted mt-1">{transcript.error}</p>
        </div>
      )}

      {transcript.aiSummary && (
        <section className="pco-card p-6">
          <h2 className="text-base font-bold text-pco-deep flex items-center gap-2 mb-3">
            <Bot size={16} className="text-pco-blue" />
            Resumo da IA
          </h2>
          <div className="text-sm text-ink-muted leading-relaxed whitespace-pre-line">
            {transcript.aiSummary}
          </div>
        </section>
      )}

      {transcript.segments.length > 0 && (
        <section className="pco-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-pco-deep">
              Transcricao completa ({transcript.segments.length} segmentos)
            </h2>
            <button
              onClick={() => navigator.clipboard?.writeText(transcript.fullText)}
              className="pco-btn-ghost text-xs"
            >
              <Copy size={11} /> Copiar texto
            </button>
          </div>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {transcript.segments.map((seg, i) => (
              <div key={i} className="flex gap-3 text-sm">
                <span className="text-[10px] text-ink-subtle font-mono shrink-0 pt-0.5 w-12 text-right">
                  {formatTime(seg.start)}
                </span>
                <div className="flex-1">
                  {seg.speaker && (
                    <span className="text-pco-blue text-xs font-medium mr-1">
                      [{seg.speaker}]
                    </span>
                  )}
                  <span className="text-ink-strong">{seg.text}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

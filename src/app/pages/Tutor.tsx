import { useEffect, useRef, useState } from 'react';
import { Bot, Send, AlertCircle, Sparkles, Loader2, Trash2 } from 'lucide-react';
import {
  useAskTutor,
  useTutorHistory,
  useClearTutorHistory,
  useTutorUsage,
} from '../data/hooks';
import { useToast } from '../components/Toast';
import { ApiError } from '../data/client';

const ATTRIB_NOTICE =
  'O Tutor Virtual responde apenas dúvidas pedagógicas relacionadas aos cursos da PCO. Ele não substitui professores, supervisão clínica, atendimento psicológico, médico ou jurídico.';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

export default function Tutor() {
  const ask = useAskTutor();
  const history = useTutorHistory();
  const clearHistory = useClearTutorHistory();
  const usage = useTutorUsage();
  const toast = useToast();
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'assistant',
      content:
        'Olá! Sou o Tutor Virtual da PCO. Posso te ajudar com dúvidas dos seus cursos. Como posso te apoiar hoje?',
    },
  ]);
  const [draft, setDraft] = useState('');
  const [providerInfo, setProviderInfo] = useState<{
    provider: string | null;
    model: string | null;
  }>({ provider: null, model: null });
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Quando o histórico carrega, prepende ao welcome message
  useEffect(() => {
    if (historyLoaded) return;
    if (!history.data) return;
    const turns = [...history.data].reverse(); // mais antigo primeiro
    if (turns.length === 0) {
      setHistoryLoaded(true);
      return;
    }
    const flat: Msg[] = [];
    for (const t of turns) {
      flat.push({ role: 'user', content: t.prompt });
      flat.push({ role: 'assistant', content: t.response });
    }
    setMessages((prev) => [...prev, ...flat]);
    setHistoryLoaded(true);
  }, [history.data, historyLoaded]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, ask.isPending]);

  async function handleClear() {
    if (!confirm('Limpar todo o histórico de conversas com o Tutor?')) return;
    try {
      await clearHistory.mutateAsync();
      setMessages([
        {
          role: 'assistant',
          content: 'Histórico limpo. Como posso te ajudar?',
        },
      ]);
      toast.success('Histórico apagado');
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  const send = async () => {
    const text = draft.trim();
    if (!text || ask.isPending) return;

    const newUserMsg: Msg = { role: 'user', content: text };
    const history = messages.filter((m) => m.role === 'user' || m.role === 'assistant');

    setMessages((prev) => [...prev, newUserMsg]);
    setDraft('');

    try {
      const reply = await ask.mutateAsync({
        message: text,
        history: history.slice(-10), // últimas 10
      });
      setMessages((prev) => [...prev, { role: 'assistant', content: reply.message }]);
      setProviderInfo({ provider: reply.provider, model: reply.model });
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'UNKNOWN';
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      if (code === 'STUDENT_LIMIT') {
        toast.warning('Limite atingido', message);
      } else {
        toast.error('Falha no Tutor', message);
      }
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            code === 'STUDENT_LIMIT'
              ? message
              : 'Tive um problema agora. Tente reformular a pergunta ou volte em alguns minutos.',
        },
      ]);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="pco-section-title">Tutor Virtual</h1>
          <p className="pco-section-subtitle mt-1">Apoio pedagógico baseado em IA.</p>
        </div>
        <div className="pco-card p-3 px-4 flex items-center gap-3">
          <Sparkles size={16} className="text-pco-blue" />
          <div className="text-xs">
            {providerInfo.provider ? (
              <>
                <div className="font-semibold text-pco-deep">
                  Conectado · {providerInfo.provider}
                </div>
                <div className="text-ink-subtle font-mono">{providerInfo.model}</div>
              </>
            ) : (
              <>
                <div className="font-semibold text-pco-deep">Pronto para conversar</div>
                <div className="text-ink-subtle">Provider ativo no admin</div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="pco-card border-pco-orange/30 bg-pco-orange/5 p-4 flex gap-3 items-start">
        <AlertCircle className="text-pco-orange shrink-0 mt-0.5" size={18} strokeWidth={1.75} />
        <p className="text-xs text-ink-muted flex-1">{ATTRIB_NOTICE}</p>
        {history.data && history.data.length > 0 && (
          <button
            onClick={handleClear}
            disabled={clearHistory.isPending}
            className="pco-btn-ghost text-[11px] shrink-0"
            title="Limpar histórico"
          >
            <Trash2 size={11} strokeWidth={2} />
            {clearHistory.isPending ? 'Limpando...' : 'Limpar'}
          </button>
        )}
      </div>

      {usage.data?.configured && usage.data.limit > 0 && (
        <div className="pco-card p-3">
          <div className="flex justify-between text-[11px] text-ink-muted">
            <span>Uso mensal</span>
            <span className="font-semibold text-pco-deep">
              {usage.data.used} / {usage.data.limit} perguntas
            </span>
          </div>
          <div className="mt-1.5 h-1.5 rounded-full bg-surface-gray overflow-hidden">
            <div
              className={
                usage.data.remaining === 0
                  ? 'h-full rounded-full bg-status-danger'
                  : usage.data.used / usage.data.limit > 0.8
                    ? 'h-full rounded-full bg-pco-orange'
                    : 'h-full rounded-full bg-gradient-to-r from-pco-blue to-pco-cyan'
              }
              style={{
                width: `${Math.min(100, Math.round((usage.data.used / usage.data.limit) * 100))}%`,
              }}
            />
          </div>
          {usage.data.remaining === 0 && (
            <p className="mt-2 text-[11px] text-status-danger">
              Limite mensal atingido. Pacotes adicionais em breve.
            </p>
          )}
        </div>
      )}

      <div className="pco-card p-0 overflow-hidden flex flex-col h-[60vh] min-h-[420px]">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 scroll-smooth">
          {messages.map((m, i) => (
            <Bubble key={i} role={m.role}>
              {m.content}
            </Bubble>
          ))}
          {ask.isPending && (
            <Bubble role="assistant">
              <span className="inline-flex items-center gap-2 text-ink-muted">
                <Loader2 size={12} className="animate-spin" />
                Pensando...
              </span>
            </Bubble>
          )}
        </div>

        <div className="border-t border-surface-gray p-3 bg-surface-off">
          <div className="flex items-center gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={
                usage.data?.configured && usage.data.remaining === 0
                  ? 'Limite mensal atingido'
                  : 'Pergunte sobre uma aula, conceito ou leitura...'
              }
              className="pco-input flex-1"
              maxLength={2000}
              disabled={
                ask.isPending ||
                (usage.data?.configured === true && usage.data.remaining === 0)
              }
            />
            <button
              onClick={send}
              disabled={
                ask.isPending ||
                !draft.trim() ||
                (usage.data?.configured === true && usage.data.remaining === 0)
              }
              className="pco-btn-primary"
              aria-label="Enviar"
            >
              {ask.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} strokeWidth={2} />
              )}
            </button>
          </div>
          <div className="mt-1.5 text-[10px] text-ink-subtle">
            Enter para enviar · Shift+Enter para quebrar linha · {draft.length}/2000
          </div>
        </div>
      </div>
    </div>
  );
}

function Bubble({ role, children }: { role: 'user' | 'assistant'; children: React.ReactNode }) {
  return (
    <div className={`flex gap-3 ${role === 'user' ? 'flex-row-reverse' : ''}`}>
      <div
        className={`h-8 w-8 rounded-xl shrink-0 grid place-items-center ${
          role === 'user' ? 'bg-pco-blue text-white' : 'bg-pco-blue/10 text-pco-blue'
        }`}
      >
        {role === 'user' ? 'V' : <Bot size={16} strokeWidth={1.75} />}
      </div>
      <div
        className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
          role === 'user' ? 'bg-pco-blue text-white' : 'bg-surface-gray text-pco-deep'
        }`}
      >
        {children}
      </div>
    </div>
  );
}

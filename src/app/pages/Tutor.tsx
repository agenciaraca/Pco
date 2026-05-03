import { useEffect, useRef, useState } from 'react';
import { Bot, Send, AlertCircle, Sparkles, Loader2 } from 'lucide-react';
import { useAskTutor } from '../data/hooks';
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
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, ask.isPending]);

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

      <div className="pco-card border-pco-orange/30 bg-pco-orange/5 p-4 flex gap-3">
        <AlertCircle className="text-pco-orange shrink-0" size={18} strokeWidth={1.75} />
        <p className="text-xs text-ink-muted">{ATTRIB_NOTICE}</p>
      </div>

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
              placeholder="Pergunte sobre uma aula, conceito ou leitura..."
              className="pco-input flex-1"
              maxLength={2000}
              disabled={ask.isPending}
            />
            <button
              onClick={send}
              disabled={ask.isPending || !draft.trim()}
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

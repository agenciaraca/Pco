import { useState } from 'react';
import { Bot, Send, AlertCircle, Sparkles } from 'lucide-react';

const ATTRIB_NOTICE =
  'O Tutor Virtual responde apenas dúvidas pedagógicas relacionadas aos cursos da PCO. Ele não substitui professores, supervisão clínica, atendimento psicológico, médico ou jurídico.';

interface Msg {
  role: 'user' | 'assistant';
  text: string;
}

const seedHistory: Msg[] = [
  {
    role: 'assistant',
    text: 'Olá! Sou o Tutor Virtual da PCO. Posso te ajudar com dúvidas dos seus cursos. Como posso te apoiar hoje?',
  },
];

export default function Tutor() {
  const [messages, setMessages] = useState<Msg[]>(seedHistory);
  const [draft, setDraft] = useState('');
  const credits = 32;
  const limit = 50;

  const send = () => {
    if (!draft.trim()) return;
    setMessages((prev) => [
      ...prev,
      { role: 'user', text: draft },
      {
        role: 'assistant',
        text: 'Ótima pergunta. Esta é uma resposta mockada do Tutor — a integração com o provedor de IA será feita em uma próxima fase.',
      },
    ]);
    setDraft('');
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
            <div className="font-semibold text-pco-deep">
              {credits}/{limit} perguntas neste mês
            </div>
            <div className="text-ink-subtle">Pacotes adicionais disponíveis</div>
          </div>
        </div>
      </header>

      <div className="pco-card border-pco-orange/30 bg-pco-orange/5 p-4 flex gap-3">
        <AlertCircle className="text-pco-orange shrink-0" size={18} strokeWidth={1.75} />
        <p className="text-xs text-ink-muted">{ATTRIB_NOTICE}</p>
      </div>

      <div className="pco-card p-0 overflow-hidden flex flex-col h-[60vh] min-h-[400px]">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`h-8 w-8 rounded-xl shrink-0 grid place-items-center ${
                  m.role === 'user'
                    ? 'bg-pco-blue text-white'
                    : 'bg-pco-blue/10 text-pco-blue'
                }`}
              >
                {m.role === 'user' ? 'V' : <Bot size={16} strokeWidth={1.75} />}
              </div>
              <div
                className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm ${
                  m.role === 'user'
                    ? 'bg-pco-blue text-white'
                    : 'bg-surface-gray text-pco-deep'
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-surface-gray p-3 bg-surface-off">
          <div className="flex items-center gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Pergunte sobre uma aula, conceito ou leitura..."
              className="pco-input flex-1"
            />
            <button onClick={send} className="pco-btn-primary">
              <Send size={14} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

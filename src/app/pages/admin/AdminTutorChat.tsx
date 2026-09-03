import { useState } from 'react';
import { Bot, Search, User, MessageSquare } from 'lucide-react';
import { useAdminTutorHistory } from '../../data/hooks';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import EmptyState from '../../components/EmptyState';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { useT } from '../../i18n';

export default function AdminTutorChat() {
  const t = useT();
  useDocumentMeta({ title: `${t('tutor.title')} — auditoria` });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(100);
  const list = useAdminTutorHistory({ search: search || undefined, limit });

  return (
    <div className="space-y-6 max-w-5xl">
      <header>
        <h1 className="text-2xl font-bold text-pco-deep flex items-center gap-2">
          <Bot size={20} className="text-pco-blue" strokeWidth={1.75} />
          {t('tutor.title')} — auditoria
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          Veja conversas alunos × tutor virtual para validar respostas e
          ajustar prompts. Sem retenção indefinida — apenas as últimas
          {' '}<code>200 turnos por aluno</code>.
        </p>
      </header>

      <div className="pco-card p-3 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[260px]">
          <Search size={13} className="text-ink-muted" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setSearch(searchInput.trim())}
            placeholder="Buscar em prompts ou respostas..."
            className="pco-input text-sm flex-1"
          />
          <button
            type="button"
            onClick={() => setSearch(searchInput.trim())}
            className="pco-btn-ghost text-xs"
          >
            Buscar
          </button>
        </div>
        <select
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          className="pco-input text-sm"
        >
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={250}>250</option>
          <option value={500}>500</option>
          <option value={1000}>1000</option>
        </select>
      </div>

      {list.isLoading ? (
        <CardListSkeleton count={3} />
      ) : (list.data ?? []).length === 0 ? (
        <EmptyState
          title="Sem conversas"
          description={
            search
              ? `Nenhuma conversa contém "${search}".`
              : 'Quando alunos usarem o Tutor Virtual, conversas aparecem aqui.'
          }
          icon={<MessageSquare size={28} className="text-pco-blue" />}
        />
      ) : (
        <ul className="space-y-3">
          {(list.data ?? []).map((t) => (
            <li key={t.id} className="pco-card p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-pco-blue/10 grid place-items-center">
                    <User size={14} className="text-pco-blue" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-pco-deep">
                      {t.userName}
                    </div>
                    <div className="text-xs text-ink-subtle">
                      {t.userEmail}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-ink-subtle text-right">
                  <div>{new Date(t.ts).toLocaleString('pt-BR')}</div>
                  {(t.provider || t.model) && (
                    <div className="font-mono">
                      {t.provider}/{t.model}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="bg-pco-blue/5 border-l-2 border-pco-blue p-2 rounded">
                  <div className="text-xs uppercase tracking-wide text-pco-blue font-semibold mb-0.5">
                    Pergunta do aluno
                  </div>
                  <div className="text-pco-deep whitespace-pre-wrap">
                    {t.prompt}
                  </div>
                </div>
                <div className="bg-status-success/5 border-l-2 border-status-success p-2 rounded">
                  <div className="text-xs uppercase tracking-wide text-status-success font-semibold mb-0.5">
                    Resposta do tutor
                  </div>
                  <div className="text-pco-deep whitespace-pre-wrap">
                    {t.response}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

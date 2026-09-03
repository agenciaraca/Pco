import { useMemo, useState } from 'react';
import {
  Activity,
  Search,
  Filter,
  Mail,
  Webhook,
  ShoppingBag,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { useActivityFeed } from '../../data/hooks';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { useT } from '../../i18n';
import type { ActivityKindDto } from '../../data/api';

const KIND_META: Record<
  ActivityKindDto,
  { label: string; color: string; Icon: typeof Activity }
> = {
  audit: {
    label: 'Audit',
    color: 'bg-pco-blue/10 text-pco-blue',
    Icon: ShieldCheck,
  },
  email_sent: {
    label: 'E-mail enviado',
    color: 'bg-status-success/10 text-status-success',
    Icon: Mail,
  },
  email_failed: {
    label: 'E-mail falhou',
    color: 'bg-status-danger/15 text-status-danger',
    Icon: AlertCircle,
  },
  webhook_success: {
    label: 'Webhook ok',
    color: 'bg-status-success/10 text-status-success',
    Icon: Webhook,
  },
  webhook_failed: {
    label: 'Webhook falhou',
    color: 'bg-status-danger/15 text-status-danger',
    Icon: Webhook,
  },
  reengagement: {
    label: 'Reengajamento',
    color: 'bg-pco-cyan/15 text-pco-cyan',
    Icon: Sparkles,
  },
  order_paid: {
    label: 'Pedido pago',
    color: 'bg-status-success/10 text-status-success',
    Icon: ShoppingBag,
  },
  order_refunded: {
    label: 'Reembolsado',
    color: 'bg-pco-orange/10 text-pco-orange',
    Icon: RefreshCw,
  },
  order_canceled: {
    label: 'Cancelado',
    color: 'bg-surface-gray text-ink-muted',
    Icon: ShoppingBag,
  },
};

const ALL_KINDS = Object.keys(KIND_META) as ActivityKindDto[];

export default function AdminActivity() {
  const t = useT();
  useDocumentMeta({ title: `${t('admin.nav.activity')} — Admin` });
  const [selectedKinds, setSelectedKinds] = useState<ActivityKindDto[]>([]);
  const [q, setQ] = useState('');

  const filter = useMemo(
    () => ({
      kinds: selectedKinds.length > 0 ? selectedKinds : undefined,
      q: q.trim() || undefined,
      limit: 300,
    }),
    [selectedKinds, q],
  );

  const feed = useActivityFeed(filter);

  function toggleKind(k: ActivityKindDto) {
    setSelectedKinds((prev) =>
      prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k],
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-pco-deep flex items-center gap-2">
          <Activity size={20} className="text-pco-blue" strokeWidth={1.75} />
          {t('admin.nav.activity')}
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          Timeline cross-entity: audit log, e-mails, webhooks, reengajamento, pedidos.
          Atualiza a cada 30s.
        </p>
      </header>

      <section className="pco-card p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-pco-deep">
          <Filter size={14} className="text-pco-blue" strokeWidth={1.75} />
          Filtros
        </div>
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por label, detalhe, ator, alvo..."
            className="pco-input pl-9 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ALL_KINDS.map((k) => {
            const meta = KIND_META[k];
            const active = selectedKinds.includes(k);
            return (
              <button
                key={k}
                type="button"
                onClick={() => toggleKind(k)}
                className={`pco-badge text-xs px-2 py-1 ${
                  active ? meta.color : 'bg-surface-gray text-ink-muted'
                }`}
              >
                <meta.Icon size={10} strokeWidth={2} />
                {meta.label}
              </button>
            );
          })}
          {selectedKinds.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedKinds([])}
              className="pco-btn-ghost text-xs"
            >
              limpar
            </button>
          )}
        </div>
      </section>

      <section>
        <div className="text-xs text-ink-muted mb-2">
          {feed.isLoading
            ? 'Carregando...'
            : `${(feed.data ?? []).length} evento(s)`}
        </div>
        {(feed.data ?? []).length === 0 ? (
          <div className="pco-card p-6 text-center text-sm text-ink-muted">
            Nenhum evento para os filtros selecionados.
          </div>
        ) : (
          <ul className="space-y-1">
            {(feed.data ?? []).map((it) => {
              const meta = KIND_META[it.kind];
              const Icon = meta.Icon;
              return (
                <li
                  key={it.id}
                  className="pco-card p-3 flex items-start gap-3 hover:bg-surface-mute"
                >
                  <span
                    className={`pco-badge ${meta.color} shrink-0 mt-0.5 text-xs`}
                  >
                    <Icon size={10} strokeWidth={2} />
                    {meta.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-pco-deep truncate">
                      {it.label}
                    </div>
                    {it.detail && (
                      <div className="text-xs text-ink-muted truncate">{it.detail}</div>
                    )}
                    <div className="text-xs text-ink-subtle mt-0.5">
                      {new Date(it.ts).toLocaleString('pt-BR')}
                      {it.actor && (
                        <>
                          {' · '}
                          <span className="text-pco-blue">{it.actor}</span>
                        </>
                      )}
                      {it.target && (
                        <>
                          {' → '}
                          <span>{it.target}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {it.link && (
                    <a
                      href={it.link}
                      className="text-xs text-pco-blue hover:underline shrink-0"
                    >
                      Abrir
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

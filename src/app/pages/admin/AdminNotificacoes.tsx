import { useState } from 'react';
import {
  Send,
  Megaphone,
  AlertCircle,
  CheckCircle2,
  Info,
  AlertTriangle,
  History,
  Users,
} from 'lucide-react';
import {
  useBroadcastNotification,
  useSystemUsers,
  useSentBroadcasts,
} from '../../data/hooks';
import { useToast } from '../../components/Toast';
import Tabs from '../../components/Tabs';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import EmptyState from '../../components/EmptyState';
import type { BroadcastNotificationInput, NotificationDto } from '../../data/api';
import { SemConexao, FalhaAoCarregar } from '../../components/EstadosDeConsulta';

const audiences: Array<{ value: BroadcastNotificationInput['audience']; label: string; desc: string }> = [
  { value: 'all', label: 'Todos', desc: 'Alunos + administradores ativos' },
  { value: 'students', label: 'Apenas alunos', desc: 'Somente perfis de aluno' },
  { value: 'admins', label: 'Apenas admins', desc: 'Admins e superadmin' },
  { value: 'user', label: 'Usuário específico', desc: 'Somente um destinatário' },
];

const categories: Array<{ value: NotificationDto['category']; label: string; Icon: typeof Info }> = [
  { value: 'info', label: 'Informativo', Icon: Info },
  { value: 'success', label: 'Sucesso', Icon: CheckCircle2 },
  { value: 'warning', label: 'Atenção', Icon: AlertTriangle },
  { value: 'danger', label: 'Crítico', Icon: AlertCircle },
  { value: 'announcement', label: 'Anúncio', Icon: Megaphone },
];

export default function AdminNotificacoes() {
  const broadcast = useBroadcastNotification();
  const users = useSystemUsers();
  const sent = useSentBroadcasts();
  const toast = useToast();
  const [tab, setTab] = useState<'compose' | 'history'>('compose');

  const [audience, setAudience] = useState<BroadcastNotificationInput['audience']>('students');
  const [userId, setUserId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<NotificationDto['category']>('info');
  const [link, setLink] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (title.trim().length < 2) {
      setError('Informe um título.');
      return;
    }
    if (body.trim().length < 2) {
      setError('Informe a mensagem.');
      return;
    }
    if (audience === 'user' && !userId) {
      setError('Selecione o usuário destino.');
      return;
    }
    try {
      const res = await broadcast.mutateAsync({
        audience,
        userId: audience === 'user' ? userId : undefined,
        title: title.trim(),
        body: body.trim(),
        category,
        link: link.trim() || undefined,
      });
      toast.success(`Enviado para ${res.sent} destinatário${res.sent === 1 ? '' : 's'}`);
      setTitle('');
      setBody('');
      setLink('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar notificação.');
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <h1 className="text-2xl font-bold text-pco-deep">Notificações</h1>
        <p className="text-sm text-ink-muted">
          Dispare comunicados in-app e veja histórico de envios.
        </p>
      </header>

      <Tabs
        items={[
          {
            id: 'compose',
            label: 'Novo broadcast',
            icon: <Send size={14} strokeWidth={1.75} />,
          },
          {
            id: 'history',
            label: 'Histórico',
            icon: <History size={14} strokeWidth={1.75} />,
          },
        ]}
        active={tab}
        onChange={(id) => setTab(id as typeof tab)}
      />

      {tab === 'history' && (
        <div className="space-y-3">
          {sent.fetchStatus === 'paused' ? (
            <SemConexao oQue="os envios" />
          ) : sent.isError ? (
            <FalhaAoCarregar
              erro={sent.error}
              oQue="os envios"
              aoTentarDeNovo={() => void sent.refetch()}
            />
          ) : sent.isPending ? (
            <CardListSkeleton count={4} />
          ) : !sent.data || sent.data.length === 0 ? (
            <EmptyState
              title="Nenhum broadcast enviado"
              description="Quando você disparar uma notificação, ela aparecerá aqui."
            />
          ) : (
            sent.data.map((b, i) => (
              <div key={`${b.firstAt}-${i}`} className="pco-card p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-pco-deep">{b.title}</div>
                    <p className="mt-0.5 text-xs text-ink-muted line-clamp-2">{b.body}</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-ink-subtle">
                      <span>{new Date(b.firstAt).toLocaleString('pt-BR')}</span>
                      {b.authorEmail && <span>· por {b.authorEmail}</span>}
                      <span>· categoria {b.category}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="inline-flex items-center gap-1 text-xs font-semibold text-pco-deep">
                      <Users size={12} strokeWidth={2} />
                      {b.recipientsCount}
                    </div>
                    <div className="text-xs text-ink-subtle">
                      {b.readCount} leu{b.readCount === 1 ? '' : 'ram'}
                    </div>
                    <div className="text-xs text-ink-subtle">
                      {b.recipientsCount > 0
                        ? Math.round((b.readCount / b.recipientsCount) * 100)
                        : 0}
                      % aberto
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'compose' && (
      <form onSubmit={onSubmit} className="pco-card p-6 space-y-5">
        <div>
          <label className="text-xs uppercase tracking-wide text-ink-muted">Destinatários</label>
          <div className="grid gap-2 sm:grid-cols-2 mt-2">
            {audiences.map((a) => (
              <label
                key={a.value}
                className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer ${
                  audience === a.value
                    ? 'border-pco-blue bg-pco-blue/5'
                    : 'border-surface-gray hover:bg-surface-off'
                }`}
              >
                <input
                  type="radio"
                  name="audience"
                  value={a.value}
                  checked={audience === a.value}
                  onChange={() => setAudience(a.value)}
                  className="mt-1"
                />
                <div>
                  <div className="text-sm font-semibold text-pco-deep">{a.label}</div>
                  <div className="text-xs text-ink-muted">{a.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {audience === 'user' && (
          <div>
            <label className="text-xs uppercase tracking-wide text-ink-muted">Usuário destino</label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="pco-input mt-1 text-sm"
            >
              <option value="">— selecione —</option>
              {(users.data ?? [])
                .filter((u) => u.active)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email}) · {u.role}
                  </option>
                ))}
            </select>
          </div>
        )}

        <div>
          <label className="text-xs uppercase tracking-wide text-ink-muted">Categoria</label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-2">
            {categories.map((c) => {
              const Icon = c.Icon;
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  className={`flex items-center justify-center gap-1.5 p-2 rounded-lg border text-xs ${
                    category === c.value
                      ? 'border-pco-blue bg-pco-blue/10 text-pco-blue font-semibold'
                      : 'border-surface-gray text-ink-muted hover:bg-surface-off'
                  }`}
                >
                  <Icon size={12} strokeWidth={2} />
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="text-xs uppercase tracking-wide text-ink-muted">Título</label>
          <input
            type="text"
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Nova aula liberada"
            className="pco-input mt-1 text-sm"
          />
        </div>

        <div>
          <label className="text-xs uppercase tracking-wide text-ink-muted">Mensagem</label>
          <textarea
            maxLength={2000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="Detalhe a notificação..."
            className="pco-input mt-1 text-sm resize-none"
          />
        </div>

        <div>
          <label className="text-xs uppercase tracking-wide text-ink-muted">
            Link (opcional)
          </label>
          <input
            type="text"
            maxLength={500}
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="/jornada ou https://..."
            className="pco-input mt-1 text-sm"
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-status-danger/10 p-2 text-xs text-status-danger">
            <AlertCircle size={14} strokeWidth={2} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button type="submit" disabled={broadcast.isPending} className="pco-btn-primary text-sm">
          <Send size={14} strokeWidth={2} />
          {broadcast.isPending ? 'Enviando...' : 'Enviar notificação'}
        </button>
      </form>
      )}
    </div>
  );
}

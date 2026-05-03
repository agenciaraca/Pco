import { useState } from 'react';
import { Send, Megaphone, AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';
import { useBroadcastNotification, useSystemUsers } from '../../data/hooks';
import { useToast } from '../../components/Toast';
import type { BroadcastNotificationInput, NotificationDto } from '../../data/api';

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
  const toast = useToast();

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
          Dispare comunicados in-app para alunos ou administradores.
        </p>
      </header>

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
    </div>
  );
}

import { useMemo, useState } from 'react';
import { ShieldOff, Search, Activity, Power } from 'lucide-react';
import { useSessions, useForceLogout } from '../../data/hooks';
import { useToast } from '../../components/Toast';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { SemConexao, FalhaAoCarregar } from '../../components/EstadosDeConsulta';

export default function AdminSessoes() {
  useDocumentMeta({ title: 'Sessões — Admin' });
  const sessions = useSessions();
  const forceLogout = useForceLogout();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [onlyActive, setOnlyActive] = useState(true);

  const list = useMemo(() => {
    let r = sessions.data ?? [];
    if (onlyActive) r = r.filter((s) => s.hasLikelyActiveSession);
    if (q.trim()) {
      const s = q.toLowerCase();
      r = r.filter(
        (x) => x.email.toLowerCase().includes(s) || x.name.toLowerCase().includes(s),
      );
    }
    return r.sort((a, b) => {
      const aT = a.lastLoginAt ? new Date(a.lastLoginAt).getTime() : 0;
      const bT = b.lastLoginAt ? new Date(b.lastLoginAt).getTime() : 0;
      return bT - aT;
    });
  }, [sessions.data, q, onlyActive]);

  async function handleLogout(id: string, email: string) {
    if (!confirm(`Forçar logout de ${email}? Todos os dispositivos serão desconectados.`)) {
      return;
    }
    try {
      await forceLogout.mutateAsync(id);
      toast.success('Logout forçado', email);
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  const total = sessions.data?.length ?? 0;
  const active = (sessions.data ?? []).filter((s) => s.hasLikelyActiveSession).length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-pco-deep flex items-center gap-2">
          <Activity size={20} className="text-pco-blue" strokeWidth={1.75} />
          Sessões e segurança
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          Visão consolidada de quem está ativo. "Sessão provável" = login nos últimos 30
          dias e conta ativa. Forçar logout invalida todos os tokens do usuário.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Total de usuários" value={total} />
        <Stat label="Sessões prováveis ativas" value={active} accent="success" />
        <Stat
          label="Com 2FA"
          value={(sessions.data ?? []).filter((s) => s.totpEnabled).length}
          accent="blue"
        />
      </div>

      <div className="pco-card p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search
            size={14}
            strokeWidth={1.75}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar nome ou e-mail..."
            className="pco-input pl-9"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={onlyActive}
            onChange={(e) => setOnlyActive(e.target.checked)}
            className="accent-pco-blue"
          />
          Só sessões prováveis ativas
        </label>
      </div>

      {sessions.fetchStatus === 'paused' ? (
        <SemConexao oQue="os agendamentos" />
      ) : sessions.isError ? (
        <FalhaAoCarregar
          erro={sessions.error}
          oQue="os agendamentos"
          aoTentarDeNovo={() => void sessions.refetch()}
        />
      ) : sessions.isPending ? (
        <div className="text-sm text-ink-muted">Carregando...</div>
      ) : list.length === 0 ? (
        <div className="pco-card p-6 text-center text-sm text-ink-muted">
          Nenhuma sessão correspondente.
        </div>
      ) : (
        <div className="pco-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-mute text-xs uppercase text-ink-muted">
              <tr>
                <th className="text-left px-3 py-2">Usuário</th>
                <th className="text-left px-3 py-2">Papel</th>
                <th className="text-left px-3 py-2">Último login</th>
                <th className="text-left px-3 py-2">Token v.</th>
                <th className="text-left px-3 py-2">2FA</th>
                <th className="text-left px-3 py-2">Sessão</th>
                <th className="text-right px-3 py-2">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-mute">
              {list.map((s) => (
                <tr key={s.id}>
                  <td className="px-3 py-2">
                    <div className="font-semibold text-pco-deep">{s.name}</div>
                    <div className="text-xs text-ink-subtle">{s.email}</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-ink-muted">{s.role}</td>
                  <td className="px-3 py-2 text-xs text-ink-muted whitespace-nowrap">
                    {s.lastLoginAt
                      ? new Date(s.lastLoginAt).toLocaleString('pt-BR')
                      : 'Nunca'}
                  </td>
                  <td className="px-3 py-2 text-xs text-ink-muted">{s.tokenVersion}</td>
                  <td className="px-3 py-2">
                    {s.totpEnabled ? (
                      <span className="pco-badge bg-status-success/10 text-status-success">
                        ativo
                      </span>
                    ) : (
                      <span className="pco-badge bg-surface-gray text-ink-muted">
                        sem 2FA
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {s.hasLikelyActiveSession ? (
                      <span className="pco-badge bg-pco-blue/10 text-pco-blue">
                        provável
                      </span>
                    ) : !s.active ? (
                      <span className="pco-badge bg-surface-gray text-ink-muted">
                        inativo
                      </span>
                    ) : (
                      <span className="pco-badge bg-surface-gray text-ink-muted">
                        sem sessão
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {s.hasLikelyActiveSession && (
                      <button
                        type="button"
                        onClick={() => handleLogout(s.id, s.email)}
                        disabled={forceLogout.isPending}
                        className="pco-btn-ghost text-xs text-status-danger"
                      >
                        <ShieldOff size={11} strokeWidth={2} />
                        Forçar logout
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: 'success' | 'blue';
}) {
  const color =
    accent === 'success'
      ? 'text-status-success'
      : accent === 'blue'
        ? 'text-pco-blue'
        : 'text-pco-deep';
  return (
    <div className="pco-card p-4">
      <div className="text-xs uppercase tracking-wide text-ink-muted">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

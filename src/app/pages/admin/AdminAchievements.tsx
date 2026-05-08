import { Award, Users, Trophy } from 'lucide-react';
import { useAchievementsStats } from '../../data/hooks';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import EmptyState from '../../components/EmptyState';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { useT } from '../../i18n';

export default function AdminAchievements() {
  const t = useT();
  useDocumentMeta({ title: `${t('admin.nav.achievements')} — Admin AVA PCO` });
  const { data, isLoading } = useAchievementsStats();

  if (isLoading || !data) return <CardListSkeleton count={5} />;

  const maxAwarded = Math.max(...data.badges.map((b) => b.awarded), 1);

  return (
    <div className="space-y-6 max-w-4xl">
      <header>
        <h1 className="text-2xl font-bold text-pco-deep flex items-center gap-2">
          <Award size={20} className="text-status-gold" strokeWidth={1.75} />
          {t('admin.nav.achievements')}
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          Distribuição de badges concedidos. Sistema concede automaticamente
          conforme aluno cumpre critérios (1ª aula, sequências, cursos
          concluídos).
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Total concedido"
          value={data.totalAwarded}
          icon={<Award size={14} className="text-status-gold" />}
        />
        <Stat
          label="Alunos premiados"
          value={data.uniqueRecipients}
          icon={<Users size={14} className="text-pco-blue" />}
        />
        <Stat
          label="Tipos de badge"
          value={data.badges.length}
          icon={<Trophy size={14} className="text-pco-cyan" />}
        />
      </div>

      <section>
        <h2 className="text-base font-semibold text-pco-deep mb-3">
          Distribuição por badge
        </h2>
        <ul className="space-y-2">
          {data.badges.map((b) => (
            <li key={b.id} className="pco-card p-3">
              <div className="flex items-start gap-3">
                <span className="text-3xl shrink-0">{b.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-pco-deep">{b.name}</h3>
                    <span className="text-sm font-bold text-pco-deep">
                      {b.awarded}{' '}
                      <span className="text-[11px] text-ink-subtle font-normal">
                        concedido(s)
                      </span>
                    </span>
                  </div>
                  <p className="text-xs text-ink-muted mt-0.5">{b.description}</p>
                  <div className="mt-2 h-1.5 rounded-full bg-surface-gray overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        b.awarded === 0
                          ? 'bg-ink-subtle/20'
                          : 'bg-gradient-to-r from-status-gold to-pco-orange'
                      }`}
                      style={{ width: `${(b.awarded / maxAwarded) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-base font-semibold text-pco-deep mb-3">
          Top alunos por conquistas
        </h2>
        {data.topUsers.length === 0 ? (
          <EmptyState
            title="Sem conquistas ainda"
            description="Quando alunos completarem aulas, os badges serão concedidos."
            icon={<Award size={28} className="text-pco-blue" />}
          />
        ) : (
          <div className="pco-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-mute text-ink-muted text-[11px] uppercase">
                <tr>
                  <th className="text-left px-3 py-2 w-10">#</th>
                  <th className="text-left px-3 py-2">Aluno</th>
                  <th className="text-right px-3 py-2">Conquistas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-mute">
                {data.topUsers.map((u, i) => (
                  <tr key={u.userId} className="hover:bg-surface-mute/40">
                    <td className="px-3 py-2 text-ink-muted font-mono">
                      #{i + 1}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-semibold text-pco-deep">{u.name}</div>
                      <div className="text-[11px] text-ink-subtle">
                        {u.email}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-status-gold">
                      {u.count} 🏆
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="pco-card p-3">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-ink-muted">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold text-pco-deep mt-1">{value}</div>
    </div>
  );
}

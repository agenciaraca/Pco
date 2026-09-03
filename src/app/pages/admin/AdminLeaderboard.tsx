import { useState } from 'react';
import { Trophy, Award, Flame, BookOpen, Loader2, Download } from 'lucide-react';
import { useLeaderboard } from '../../data/hooks';
import { downloadLeaderboardCsv } from '../../data/api';
import { useToast } from '../../components/Toast';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import EmptyState from '../../components/EmptyState';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import type { LeaderboardEntryDto } from '../../data/api';
import { useT } from '../../i18n';

const RANGES = [
  { value: 7, label: '7 dias' },
  { value: 30, label: '30 dias' },
  { value: 90, label: '90 dias' },
];

export default function AdminLeaderboard() {
  const t = useT();
  useDocumentMeta({ title: 'Leaderboard — Admin AVA PCO' });
  const [days, setDays] = useState(30);
  const [limit, setLimit] = useState(20);
  const { data, isLoading } = useLeaderboard(days, limit);
  const toast = useToast();

  async function handleExport() {
    try {
      await downloadLeaderboardCsv(days, limit);
      toast.success('CSV baixado');
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-pco-deep flex items-center gap-2">
            <Trophy size={20} className="text-status-gold" strokeWidth={1.75} />
            {t('admin.nav.leaderboard')}
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Ranking de alunos por aulas concluídas, dias ativos e conquistas no
            período. Score = aulas×10 + dias_ativos×5 + conquistas×2.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-lg border border-pco-border overflow-hidden">
            {RANGES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setDays(r.value)}
                className={`px-3 py-1.5 text-xs ${
                  days === r.value
                    ? 'bg-pco-blue/10 text-pco-blue font-semibold'
                    : 'text-ink-muted hover:bg-surface-mute'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="pco-input text-sm"
          >
            <option value={10}>Top 10</option>
            <option value={20}>Top 20</option>
            <option value={50}>Top 50</option>
            <option value={100}>Top 100</option>
          </select>
          <button
            type="button"
            onClick={handleExport}
            className="pco-btn-ghost text-xs"
            title="Baixar leaderboard como CSV"
          >
            <Download size={11} strokeWidth={2} />
            CSV
          </button>
        </div>
      </header>

      {isLoading ? (
        <CardListSkeleton count={5} />
      ) : !data || data.entries.length === 0 ? (
        <EmptyState
          title="Sem atividade no período"
          description="Nenhum aluno completou aulas nos últimos dias."
          icon={<Trophy size={28} className="text-pco-blue" />}
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {data.entries.slice(0, 3).map((e) => (
              <PodiumCard key={e.userId} entry={e} />
            ))}
          </div>

          {data.entries.length > 3 && (
            <div className="pco-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface-mute text-ink-muted text-xs uppercase">
                  <tr>
                    <th className="text-left px-3 py-2 w-12">#</th>
                    <th className="text-left px-3 py-2">Aluno</th>
                    <th className="text-right px-3 py-2">Aulas</th>
                    <th className="text-right px-3 py-2">Dias ativos</th>
                    <th className="text-right px-3 py-2">Conquistas</th>
                    <th className="text-right px-3 py-2">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-mute">
                  {data.entries.slice(3).map((e) => (
                    <tr key={e.userId} className="hover:bg-surface-mute/40">
                      <td className="px-3 py-2 text-ink-muted font-mono">
                        #{e.rank}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-semibold text-pco-deep">
                          {e.userName}
                        </div>
                        <div className="text-xs text-ink-subtle">
                          {e.userEmail}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right text-pco-blue font-semibold">
                        {e.lessonsCompleted}
                      </td>
                      <td className="px-3 py-2 text-right text-pco-cyan font-semibold">
                        {e.activeDays}
                      </td>
                      <td className="px-3 py-2 text-right text-pco-orange font-semibold">
                        {e.achievements}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-pco-deep">
                        {e.score}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <div className="text-xs text-ink-subtle">
        Período:{' '}
        {data && new Date(data.range.from).toLocaleDateString('pt-BR')} →{' '}
        {data && new Date(data.range.to).toLocaleDateString('pt-BR')} ·{' '}
        {data?.total ?? 0} aluno(s) ativos no total
      </div>
    </div>
  );
}

function PodiumCard({ entry }: { entry: LeaderboardEntryDto }) {
  const rankStyle = {
    1: 'bg-gradient-to-br from-status-gold to-pco-orange text-white',
    2: 'bg-gradient-to-br from-pco-blue to-pco-cyan text-white',
    3: 'bg-gradient-to-br from-pco-cyan to-pco-cyan-light text-white',
  }[entry.rank as 1 | 2 | 3] ?? 'bg-surface-mute text-pco-deep';

  return (
    <div className="pco-card p-0 overflow-hidden">
      <div className={`p-4 ${rankStyle}`}>
        <div className="flex items-start justify-between">
          <Trophy size={28} strokeWidth={1.5} />
          <span className="text-3xl font-black opacity-90">#{entry.rank}</span>
        </div>
        <div className="mt-3 text-sm font-bold leading-tight">
          {entry.userName}
        </div>
        <div className="text-xs opacity-80 truncate">{entry.userEmail}</div>
      </div>
      <div className="p-3 grid grid-cols-3 gap-2 text-center">
        <Stat
          icon={<BookOpen size={11} />}
          label="aulas"
          value={entry.lessonsCompleted}
        />
        <Stat
          icon={<Flame size={11} />}
          label="dias"
          value={entry.activeDays}
        />
        <Stat
          icon={<Award size={11} />}
          label="cnq"
          value={entry.achievements}
        />
      </div>
      <div className="px-3 pb-3 text-center">
        <span className="text-xs uppercase tracking-wide text-ink-muted">
          score
        </span>
        <div className="text-lg font-bold text-pco-deep">{entry.score}</div>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1 text-xs uppercase tracking-wide text-ink-muted">
        {icon}
        {label}
      </div>
      <div className="text-base font-bold text-pco-deep">{value}</div>
    </div>
  );
}

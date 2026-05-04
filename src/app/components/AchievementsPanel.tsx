import { Award, RefreshCw } from 'lucide-react';
import { useMyAchievements, useRefreshMyAchievements } from '../data/hooks';
import { useToast } from './Toast';
import type { BadgeIdDto } from '../data/api';

export default function AchievementsPanel() {
  const { data, isLoading } = useMyAchievements();
  const refresh = useRefreshMyAchievements();
  const toast = useToast();

  const awardedSet = new Set((data?.awarded ?? []).map((a) => a.badgeId));
  const allBadges = data ? (Object.values(data.catalog) as Array<{
    id: BadgeIdDto;
    name: string;
    description: string;
    icon: string;
  }>) : [];

  return (
    <section className="pco-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-pco-deep flex items-center gap-2">
          <Award size={14} className="text-pco-orange" strokeWidth={1.75} />
          Conquistas
        </h3>
        <button
          type="button"
          onClick={async () => {
            try {
              const r = await refresh.mutateAsync();
              if (r.granted.length > 0) {
                toast.success(
                  `${r.granted.length} nova(s) conquista(s)!`,
                  r.granted.map((b) => b.badgeId).join(', '),
                );
              } else {
                toast.info('Tudo em dia');
              }
            } catch (err) {
              toast.error('Falha', err instanceof Error ? err.message : 'Erro');
            }
          }}
          disabled={refresh.isPending}
          className="pco-btn-ghost text-xs"
        >
          <RefreshCw size={11} strokeWidth={2} className={refresh.isPending ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {isLoading ? (
        <div className="text-xs text-ink-muted">Carregando...</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {allBadges.map((b) => {
            const earned = awardedSet.has(b.id);
            return (
              <div
                key={b.id}
                className={`rounded-lg border p-3 text-center ${
                  earned
                    ? 'border-pco-orange/40 bg-pco-orange/5'
                    : 'border-pco-border bg-surface-mute opacity-60'
                }`}
                title={b.description}
              >
                <div className="text-3xl mb-1">{b.icon}</div>
                <div className="text-xs font-semibold text-pco-deep">{b.name}</div>
                <div className="text-[10px] text-ink-muted line-clamp-2 mt-0.5">
                  {b.description}
                </div>
                {!earned && (
                  <div className="text-[10px] text-ink-subtle mt-1">— bloqueado —</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

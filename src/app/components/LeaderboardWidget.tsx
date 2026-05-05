import { Trophy, Crown, BookOpen, Flame, Award } from 'lucide-react';
import { useMyRank, usePublicLeaderboard, useCurrentStudent } from '../data/hooks';

export default function LeaderboardWidget() {
  const top = usePublicLeaderboard(30, 5);
  const myRank = useMyRank(30);
  const me = useCurrentStudent();

  if (top.isLoading || !top.data) {
    return null;
  }

  if (top.data.entries.length === 0) {
    return null;
  }

  const myUserId = (me.data as { id?: string } | undefined)?.id;
  const myRankNumber = myRank.data?.rank ?? 0;
  const inTop = top.data.entries.some((e) => e.userId === myUserId);

  return (
    <div className="pco-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Trophy size={16} className="text-status-gold" strokeWidth={1.75} />
        <h3 className="text-sm font-semibold text-pco-deep">Ranking 30 dias</h3>
        <span className="ml-auto text-[10px] text-ink-subtle">
          {top.data.total} aluno(s)
        </span>
      </div>

      <ol className="space-y-1.5">
        {top.data.entries.map((e) => {
          const isMe = e.userId === myUserId;
          return (
            <li
              key={e.userId}
              className={`flex items-center gap-2 p-2 rounded text-xs ${
                isMe ? 'bg-pco-blue/10 border border-pco-blue/30' : 'bg-surface-mute'
              }`}
            >
              <span
                className={`h-6 w-6 rounded-full grid place-items-center text-[10px] font-bold shrink-0 ${
                  e.rank === 1
                    ? 'bg-status-gold/20 text-status-gold'
                    : e.rank === 2
                      ? 'bg-pco-cyan/15 text-pco-cyan'
                      : e.rank === 3
                        ? 'bg-pco-orange/10 text-pco-orange'
                        : 'bg-surface-gray text-ink-muted'
                }`}
              >
                {e.rank === 1 ? <Crown size={10} /> : `#${e.rank}`}
              </span>
              <span
                className={`flex-1 truncate ${isMe ? 'font-bold text-pco-blue' : 'text-pco-deep'}`}
              >
                {e.displayName}
                {isMe && ' (você)'}
              </span>
              <span className="flex items-center gap-2 text-[10px] text-ink-muted">
                <span className="flex items-center gap-0.5">
                  <BookOpen size={9} />
                  {e.lessonsCompleted}
                </span>
                <span className="flex items-center gap-0.5">
                  <Flame size={9} />
                  {e.activeDays}d
                </span>
              </span>
              <span className="text-[10px] font-bold text-pco-deep w-8 text-right">
                {e.score}
              </span>
            </li>
          );
        })}
      </ol>

      {!inTop && myRankNumber > 0 && myRank.data?.entry && (
        <div className="mt-2 p-2 rounded bg-pco-blue/5 border border-pco-blue/30 flex items-center gap-2 text-xs">
          <span className="h-6 w-6 rounded-full bg-pco-blue/20 text-pco-blue grid place-items-center text-[10px] font-bold shrink-0">
            #{myRankNumber}
          </span>
          <span className="flex-1 font-bold text-pco-blue">Você</span>
          <span className="flex items-center gap-2 text-[10px] text-ink-muted">
            <span className="flex items-center gap-0.5">
              <BookOpen size={9} />
              {myRank.data.entry.lessonsCompleted}
            </span>
            <span className="flex items-center gap-0.5">
              <Flame size={9} />
              {myRank.data.entry.activeDays}d
            </span>
            <span className="flex items-center gap-0.5">
              <Award size={9} />
              {myRank.data.entry.achievements}
            </span>
          </span>
          <span className="text-[10px] font-bold text-pco-blue w-8 text-right">
            {myRank.data.entry.score}
          </span>
        </div>
      )}

      {myRankNumber === 0 && (
        <div className="mt-2 text-[11px] text-ink-subtle text-center">
          Conclua aulas para entrar no ranking
        </div>
      )}
    </div>
  );
}

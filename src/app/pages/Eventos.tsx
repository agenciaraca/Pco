import { Video, Calendar, ExternalLink, Users } from 'lucide-react';
import { useMyLiveSessions, useCourses } from '../data/hooks';
import { CardListSkeleton } from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

export default function Eventos() {
  useDocumentMeta({ title: 'Encontros ao vivo — AVA PCO' });
  const { data: sessions = [], isLoading } = useMyLiveSessions();
  const { data: courses = [] } = useCourses();

  if (isLoading) return <CardListSkeleton count={3} />;

  const live = sessions.filter((s) => s.statusComputed === 'live');
  const upcoming = sessions.filter((s) => s.statusComputed === 'scheduled');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="pco-section-title flex items-center gap-2">
          <Video size={20} className="text-pco-blue" strokeWidth={1.75} />
          Encontros ao vivo
        </h1>
        <p className="pco-section-subtitle mt-1">
          Aulas, mentorias e encontros ao vivo agendados pela escola.
        </p>
      </header>

      {live.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-status-success mb-2">
            🔴 Acontecendo agora
          </h2>
          <ul className="space-y-2">
            {live.map((s) => (
              <SessionCard key={s.id} session={s} courses={courses} highlight />
            ))}
          </ul>
        </section>
      )}

      {upcoming.length === 0 && live.length === 0 ? (
        <EmptyState
          title="Sem encontros agendados"
          description="Quando a escola agendar uma sessão ao vivo, ela aparecerá aqui."
        />
      ) : upcoming.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold text-pco-deep mb-2">Próximos encontros</h2>
          <ul className="space-y-2">
            {upcoming.map((s) => (
              <SessionCard key={s.id} session={s} courses={courses} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function SessionCard({
  session,
  courses,
  highlight,
}: {
  session: import('../data/api').LiveSessionDto;
  courses: Array<{ id: string; title: string }>;
  highlight?: boolean;
}) {
  const start = new Date(session.startAt);
  const courseTitle = courses.find((c) => c.id === session.courseId)?.title;
  return (
    <li
      className={`pco-card p-4 ${
        highlight ? 'border-status-success/40 bg-status-success/5' : ''
      }`}
    >
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[260px]">
          <div className="text-base font-semibold text-pco-deep">{session.title}</div>
          {session.description && (
            <p className="mt-0.5 text-xs text-ink-muted">{session.description}</p>
          )}
          <div className="mt-1 text-[11px] text-ink-subtle inline-flex items-center gap-2 flex-wrap">
            <Calendar size={10} strokeWidth={2} />
            {start.toLocaleString('pt-BR')} · {session.durationMinutes} min
            {session.hostName && (
              <>
                <Users size={10} strokeWidth={2} />
                {session.hostName}
              </>
            )}
            {courseTitle && <> · {courseTitle}</>}
          </div>
        </div>
        <a
          href={session.joinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={highlight ? 'pco-btn-primary text-xs' : 'pco-btn-secondary text-xs'}
        >
          <ExternalLink size={12} strokeWidth={2} />
          {session.statusComputed === 'live' ? 'Entrar agora' : 'Acessar link'}
        </a>
      </div>
    </li>
  );
}

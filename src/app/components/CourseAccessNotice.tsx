import { CalendarClock, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMyCourseAccess } from '../data/hooks';

/**
 * Aviso do prazo de acesso ao curso.
 *
 * Só aparece quando há algo a dizer: acesso vencido, ou vencendo nos próximos
 * 30 dias. Curso sem prazo e prazo folgado não geram ruído — um selo permanente
 * de "você ainda tem 400 dias" só treina o aluno a ignorar o aviso.
 */
export default function CourseAccessNotice({ courseId }: { courseId: string }) {
  const { data } = useMyCourseAccess();
  const row = data?.find((r) => r.courseId === courseId);
  if (!row) return null;
  if (row.state === 'lifetime' || row.state === 'active') return null;

  const vence = row.expiresAt
    ? new Date(row.expiresAt).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : null;

  if (row.state === 'expired') {
    return (
      <div className="rounded-xl border border-status-danger/30 bg-status-danger/5 p-4">
        <div className="flex items-start gap-3">
          <Lock size={18} strokeWidth={1.75} className="text-status-danger mt-0.5 shrink-0" />
          <div>
            <h2 className="text-sm font-semibold text-pco-deep">
              Seu acesso a este curso terminou{vence ? ` em ${vence}` : ''}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              As aulas ficam indisponíveis até você renovar. Seu progresso, suas anotações e seu
              certificado continuam guardados — quando renovar, você volta de onde parou.
            </p>
            {/* O texto anterior mandava "responder o e-mail de aviso de
                vencimento" — e-mail que nenhuma parte do sistema envia. Mandar
                o aluno atrás de algo inexistente, na hora em que ele já está
                barrado, é a pior hora possível. Aqui vai para um canal que
                existe, com o assunto já escolhido. */}
            <Link
              to={`/suporte?assunto=acesso&titulo=${encodeURIComponent('Renovação de acesso ao curso')}`}
              className="pco-btn-primary text-xs mt-3"
            >
              Pedir renovação
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const dias = row.daysLeft ?? 0;
  return (
    <div className="rounded-xl border border-status-warning/30 bg-status-warning/5 p-4">
      <div className="flex items-start gap-3">
        <CalendarClock
          size={18}
          strokeWidth={1.75}
          className="text-status-warning mt-0.5 shrink-0"
        />
        <div>
          <h2 className="text-sm font-semibold text-pco-deep">
            {dias <= 1
              ? 'Seu acesso a este curso termina hoje'
              : `Seu acesso a este curso termina em ${dias} dias`}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            {vence ? `Vale até ${vence}. ` : ''}
            Depois disso as aulas ficam indisponíveis até a renovação. Se faltam módulos, este é um
            bom momento para adiantar.
          </p>
        </div>
      </div>
    </div>
  );
}

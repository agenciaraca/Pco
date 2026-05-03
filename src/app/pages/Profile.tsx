import { User, Mail, Calendar, Target, Save } from 'lucide-react';
import { currentStudent } from '../data/seed';

export default function Profile() {
  const initials = currentStudent.name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="pco-section-title">Meu Perfil</h1>
        <p className="pco-section-subtitle mt-1">Seus dados acadêmicos e preferências.</p>
      </header>

      <div className="pco-card">
        <div className="flex flex-wrap items-center gap-5">
          <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-pco-blue to-pco-cyan grid place-items-center text-2xl font-bold text-white shadow-soft">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-pco-deep">{currentStudent.name}</h2>
            <p className="text-sm text-ink-muted">{currentStudent.email}</p>
            <p className="text-xs text-ink-subtle mt-1">
              Aluno desde {new Date(currentStudent.createdAt).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            alert('Salvo (mock).');
          }}
          className="pco-card space-y-4"
        >
          <h3 className="text-base font-semibold text-pco-deep flex items-center gap-2">
            <User size={16} className="text-pco-blue" strokeWidth={1.75} />
            Dados pessoais
          </h3>
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1.5">Nome completo</label>
            <input className="pco-input" defaultValue={currentStudent.name} />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1.5">E-mail</label>
            <input className="pco-input" type="email" defaultValue={currentStudent.email} />
          </div>
          <button type="submit" className="pco-btn-primary">
            <Save size={14} strokeWidth={2} />
            Salvar alterações
          </button>
        </form>

        <div className="pco-card space-y-4">
          <h3 className="text-base font-semibold text-pco-deep flex items-center gap-2">
            <Target size={16} className="text-pco-blue" strokeWidth={1.75} />
            Plano de estudo
          </h3>
          <div className="rounded-xl bg-surface-off p-4">
            <div className="text-xs text-ink-muted">Meta semanal</div>
            <div className="text-2xl font-bold text-pco-deep">
              {currentStudent.weeklyGoalMinutes} min
            </div>
          </div>
          <div className="rounded-xl bg-surface-off p-4">
            <div className="text-xs text-ink-muted">Total estudado</div>
            <div className="text-2xl font-bold text-pco-deep">
              {Math.round(currentStudent.totalStudyMinutes / 60)}h{' '}
              {currentStudent.totalStudyMinutes % 60}min
            </div>
          </div>
          <div className="rounded-xl bg-surface-off p-4 flex items-center gap-3">
            <Calendar size={16} className="text-pco-blue" strokeWidth={1.75} />
            <div className="text-xs text-ink-muted">
              Último acesso:{' '}
              <span className="font-semibold text-pco-deep">
                {currentStudent.lastAccessAt
                  ? new Date(currentStudent.lastAccessAt).toLocaleDateString('pt-BR')
                  : '—'}
              </span>
            </div>
          </div>
          <div className="rounded-xl bg-surface-off p-4 flex items-center gap-3">
            <Mail size={16} className="text-pco-blue" strokeWidth={1.75} />
            <div className="text-xs text-ink-muted">
              Notificações por e-mail{' '}
              <span className="font-semibold text-pco-deep">ativadas</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

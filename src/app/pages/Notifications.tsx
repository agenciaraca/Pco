import { Bell, BookOpen, Award, AlertCircle } from 'lucide-react';

const items = [
  {
    icon: BookOpen,
    color: 'text-pco-blue bg-pco-blue/10',
    title: 'Nova aula liberada',
    desc: 'Módulo 2 de Psicanálise — “O setting analítico hoje”.',
    time: '2h atrás',
  },
  {
    icon: Award,
    color: 'text-status-gold bg-status-gold/10',
    title: 'Você está perto de um certificado',
    desc: 'Conclua mais 2 módulos para emitir o certificado de Psicanálise Clínica.',
    time: 'ontem',
  },
  {
    icon: AlertCircle,
    color: 'text-pco-orange bg-pco-orange/10',
    title: 'Meta semanal abaixo',
    desc: 'Você está com 30% da sua meta de 3h. Que tal uma aula curta agora?',
    time: '3d atrás',
  },
];

export default function Notifications() {
  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="pco-section-title">Notificações</h1>
          <p className="pco-section-subtitle mt-1">
            Avisos importantes do seu progresso e do AVA.
          </p>
        </div>
        <button className="pco-btn-secondary text-xs">Marcar todas como lidas</button>
      </header>

      <div className="pco-card p-0 overflow-hidden">
        <ul className="divide-y divide-surface-gray">
          {items.map((n, i) => {
            const Icon = n.icon;
            return (
              <li key={i} className="flex items-start gap-3 p-4 hover:bg-surface-off">
                <div className={`h-9 w-9 rounded-lg grid place-items-center ${n.color}`}>
                  <Icon size={16} strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-pco-deep">{n.title}</div>
                    <div className="text-[11px] text-ink-subtle shrink-0">{n.time}</div>
                  </div>
                  <p className="text-xs text-ink-muted mt-0.5">{n.desc}</p>
                </div>
              </li>
            );
          })}
        </ul>
        {items.length === 0 && (
          <div className="text-center py-12">
            <Bell size={28} className="mx-auto text-ink-subtle mb-2" strokeWidth={1.5} />
            <p className="text-sm text-ink-muted">Nenhuma notificação por aqui.</p>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import {
  Send,
  Plus,
  Mail,
  MessageSquare,
  Phone,
  Edit3,
  Trash2,
  Power,
  Sparkles,
} from 'lucide-react';
import Tabs from '../../components/Tabs';
import { useT } from '../../i18n';

const tabs = [
  { id: 'campanhas', label: 'Campanhas', icon: <Send size={14} strokeWidth={1.75} /> },
  { id: 'templates', label: 'Templates', icon: <Edit3 size={14} strokeWidth={1.75} /> },
];

const channels: Record<string, { icon: React.ReactNode; label: string }> = {
  email: {
    icon: <Mail size={12} strokeWidth={1.75} className="text-pco-blue" />,
    label: 'E-mail',
  },
  in_app: {
    icon: <MessageSquare size={12} strokeWidth={1.75} className="text-pco-cyan" />,
    label: 'In-app',
  },
  whatsapp: {
    icon: <Phone size={12} strokeWidth={1.75} className="text-status-success" />,
    label: 'WhatsApp',
  },
};

const campaigns = [
  {
    id: 'c-1',
    name: 'Inatividade 7 dias',
    trigger: '7 dias sem acesso',
    channel: 'in_app',
    sent: 38,
    response: 14,
    active: true,
  },
  {
    id: 'c-2',
    name: 'Inatividade 14 dias — leve',
    trigger: '14 dias sem acesso',
    channel: 'email',
    sent: 19,
    response: 6,
    active: true,
  },
  {
    id: 'c-3',
    name: 'Inatividade 30 dias — direto',
    trigger: '30 dias sem acesso',
    channel: 'whatsapp',
    sent: 12,
    response: 4,
    active: true,
  },
  {
    id: 'c-4',
    name: 'Avaliação travada',
    trigger: 'Avaliação pendente há 7d',
    channel: 'in_app',
    sent: 7,
    response: 3,
    active: false,
  },
];

const templates = [
  {
    id: 't-1',
    name: 'Acolhedor curto',
    subject: 'Sua jornada está te esperando',
    preview:
      'Oi, [nome]. Notamos que faz alguns dias que você não acessa o AVA. Que tal uma aula curta hoje?',
  },
  {
    id: 't-2',
    name: 'Direto com microvitória',
    subject: 'Termine a aula 3 e desbloqueie o módulo',
    preview:
      'Você está a 22 minutos de concluir o módulo. Vamos finalizar juntos?',
  },
  {
    id: 't-3',
    name: 'Motivacional + recurso',
    subject: 'Selecionei algo para te ajudar',
    preview:
      'Selecionei um PCO POD relacionado ao seu módulo atual. Pode te ajudar a retomar com leveza.',
  },
];

export default function AdminReengajamento() {
  const t = useT();
  const [active, setActive] = useState('campanhas');

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="pco-section-title">{t('admin.nav.reengagement')}</h1>
          <p className="pco-section-subtitle mt-1">
            Campanhas automáticas e templates para alunos inativos.
          </p>
        </div>
        <button className="pco-btn-primary text-xs">
          <Plus size={12} strokeWidth={2} />
          Nova campanha
        </button>
      </header>

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Campanhas ativas" value={campaigns.filter((c) => c.active).length} />
        <Stat label="Mensagens este mês" value={76} />
        <Stat label="Respostas" value={27} accent="green" />
        <Stat label="Taxa de retomada" value="36%" accent="green" />
      </div>

      <Tabs items={tabs} active={active} onChange={setActive} />

      {active === 'campanhas' && (
        <div className="pco-card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-off">
                <tr className="text-[11px] uppercase tracking-wider text-ink-subtle">
                  <th className="px-4 py-3 text-left font-medium">Campanha</th>
                  <th className="px-4 py-3 text-left font-medium">Gatilho</th>
                  <th className="px-4 py-3 text-left font-medium">Canal</th>
                  <th className="px-4 py-3 text-left font-medium">Enviadas</th>
                  <th className="px-4 py-3 text-left font-medium">Respostas</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => {
                  const ch = channels[c.channel];
                  const responseRate = c.sent > 0 ? Math.round((c.response / c.sent) * 100) : 0;
                  return (
                    <tr key={c.id} className="border-t border-surface-gray hover:bg-surface-off">
                      <td className="px-4 py-3 font-semibold text-pco-deep">{c.name}</td>
                      <td className="px-4 py-3 text-ink-muted text-xs">{c.trigger}</td>
                      <td className="px-4 py-3">
                        <span className="pco-badge bg-surface-gray text-ink-muted">
                          {ch.icon}
                          {ch.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-pco-deep">{c.sent}</td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-pco-deep">{c.response}</span>{' '}
                        <span className="text-[11px] text-ink-subtle">({responseRate}%)</span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`pco-badge ${
                            c.active
                              ? 'bg-status-success/10 text-status-success'
                              : 'bg-surface-gray text-ink-muted'
                          }`}
                        >
                          <Power size={10} strokeWidth={2} />
                          {c.active ? 'Ativa' : 'Pausada'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button className="pco-btn-ghost text-xs px-2.5">
                            <Edit3 size={12} strokeWidth={1.75} />
                          </button>
                          <button className="pco-btn-ghost text-xs px-2.5 text-status-danger">
                            <Trash2 size={12} strokeWidth={1.75} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {active === 'templates' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-pco-deep">Templates de mensagem</h3>
            <button className="pco-btn-primary text-xs">
              <Sparkles size={12} strokeWidth={2} />
              Gerar template com IA
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {templates.map((t) => (
              <div key={t.id} className="pco-card pco-card-hover">
                <h4 className="text-sm font-semibold text-pco-deep">{t.name}</h4>
                <p className="mt-1 text-[11px] text-pco-blue font-medium">{t.subject}</p>
                <p className="mt-3 text-xs text-ink-muted line-clamp-3">{t.preview}</p>
                <div className="mt-4 flex gap-2">
                  <button className="pco-btn-secondary text-xs flex-1 justify-center">
                    <Edit3 size={12} strokeWidth={1.75} />
                    Editar
                  </button>
                  <button className="pco-btn-ghost text-xs px-2.5">
                    <Send size={12} strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            ))}
          </div>
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
  value: string | number;
  accent?: 'green';
}) {
  return (
    <div className="pco-card">
      <div className="text-[11px] font-medium uppercase tracking-wider text-ink-subtle">
        {label}
      </div>
      <div
        className={`mt-1 text-2xl font-bold ${
          accent === 'green' ? 'text-status-success' : 'text-pco-deep'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

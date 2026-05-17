import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Stethoscope,
  Users,
  Calendar,
  DollarSign,
  Plug,
  ClipboardList,
  AlertCircle,
  Plus,
  Edit3,
  Trash2,
  Mail,
  Check,
} from 'lucide-react';
import Tabs from '../../components/Tabs';
import { useSessionServices, useProfessionals } from '../../data/hooks';
import { useT } from '../../i18n';

const tabs = [
  { id: 'servicos', label: 'Serviços', icon: <Stethoscope size={14} strokeWidth={1.75} /> },
  { id: 'profissionais', label: 'Profissionais', icon: <Users size={14} strokeWidth={1.75} /> },
  { id: 'agenda', label: 'Agenda', icon: <Calendar size={14} strokeWidth={1.75} /> },
  { id: 'valores', label: 'Valores', icon: <DollarSign size={14} strokeWidth={1.75} /> },
  { id: 'integracoes', label: 'Integrações', icon: <Plug size={14} strokeWidth={1.75} /> },
  { id: 'agendamentos', label: 'Agendamentos', icon: <ClipboardList size={14} strokeWidth={1.75} /> },
  { id: 'politicas', label: 'Políticas e Avisos', icon: <AlertCircle size={14} strokeWidth={1.75} /> },
];

export default function AdminAnaliseSupervisao() {
  const t = useT();
  const [active, setActive] = useState('servicos');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="pco-section-title">{t('admin.nav.supervision')}</h1>
        <p className="pco-section-subtitle mt-1">
          Gestão completa do módulo opcional de análise, supervisão e orientação formativa.
        </p>
      </header>

      <div className="pco-card border-pco-orange/30 bg-pco-orange/5 p-4 flex gap-3">
        <AlertCircle className="text-pco-orange shrink-0" size={18} strokeWidth={1.75} />
        <p className="text-xs text-ink-muted">
          Análise, supervisão e orientação formativa são serviços opcionais, contratados
          separadamente, e não são requisitos obrigatórios para conclusão dos cursos da PCO ou
          emissão de certificado.
        </p>
      </div>

      <Tabs items={tabs} active={active} onChange={setActive} />

      {active === 'servicos' && <ServicosPane />}
      {active === 'profissionais' && <ProfissionaisPane />}
      {active === 'agenda' && <AgendaPane />}
      {active === 'valores' && <ValoresPane />}
      {active === 'integracoes' && <IntegracoesPane />}
      {active === 'agendamentos' && <AgendamentosPane />}
      {active === 'politicas' && <PoliticasPane />}
    </div>
  );
}

function ServicosPane() {
  const { data: sessionServices = [] } = useSessionServices();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-pco-deep">Serviços oferecidos</h3>
        <button className="pco-btn-primary text-xs">
          <Plus size={12} strokeWidth={2} />
          Novo serviço
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {sessionServices.map((s) => (
          <div key={s.id} className="pco-card">
            <div className="flex items-start justify-between">
              <span className="pco-badge bg-pco-blue/10 text-pco-blue capitalize">
                {s.type}
              </span>
              <span
                className={`pco-badge ${
                  s.active
                    ? 'bg-status-success/10 text-status-success'
                    : 'bg-surface-gray text-ink-muted'
                }`}
              >
                {s.active ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            <h4 className="mt-3 text-base font-semibold text-pco-deep">{s.name}</h4>
            <p className="mt-1 text-xs text-ink-muted line-clamp-2">{s.description}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <Tile label="Duração" value={`${s.durationMinutes} min`} />
              <Tile label="Valor" value={`R$ ${s.price}`} />
            </div>
            <div className="mt-3 text-[11px] text-ink-muted space-y-0.5">
              <div className="flex items-center gap-1">
                <Check size={10} className="text-status-success" />
                {s.paymentBeforeConfirmation ? 'Pagamento antes da confirmação' : 'Confirmação manual'}
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button className="pco-btn-secondary text-xs flex-1 justify-center">
                <Edit3 size={12} strokeWidth={1.75} />
                Editar
              </button>
              <button className="pco-btn-ghost text-xs px-3 text-status-danger">
                <Trash2 size={12} strokeWidth={1.75} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfissionaisPane() {
  const { data: professionals = [] } = useProfessionals();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-pco-deep">Profissionais</h3>
        <button className="pco-btn-primary text-xs">
          <Plus size={12} strokeWidth={2} />
          Novo profissional
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {professionals.map((p) => (
          <div key={p.id} className="pco-card">
            <div className="flex items-start gap-4">
              <div
                className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${p.avatarColor} grid place-items-center text-white font-semibold shrink-0`}
              >
                {p.name
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-pco-deep">{p.name}</h4>
                <p className="text-xs text-ink-muted line-clamp-2 mt-0.5">{p.bio}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.specialties.map((sp) => (
                    <span key={sp} className="pco-badge bg-pco-blue/10 text-pco-blue">
                      {sp}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-3 text-[11px] text-ink-subtle">
                  <span className="inline-flex items-center gap-1">
                    <Mail size={11} />
                    {p.email}
                  </span>
                  <span>· R$ {p.hourlyRate}/h</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <button className="pco-btn-secondary text-xs">Editar</button>
                  <button className="pco-btn-ghost text-xs">Ver agenda</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgendaPane() {
  const { data: professionals = [] } = useProfessionals();
  const days = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  const today = new Date();
  const month = today.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).getDay();

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="lg:col-span-2 pco-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-pco-deep capitalize">{month}</h3>
          <div className="flex items-center gap-2">
            <button className="pco-btn-ghost text-xs">Semana</button>
            <button className="pco-btn-ghost text-xs">Mês</button>
            <select className="pco-input w-auto text-xs">
              <option>Todos os profissionais</option>
              {professionals.map((p) => (
                <option key={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => (
            <div
              key={d}
              className="text-[11px] uppercase tracking-wider text-ink-subtle text-center py-1"
            >
              {d}
            </div>
          ))}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const isToday = day === today.getDate();
            const hasSession = [4, 9, 12, 15, 21, 28].includes(day);
            return (
              <button
                key={day}
                className={`aspect-square rounded-lg border text-xs font-medium transition-colors ${
                  isToday
                    ? 'border-pco-blue bg-pco-blue/10 text-pco-blue'
                    : 'border-surface-gray text-ink-muted hover:bg-surface-off hover:text-pco-deep'
                }`}
              >
                <div className="relative h-full grid place-items-center">
                  {day}
                  {hasSession && (
                    <span className="absolute bottom-1 h-1 w-1 rounded-full bg-pco-orange" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="pco-card">
        <h3 className="text-base font-semibold text-pco-deep mb-3">Próximas sessões</h3>
        <ul className="space-y-2">
          {[
            { time: '14:00', name: 'Carla Mendes', svc: 'Análise Pessoal' },
            { time: '16:00', name: 'Diego R.', svc: 'Supervisão Clínica' },
            { time: '09:00', name: 'Renata B.', svc: 'Orientação Formativa' },
          ].map((s, i) => (
            <li key={i} className="rounded-xl bg-surface-off p-3">
              <div className="text-[11px] font-semibold text-pco-blue">{s.time}</div>
              <div className="text-sm font-semibold text-pco-deep">{s.name}</div>
              <div className="text-[11px] text-ink-subtle">{s.svc}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ValoresPane() {
  const { data: sessionServices = [] } = useSessionServices();
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="pco-card">
        <h3 className="text-base font-semibold text-pco-deep mb-4">Valores por serviço</h3>
        <ul className="space-y-2">
          {sessionServices.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-xl bg-surface-off p-3"
            >
              <span className="text-sm text-pco-deep font-medium">{s.name}</span>
              <span className="text-sm font-semibold text-pco-deep">R$ {s.price}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="pco-card space-y-4">
        <h3 className="text-base font-semibold text-pco-deep">Pacotes de sessões</h3>
        <p className="text-sm text-ink-muted">
          Crie pacotes (ex.: 4 sessões com desconto) como produto do tipo
          <span className="font-semibold"> pacote de sessões </span>
          no catálogo. Eles aparecem aqui automaticamente após a primeira venda.
        </p>
        <Link
          to="/admin/produtos"
          className="pco-btn-secondary text-xs w-full justify-center"
        >
          <Plus size={12} strokeWidth={2} />
          Gerenciar pacotes no catálogo
        </Link>
      </div>
    </div>
  );
}

function IntegracoesPane() {
  const integrations = [
    { name: 'Google Calendar', status: 'Conectado', ok: true },
    { name: 'Google Meet', status: 'Conectado', ok: true },
    { name: 'Zoom', status: 'Não conectado', ok: false },
    { name: 'Microsoft Teams', status: 'Não conectado', ok: false },
    { name: 'Whereby', status: 'Não conectado', ok: false },
  ];
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        {integrations.map((i) => (
          <div key={i.name} className="pco-card flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-pco-deep">{i.name}</div>
              <div className="text-[11px] text-ink-subtle">{i.status}</div>
            </div>
            <button className={i.ok ? 'pco-btn-secondary text-xs' : 'pco-btn-primary text-xs'}>
              {i.ok ? 'Configurar' : 'Conectar'}
            </button>
          </div>
        ))}
      </div>

      <div className="pco-card space-y-4">
        <h3 className="text-base font-semibold text-pco-deep">Configurações gerais</h3>
        <Field label="Provedor padrão de reunião">
          <select className="pco-input">
            <option>Google Meet</option>
            <option>Zoom</option>
            <option>Microsoft Teams</option>
            <option>Whereby</option>
            <option>Link manual</option>
          </select>
        </Field>
        <Field label="Fuso horário">
          <select className="pco-input">
            <option>America/Sao_Paulo (UTC-03)</option>
          </select>
        </Field>
        <div className="space-y-2 text-sm">
          <Toggle label="Criar link de reunião automaticamente" defaultChecked />
          <Toggle label="Enviar lembrete 24h antes" defaultChecked />
          <Toggle label="Enviar lembrete 1h antes" defaultChecked />
        </div>
      </div>
    </div>
  );
}

function AgendamentosPane() {
  const bookings = [
    {
      student: 'Carla Mendes',
      service: 'Análise Pessoal',
      pro: 'Dra. Helena Vieira',
      date: '2026-05-04 14:00',
      payment: 'paid',
      status: 'confirmed',
      platform: 'Google Meet',
    },
    {
      student: 'Diego R.',
      service: 'Supervisão Clínica',
      pro: 'Dr. Marco Aurélio',
      date: '2026-05-05 16:00',
      payment: 'pending',
      status: 'pending_payment',
      platform: 'Zoom',
    },
    {
      student: 'Renata B.',
      service: 'Orientação Formativa',
      pro: 'Dr. Marco Aurélio',
      date: '2026-05-09 09:00',
      payment: 'paid',
      status: 'scheduled',
      platform: 'Google Meet',
    },
  ];
  const statusLabel: Record<string, string> = {
    pending_payment: 'Pgto. pendente',
    confirmed: 'Confirmada',
    scheduled: 'Agendada',
    done: 'Realizada',
    cancelled: 'Cancelada',
  };
  const statusStyle: Record<string, string> = {
    pending_payment: 'bg-pco-orange/15 text-pco-orange',
    confirmed: 'bg-status-success/10 text-status-success',
    scheduled: 'bg-pco-blue/10 text-pco-blue',
    done: 'bg-surface-gray text-ink-muted',
    cancelled: 'bg-status-danger/15 text-status-danger',
  };
  return (
    <div className="pco-card p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-off">
            <tr className="text-[11px] uppercase tracking-wider text-ink-subtle">
              <th className="px-4 py-3 text-left font-medium">Aluno</th>
              <th className="px-4 py-3 text-left font-medium">Serviço</th>
              <th className="px-4 py-3 text-left font-medium">Profissional</th>
              <th className="px-4 py-3 text-left font-medium">Data</th>
              <th className="px-4 py-3 text-left font-medium">Pagamento</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Plataforma</th>
              <th className="px-4 py-3 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b, i) => (
              <tr key={i} className="border-t border-surface-gray hover:bg-surface-off">
                <td className="px-4 py-3 font-semibold text-pco-deep">{b.student}</td>
                <td className="px-4 py-3 text-ink-muted">{b.service}</td>
                <td className="px-4 py-3 text-ink-muted">{b.pro}</td>
                <td className="px-4 py-3 text-ink-muted">{b.date}</td>
                <td className="px-4 py-3">
                  <span
                    className={`pco-badge ${
                      b.payment === 'paid'
                        ? 'bg-status-success/10 text-status-success'
                        : 'bg-pco-orange/15 text-pco-orange'
                    }`}
                  >
                    {b.payment === 'paid' ? 'Pago' : 'Pendente'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`pco-badge ${statusStyle[b.status]}`}>
                    {statusLabel[b.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-ink-muted">{b.platform}</td>
                <td className="px-4 py-3 text-right">
                  <button className="pco-btn-ghost text-xs">Detalhes</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PoliticasPane() {
  const obrigatorio =
    'Análise, supervisão e orientação formativa são serviços opcionais, contratados separadamente, e não são requisitos obrigatórios para conclusão dos cursos da PCO ou emissão de certificado.';
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="pco-card space-y-4">
        <h3 className="text-base font-semibold text-pco-deep">Texto obrigatório</h3>
        <textarea
          className="pco-input resize-none text-sm"
          rows={5}
          defaultValue={obrigatorio}
        />
        <p className="text-[11px] text-ink-subtle">
          Este aviso aparece nas telas do aluno em "Análise e Supervisão" e antes de qualquer
          agendamento.
        </p>
      </div>

      <div className="pco-card space-y-3">
        <h3 className="text-base font-semibold text-pco-deep">Políticas adicionais</h3>
        <Field label="Prazo mínimo para cancelamento">
          <select className="pco-input">
            <option>24 horas antes</option>
            <option>48 horas antes</option>
            <option>72 horas antes</option>
          </select>
        </Field>
        <Field label="Permite remarcação?">
          <select className="pco-input">
            <option>Sim, até 24h antes</option>
            <option>Sim, até 48h antes</option>
            <option>Não permite</option>
          </select>
        </Field>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-ink-muted mb-1.5">{label}</div>
      {children}
    </label>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-off p-2">
      <div className="text-[10px] uppercase tracking-wider text-ink-subtle">{label}</div>
      <div className="text-sm font-semibold text-pco-deep">{value}</div>
    </div>
  );
}

function Toggle({ label, defaultChecked }: { label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded text-pco-blue focus:ring-pco-blue"
      />
      <span>{label}</span>
    </label>
  );
}

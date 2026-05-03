import { useState } from 'react';
import {
  Stethoscope,
  Users,
  Compass,
  Calendar,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Check,
  Video,
  Clock,
  CalendarDays,
} from 'lucide-react';
import EmptyState from '../components/EmptyState';
import { sessionServices, professionals } from '../data/seed';
import type { SessionService, Professional } from '../types/schema';

type Step = 'service' | 'professional' | 'datetime' | 'confirm' | 'done';

interface Booking {
  serviceId?: string;
  professionalId?: string;
  date?: string;
  time?: string;
}

const slots = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

const mySessions = [
  {
    id: 'b-1',
    service: 'Análise Pessoal',
    professional: 'Dra. Helena Vieira',
    date: '2026-05-08',
    time: '14:00',
    status: 'confirmed' as const,
    meetingLink: 'https://meet.google.com/mock-abc-def',
  },
  {
    id: 'b-2',
    service: 'Supervisão Clínica',
    professional: 'Dr. Marco Aurélio',
    date: '2026-04-20',
    time: '10:00',
    status: 'done' as const,
  },
];

const statusStyles: Record<string, string> = {
  pending_payment: 'bg-pco-orange/15 text-pco-orange',
  confirmed: 'bg-status-success/10 text-status-success',
  scheduled: 'bg-pco-blue/10 text-pco-blue',
  done: 'bg-surface-gray text-ink-muted',
  cancelled: 'bg-status-danger/15 text-status-danger',
};
const statusLabel: Record<string, string> = {
  pending_payment: 'Pgto. pendente',
  confirmed: 'Confirmada',
  scheduled: 'Agendada',
  done: 'Realizada',
  cancelled: 'Cancelada',
};

export default function AnaliseSupervisao() {
  const [step, setStep] = useState<Step>('service');
  const [booking, setBooking] = useState<Booking>({});
  const [bookerOpen, setBookerOpen] = useState(false);

  const selectedService = sessionServices.find((s) => s.id === booking.serviceId);
  const selectedPro = professionals.find((p) => p.id === booking.professionalId);

  const startBooking = (serviceId?: string) => {
    setBooking({ serviceId });
    setStep(serviceId ? 'professional' : 'service');
    setBookerOpen(true);
  };

  const reset = () => {
    setBooking({});
    setStep('service');
    setBookerOpen(false);
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="pco-section-title">Análise e Supervisão</h1>
        <p className="pco-section-subtitle mt-1">
          Serviços opcionais de apoio à sua trajetória formativa.
        </p>
      </header>

      <div className="pco-card border-pco-orange/30 bg-pco-orange/5 p-4 flex gap-3">
        <AlertCircle className="text-pco-orange shrink-0" size={18} strokeWidth={1.75} />
        <p className="text-xs text-ink-muted">
          Análise e supervisão são serviços opcionais, contratados separadamente, e não são
          obrigatórios para conclusão do curso ou emissão de certificado.
        </p>
      </div>

      <section className="grid gap-5 md:grid-cols-3">
        {sessionServices.map((s) => {
          const Icon =
            s.type === 'analise' ? Stethoscope : s.type === 'supervisao' ? Users : Compass;
          return (
            <div key={s.id} className="pco-card pco-card-hover">
              <div className="h-10 w-10 rounded-xl bg-pco-blue/10 grid place-items-center mb-3">
                <Icon size={18} className="text-pco-blue" strokeWidth={1.75} />
              </div>
              <h3 className="text-base font-semibold text-pco-deep">{s.name}</h3>
              <p className="mt-1 text-xs text-ink-muted">{s.description}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-surface-off p-2">
                  <div className="text-[10px] text-ink-subtle">Duração</div>
                  <div className="font-semibold text-pco-deep">{s.durationMinutes} min</div>
                </div>
                <div className="rounded-lg bg-surface-off p-2">
                  <div className="text-[10px] text-ink-subtle">Valor</div>
                  <div className="font-semibold text-pco-deep">
                    R$ {s.price.toLocaleString('pt-BR')}
                  </div>
                </div>
              </div>
              <button
                onClick={() => startBooking(s.id)}
                className="pco-btn-primary w-full justify-center text-xs mt-4"
              >
                <Calendar size={12} strokeWidth={2} />
                Ver horários
              </button>
              <p className="mt-2 text-[10px] text-ink-subtle text-center">Serviço opcional</p>
            </div>
          );
        })}
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-pco-deep">Profissionais</h2>
          <button
            onClick={() => startBooking()}
            className="pco-btn-secondary text-xs"
          >
            Iniciar agendamento
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {professionals.map((p) => (
            <div key={p.id} className="pco-card pco-card-hover">
              <div className="flex items-start gap-4">
                <div
                  className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${p.avatarColor} grid place-items-center text-white text-base font-semibold shrink-0`}
                >
                  {p.name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-pco-deep">{p.name}</h3>
                  <p className="text-xs text-ink-muted line-clamp-2 mt-0.5">{p.bio}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {p.specialties.map((sp) => (
                      <span key={sp} className="pco-badge bg-pco-blue/10 text-pco-blue">
                        {sp}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      setBooking({ professionalId: p.id });
                      setStep('service');
                      setBookerOpen(true);
                    }}
                    className="mt-3 pco-btn-secondary text-xs"
                  >
                    Ver agenda
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-pco-deep mb-4">Minhas sessões</h2>
        {mySessions.length === 0 ? (
          <div className="pco-card">
            <EmptyState
              icon={<CalendarDays size={26} className="text-pco-blue" strokeWidth={1.5} />}
              title="Nenhuma sessão agendada"
              description="Escolha um serviço acima para iniciar seu agendamento."
            />
          </div>
        ) : (
          <ul className="space-y-3">
            {mySessions.map((s) => (
              <li key={s.id} className="pco-card pco-card-hover flex items-center gap-4 flex-wrap">
                <div className="h-12 w-12 rounded-xl bg-pco-blue/10 grid place-items-center shrink-0">
                  <Stethoscope size={20} className="text-pco-blue" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-pco-deep">{s.service}</div>
                  <div className="text-xs text-ink-muted">com {s.professional}</div>
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-ink-subtle">
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={11} />
                      {new Date(s.date).toLocaleDateString('pt-BR')}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock size={11} />
                      {s.time}
                    </span>
                  </div>
                </div>
                <span className={`pco-badge ${statusStyles[s.status]}`}>
                  {statusLabel[s.status]}
                </span>
                {s.meetingLink && s.status === 'confirmed' && (
                  <a
                    href={s.meetingLink}
                    target="_blank"
                    rel="noreferrer"
                    className="pco-btn-primary text-xs"
                  >
                    <Video size={12} strokeWidth={2} />
                    Entrar na reunião
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {bookerOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center px-4"
          onClick={(e) => {
            if (e.currentTarget === e.target) reset();
          }}
        >
          <div className="absolute inset-0 bg-pco-deep/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg pco-card max-h-[90vh] overflow-y-auto">
            {step === 'service' && (
              <ServiceStep
                onSelect={(s) => {
                  setBooking({ ...booking, serviceId: s.id });
                  setStep('professional');
                }}
                onCancel={reset}
              />
            )}
            {step === 'professional' && selectedService && (
              <ProfessionalStep
                service={selectedService}
                preselected={booking.professionalId}
                onSelect={(p) => {
                  setBooking({ ...booking, professionalId: p.id });
                  setStep('datetime');
                }}
                onBack={() => setStep('service')}
              />
            )}
            {step === 'datetime' && selectedService && selectedPro && (
              <DateTimeStep
                onSelect={(date, time) => {
                  setBooking({ ...booking, date, time });
                  setStep('confirm');
                }}
                onBack={() => setStep('professional')}
              />
            )}
            {step === 'confirm' && selectedService && selectedPro && booking.date && booking.time && (
              <ConfirmStep
                service={selectedService}
                professional={selectedPro}
                date={booking.date}
                time={booking.time}
                onConfirm={() => setStep('done')}
                onBack={() => setStep('datetime')}
              />
            )}
            {step === 'done' && (
              <DoneStep
                serviceName={selectedService?.name ?? ''}
                proName={selectedPro?.name ?? ''}
                onClose={reset}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StepHeader({
  step,
  total,
  title,
  onBack,
}: {
  step: number;
  total: number;
  title: string;
  onBack?: () => void;
}) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-3">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full ${
              i < step ? 'bg-pco-blue' : 'bg-surface-gray'
            }`}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        {onBack && (
          <button
            onClick={onBack}
            className="h-8 w-8 grid place-items-center rounded-lg text-ink-muted hover:bg-surface-gray"
            aria-label="Voltar"
          >
            <ChevronLeft size={16} strokeWidth={1.75} />
          </button>
        )}
        <h2 className="text-lg font-semibold text-pco-deep">{title}</h2>
      </div>
    </div>
  );
}

function ServiceStep({
  onSelect,
  onCancel,
}: {
  onSelect: (s: SessionService) => void;
  onCancel: () => void;
}) {
  return (
    <>
      <StepHeader step={1} total={4} title="Escolha o serviço" />
      <ul className="space-y-2">
        {sessionServices.map((s) => (
          <li key={s.id}>
            <button
              onClick={() => onSelect(s)}
              className="w-full text-left p-3 rounded-xl border border-surface-gray hover:border-pco-blue hover:bg-pco-blue/5 transition-all"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-pco-deep">{s.name}</div>
                  <div className="text-xs text-ink-muted line-clamp-1 mt-0.5">{s.description}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold text-pco-deep">R$ {s.price}</div>
                  <div className="text-[11px] text-ink-subtle">{s.durationMinutes} min</div>
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>
      <button onClick={onCancel} className="mt-4 pco-btn-ghost w-full justify-center text-xs">
        Cancelar
      </button>
    </>
  );
}

function ProfessionalStep({
  service,
  preselected,
  onSelect,
  onBack,
}: {
  service: SessionService;
  preselected?: string;
  onSelect: (p: Professional) => void;
  onBack: () => void;
}) {
  const available = professionals.filter((p) => p.serviceIds.includes(service.id));
  return (
    <>
      <StepHeader
        step={2}
        total={4}
        title={`Profissionais para ${service.name}`}
        onBack={onBack}
      />
      <ul className="space-y-2">
        {available.map((p) => (
          <li key={p.id}>
            <button
              onClick={() => onSelect(p)}
              className={`w-full text-left p-3 rounded-xl border transition-all flex items-center gap-3 ${
                preselected === p.id
                  ? 'border-pco-blue bg-pco-blue/5'
                  : 'border-surface-gray hover:border-pco-blue hover:bg-pco-blue/5'
              }`}
            >
              <div
                className={`h-10 w-10 rounded-xl bg-gradient-to-br ${p.avatarColor} grid place-items-center text-white text-xs font-semibold shrink-0`}
              >
                {p.name
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-pco-deep">{p.name}</div>
                <div className="text-[11px] text-ink-muted line-clamp-1">{p.specialties.join(', ')}</div>
              </div>
            </button>
          </li>
        ))}
        {available.length === 0 && (
          <p className="text-sm text-ink-muted py-4 text-center">
            Nenhum profissional disponível para este serviço no momento.
          </p>
        )}
      </ul>
    </>
  );
}

function DateTimeStep({
  onSelect,
  onBack,
}: {
  onSelect: (date: string, time: string) => void;
  onBack: () => void;
}) {
  const [date, setDate] = useState<string>('');
  const [time, setTime] = useState<string>('');
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i + 1);
    return d;
  });

  return (
    <>
      <StepHeader step={3} total={4} title="Escolha data e horário" onBack={onBack} />
      <div className="space-y-4">
        <div>
          <div className="text-xs font-medium text-ink-muted mb-2">Próximos dias</div>
          <div className="grid grid-cols-7 gap-1.5">
            {days.map((d) => {
              const iso = d.toISOString().slice(0, 10);
              const isActive = iso === date;
              return (
                <button
                  key={iso}
                  onClick={() => setDate(iso)}
                  className={`p-2 rounded-lg text-center text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-pco-blue text-white'
                      : 'bg-surface-off text-pco-deep hover:bg-surface-gray'
                  }`}
                >
                  <div className="text-[9px] uppercase opacity-80">
                    {d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}
                  </div>
                  <div className="text-base font-bold">{d.getDate()}</div>
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <div className="text-xs font-medium text-ink-muted mb-2">Horários disponíveis</div>
          <div className="grid grid-cols-4 gap-2">
            {slots.map((t) => (
              <button
                key={t}
                disabled={!date}
                onClick={() => setTime(t)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  time === t
                    ? 'bg-pco-blue text-white'
                    : !date
                      ? 'bg-surface-off text-ink-subtle cursor-not-allowed'
                      : 'bg-surface-off text-pco-deep hover:bg-surface-gray'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <button
          disabled={!date || !time}
          onClick={() => onSelect(date, time)}
          className="pco-btn-primary w-full justify-center"
        >
          Continuar
          <ChevronRight size={14} strokeWidth={2} />
        </button>
      </div>
    </>
  );
}

function ConfirmStep({
  service,
  professional,
  date,
  time,
  onConfirm,
  onBack,
}: {
  service: SessionService;
  professional: Professional;
  date: string;
  time: string;
  onConfirm: () => void;
  onBack: () => void;
}) {
  return (
    <>
      <StepHeader step={4} total={4} title="Confirme seu agendamento" onBack={onBack} />
      <div className="rounded-xl bg-surface-off p-4 space-y-2.5">
        <Row label="Serviço" value={service.name} />
        <Row label="Profissional" value={professional.name} />
        <Row label="Data" value={new Date(date).toLocaleDateString('pt-BR')} />
        <Row label="Horário" value={time} />
        <Row label="Duração" value={`${service.durationMinutes} min`} />
        <Row label="Valor" value={`R$ ${service.price.toLocaleString('pt-BR')}`} />
      </div>
      <p className="mt-3 text-[11px] text-ink-subtle">
        {service.paymentBeforeConfirmation
          ? 'O pagamento é processado externamente antes da confirmação. Após o pagamento, você receberá o link da reunião por e-mail.'
          : 'A confirmação é manual. Você receberá um e-mail com instruções e o link da reunião.'}
      </p>
      <button onClick={onConfirm} className="pco-btn-primary w-full justify-center mt-5">
        <Check size={14} strokeWidth={2} />
        Confirmar agendamento
      </button>
    </>
  );
}

function DoneStep({
  serviceName,
  proName,
  onClose,
}: {
  serviceName: string;
  proName: string;
  onClose: () => void;
}) {
  return (
    <div className="text-center py-4">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-status-success/15 grid place-items-center mb-4">
        <Check className="text-status-success" size={28} strokeWidth={2} />
      </div>
      <h2 className="text-lg font-semibold text-pco-deep">Agendamento solicitado</h2>
      <p className="mt-2 text-sm text-ink-muted">
        Sua solicitação para <strong>{serviceName}</strong> com <strong>{proName}</strong> foi
        registrada. Você receberá o link da reunião e as próximas instruções por e-mail.
      </p>
      <button onClick={onClose} className="mt-6 pco-btn-primary">
        Concluir
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-ink-muted">{label}</span>
      <span className="font-semibold text-pco-deep">{value}</span>
    </div>
  );
}

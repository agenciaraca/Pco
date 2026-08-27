import { useMemo, useState } from 'react';
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
import {
  useSessionServices,
  useProfessionals,
  useMyBookings,
  useCreateBooking,
  useCancelBooking,
  useCheckoutBooking,
  useRescheduleBooking,
  useAgendaDoDia,
} from '../data/hooks';
import type { SessionService } from '../types/schema';
// O tipo público — sem e-mail nem hourlyRate, que a rota aberta não devolve.
import type { ProfessionalRow } from '../data/api';
import { useT } from '../i18n';

type Step = 'service' | 'professional' | 'datetime' | 'confirm' | 'done';

interface Booking {
  serviceId?: string;
  professionalId?: string;
  date?: string;
  time?: string;
}

interface HorarioExibido {
  hora: string;
  disponivel: boolean;
  motivo?: 'ocupado' | 'passado';
}

/**
 * Esqueleto mostrado **antes** de o aluno escolher um dia — todos desligados.
 * A lista de verdade vem do servidor; esta existe só para o passo não aparecer
 * vazio. A faixa de atendimento agora mora em `server/sessions/horarios.ts`.
 */
const HORARIOS_FALLBACK = [
  '09:00',
  '10:00',
  '11:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
].map((hora): HorarioExibido => ({ hora, disponivel: false }));

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
  const t = useT();
  const [step, setStep] = useState<Step>('service');
  const [booking, setBooking] = useState<Booking>({});
  const [bookerOpen, setBookerOpen] = useState(false);
  const { data: sessionServices = [] } = useSessionServices();
  const { data: professionals = [] } = useProfessionals();
  const { data: bookings = [], isLoading: carregandoSessoes } = useMyBookings();
  const criar = useCreateBooking();
  const cancelar = useCancelBooking();
  const pagar = useCheckoutBooking();
  const remarcar = useRescheduleBooking();
  const [remarcando, setRemarcando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // Um só lugar para o erro das ações da lista: pagar e remarcar.
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  // Leva o aluno ao gateway. Se o pagamento já estava aberto, o servidor
  // devolve o mesmo pedido em vez de criar outro.
  const irPagar = async (id: string) => {
    setErroAcao(null);
    try {
      const pedido = await pagar.mutateAsync(id);
      if (pedido.checkoutUrl) {
        // assign e não href: é o que Courses.tsx e Bundles.tsx já usam para
        // mandar o aluno ao gateway, e o lint recusa a atribuição direta.
        window.location.assign(pedido.checkoutUrl);
        return;
      }
      setErroAcao('O gateway não devolveu link de pagamento. Fale com a coordenação.');
    } catch (e) {
      setErroAcao(
        e instanceof Error ? e.message : 'Não foi possível abrir o pagamento agora.',
      );
    }
  };

  const selectedService = sessionServices.find((s) => s.id === booking.serviceId);
  const selectedPro = professionals.find((p) => p.id === booking.professionalId);

  // O que o aluno vê na lista: agendado primeiro, cancelado por último.
  const mySessions = useMemo(() => {
    const peso: Record<string, number> = {
      pending_payment: 0,
      confirmed: 1,
      scheduled: 1,
      done: 2,
      cancelled: 3,
    };
    return [...bookings].sort(
      (a, b) =>
        (peso[a.status] ?? 9) - (peso[b.status] ?? 9) ||
        a.scheduledFor.localeCompare(b.scheduledFor),
    );
  }, [bookings]);

  const confirmar = async () => {
    if (!selectedService || !selectedPro || !booking.date || !booking.time) return;
    setErro(null);
    try {
      // Data e hora chegam separadas da tela; o servidor quer um instante só.
      await criar.mutateAsync({
        serviceId: selectedService.id,
        professionalId: selectedPro.id,
        scheduledFor: new Date(`${booking.date}T${booking.time}:00`).toISOString(),
      });
      setStep('done');
    } catch (e) {
      // Sem isto o botão ficava mudo no erro — foi exatamente assim que a tela
      // passou a prometer sessões que não existiam.
      setErro(e instanceof Error ? e.message : 'Não foi possível agendar. Tente de novo.');
    }
  };

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
        <h1 className="pco-section-title">{t('admin.nav.supervision')}</h1>
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
          <button onClick={() => startBooking()} className="pco-btn-secondary text-xs">
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
        {erroAcao && (
          <p className="mb-3 rounded-lg bg-status-danger/10 p-2.5 text-xs text-status-danger">
            {erroAcao}
          </p>
        )}
        {carregandoSessoes ? (
          <div className="pco-card text-sm text-ink-muted">Carregando suas sessões…</div>
        ) : mySessions.length === 0 ? (
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
                  <div className="text-sm font-semibold text-pco-deep">{s.serviceName}</div>
                  <div className="text-xs text-ink-muted">com {s.professionalName}</div>
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-ink-subtle">
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={11} />
                      {new Date(s.scheduledFor).toLocaleDateString('pt-BR')}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock size={11} />
                      {new Date(s.scheduledFor).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span>
                      R${' '}
                      {(s.priceCents / 100).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
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
                {s.status === 'pending_payment' && (
                  <button
                    onClick={() => irPagar(s.id)}
                    disabled={pagar.isPending}
                    className="pco-btn-primary text-xs disabled:opacity-60"
                  >
                    {pagar.isPending ? 'Abrindo…' : 'Pagar'}
                  </button>
                )}
                {s.status !== 'cancelled' && s.status !== 'done' && (
                  <button
                    onClick={() => setRemarcando(remarcando === s.id ? null : s.id)}
                    className="pco-btn-secondary text-xs"
                  >
                    {remarcando === s.id ? 'Fechar' : 'Remarcar'}
                  </button>
                )}
                {s.status !== 'cancelled' && s.status !== 'done' && (
                  <button
                    onClick={() => cancelar.mutate({ id: s.id })}
                    disabled={cancelar.isPending}
                    className="pco-btn-ghost text-xs disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                )}
                {remarcando === s.id && (
                  <div className="w-full border-t border-surface-gray pt-3 mt-1">
                    <DateTimeStep
                      professionalId={s.professionalId}
                      onSelect={async (date, time) => {
                        setErroAcao(null);
                        try {
                          await remarcar.mutateAsync({
                            id: s.id,
                            scheduledFor: new Date(`${date}T${time}:00`).toISOString(),
                          });
                          setRemarcando(null);
                        } catch (e) {
                          setErroAcao(
                            e instanceof Error ? e.message : 'Não foi possível remarcar.',
                          );
                        }
                      }}
                      onBack={() => setRemarcando(null)}
                    />
                  </div>
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
                professionalId={selectedPro.id}
                onSelect={(date, time) => {
                  setBooking({ ...booking, date, time });
                  setStep('confirm');
                }}
                onBack={() => setStep('professional')}
              />
            )}
            {step === 'confirm' &&
              selectedService &&
              selectedPro &&
              booking.date &&
              booking.time && (
                <ConfirmStep
                  service={selectedService}
                  professional={selectedPro}
                  date={booking.date}
                  time={booking.time}
                  onConfirm={confirmar}
                  enviando={criar.isPending}
                  erro={erro}
                  onBack={() => setStep('datetime')}
                />
              )}
            {step === 'done' && (
              <DoneStep
                serviceName={selectedService?.name ?? ''}
                proName={selectedPro?.name ?? ''}
                aguardandoPagamento={selectedService?.paymentBeforeConfirmation ?? false}
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
            className={`h-1.5 flex-1 rounded-full ${i < step ? 'bg-pco-blue' : 'bg-surface-gray'}`}
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
  const { data: sessionServices = [] } = useSessionServices();
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
  onSelect: (p: ProfessionalRow) => void;
  onBack: () => void;
}) {
  const { data: professionals = [] } = useProfessionals();
  const available = professionals.filter((p) => p.serviceIds.includes(service.id));
  return (
    <>
      <StepHeader step={2} total={4} title={`Profissionais para ${service.name}`} onBack={onBack} />
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
                <div className="text-[11px] text-ink-muted line-clamp-1">
                  {p.specialties.join(', ')}
                </div>
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
  professionalId,
  onSelect,
  onBack,
}: {
  /** Sem ele não há agenda para consultar — e o passo vira palpite de novo. */
  professionalId: string;
  onSelect: (date: string, time: string) => void;
  onBack: () => void;
}) {
  const [date, setDate] = useState<string>('');
  const [time, setTime] = useState<string>('');
  const agendaQ = useAgendaDoDia(professionalId, date || undefined);
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
        {/*
          Este bloco listava oito horários fixos sob o título "Horários
          disponíveis" e não consultava nada: o aluno escolhia um horário já
          tomado, preenchia o resto e só descobria no envio, porque o servidor
          sempre barrou a colisão. Agora a lista vem de
          `/sessions/professionals/:id/horarios`, com o ocupado e o que já
          passou desligados e dizendo por quê.
        */}
        <div>
          <div className="text-xs font-medium text-ink-muted mb-2">
            {date ? 'Horários' : 'Escolha um dia para ver os horários'}
          </div>
          {agendaQ.isLoading && date && (
            <p className="text-xs text-ink-subtle">Consultando a agenda…</p>
          )}
          {agendaQ.isError && (
            <p className="text-xs text-status-danger">
              Não foi possível consultar a agenda. Escolher horário agora seria palpite.
            </p>
          )}
          <div className="grid grid-cols-4 gap-2">
            {(agendaQ.data?.slots ?? HORARIOS_FALLBACK).map((slot: HorarioExibido) => {
              const livre = date ? slot.disponivel : false;
              return (
                <button
                  key={slot.hora}
                  disabled={!livre}
                  title={
                    slot.motivo === 'ocupado'
                      ? 'Já reservado com este profissional'
                      : slot.motivo === 'passado'
                        ? 'Horário já passou'
                        : undefined
                  }
                  onClick={() => setTime(slot.hora)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    time === slot.hora
                      ? 'bg-pco-blue text-white'
                      : !livre
                        ? 'bg-surface-off text-ink-subtle cursor-not-allowed line-through decoration-1'
                        : 'bg-surface-off text-pco-deep hover:bg-surface-gray'
                  }`}
                >
                  {slot.hora}
                </button>
              );
            })}
          </div>
          {agendaQ.data && (
            <p className="mt-2 text-[11px] text-ink-subtle">{agendaQ.data.observacao}</p>
          )}
          {agendaQ.data && agendaQ.data.slots.every((sl) => !sl.disponivel) && (
            <p className="mt-1 text-[11px] text-pco-orange">
              Nenhum horário livre neste dia. Escolha outro.
            </p>
          )}
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
  enviando,
  erro,
}: {
  service: SessionService;
  professional: ProfessionalRow;
  date: string;
  time: string;
  onConfirm: () => void;
  onBack: () => void;
  enviando: boolean;
  erro: string | null;
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
        <Row
          label="Valor"
          value={`R$ ${(professional.priceCents / 100).toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
          })}`}
        />
      </div>
      <p className="mt-3 text-[11px] text-ink-subtle">
        {service.paymentBeforeConfirmation
          ? 'A sessão fica reservada e você paga em seguida, pelo gateway. A confirmação entra assim que o pagamento é aprovado.'
          : 'A confirmação é manual: a coordenação valida a sessão e envia o link da reunião.'}
      </p>
      {erro && (
        <p className="mt-3 rounded-lg bg-status-danger/10 p-2.5 text-[11px] text-status-danger">
          {erro}
        </p>
      )}
      <button
        onClick={onConfirm}
        disabled={enviando}
        className="pco-btn-primary w-full justify-center mt-5 disabled:opacity-60"
      >
        <Check size={14} strokeWidth={2} />
        {enviando ? 'Agendando…' : 'Confirmar agendamento'}
      </button>
    </>
  );
}

/**
 * O texto daqui diz só o que de fato acontece a seguir.
 *
 * A versão anterior prometia link da reunião por e-mail para todo mundo — e
 * como nada era gravado, o e-mail nunca ia sair. Agora o agendamento existe, e
 * o próximo passo depende do serviço: ou pagar, ou esperar a confirmação
 * manual. O link da reunião continua sendo colocado à mão pela coordenação,
 * então ele é mencionado como algo que chega depois da confirmação, não como
 * consequência automática de ter clicado aqui.
 */
function DoneStep({
  serviceName,
  proName,
  aguardandoPagamento,
  onClose,
}: {
  serviceName: string;
  proName: string;
  aguardandoPagamento: boolean;
  onClose: () => void;
}) {
  return (
    <div className="text-center py-4">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-status-success/15 grid place-items-center mb-4">
        <Check className="text-status-success" size={28} strokeWidth={2} />
      </div>
      <h2 className="text-lg font-semibold text-pco-deep">
        {aguardandoPagamento ? 'Sessão reservada' : 'Agendamento registrado'}
      </h2>
      <p className="mt-2 text-sm text-ink-muted">
        Sua sessão de <strong>{serviceName}</strong> com <strong>{proName}</strong> está gravada e
        aparece em <strong>Minhas sessões</strong>.{' '}
        {aguardandoPagamento
          ? 'Ela fica reservada aguardando o pagamento — o botão Pagar está na lista.'
          : 'A coordenação confirma e envia o link da reunião.'}
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

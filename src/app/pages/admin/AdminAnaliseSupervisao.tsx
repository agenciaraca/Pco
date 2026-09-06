import { useMemo, useState } from 'react';
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
import {
  useSessionServices,
  useAdminProfessionals,
  useAllBookings,
  useUpdateBooking,
  useCancelBooking,
  useZoomConfig,
  useJobs,
  usePriceTiers,
  useSessionPolicy,
  useCreateSessionService,
  useUpdateSessionService,
  useDeleteSessionService,
  useCreateProfessional,
  useUpdateProfessional,
  useDeleteProfessional,
  useUpsertPriceTier,
  useSeedPriceTiers,
} from '../../data/hooks';
import { useToast } from '../../components/Toast';
import type { AdminProfessionalRow, PriceTier } from '../../data/api';
import type { SessionService } from '../../types/schema';
import { useT } from '../../i18n';
import { SemConexao, FalhaAoCarregar } from '../../components/EstadosDeConsulta';

/** Centavos para real, do jeito que o brasileiro lê. */
function reais(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const tabs = [
  { id: 'servicos', label: 'Serviços', icon: <Stethoscope size={14} strokeWidth={1.75} /> },
  { id: 'profissionais', label: 'Profissionais', icon: <Users size={14} strokeWidth={1.75} /> },
  { id: 'agenda', label: 'Agenda', icon: <Calendar size={14} strokeWidth={1.75} /> },
  { id: 'valores', label: 'Valores', icon: <DollarSign size={14} strokeWidth={1.75} /> },
  { id: 'integracoes', label: 'Integrações', icon: <Plug size={14} strokeWidth={1.75} /> },
  {
    id: 'agendamentos',
    label: 'Agendamentos',
    icon: <ClipboardList size={14} strokeWidth={1.75} />,
  },
  {
    id: 'politicas',
    label: 'Políticas e Avisos',
    icon: <AlertCircle size={14} strokeWidth={1.75} />,
  },
];

/*
  Lista vazia estável.

  `data ?? []` cria um array novo a cada render, e todo `useMemo` que dependa
  dele recalcula sempre — o oposto do que o `useMemo` está ali para fazer.
*/
const VAZIO: never[] = [];

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

      <AvisoVendaCasada />

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

/**
 * O aviso não é zelo de redação: é a regra que impede a venda casada.
 * Condicionar a venda do curso à contratação de análise ou supervisão é vedado
 * pelo art. 39, I, do CDC. O texto e a base legal vêm do servidor
 * (`server/sessions/regra-opcional.ts`) para que exista uma fonte só.
 */
function AvisoVendaCasada() {
  const { data } = useSessionPolicy();
  return (
    <div className="pco-card border-pco-orange/30 bg-pco-orange/5 p-4 flex gap-3">
      <AlertCircle className="text-pco-orange shrink-0" size={18} strokeWidth={1.75} />
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-pco-deep">
          {data?.aviso ??
            'Análise, supervisão e orientação são opcionais e não são requisito para nenhum curso.'}
        </p>
        {data?.baseLegal && <p className="text-xs text-ink-muted">{data.baseLegal}</p>}
      </div>
    </div>
  );
}

function ServicosPane() {
  const toast = useToast();
  const { data: sessionServices = [] } = useSessionServices();
  const criar = useCreateSessionService();
  const atualizar = useUpdateSessionService();
  const remover = useDeleteSessionService();
  const [editando, setEditando] = useState<Partial<SessionService> | null>(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState<string | null>(null);

  async function salvar() {
    if (!editando) return;
    try {
      if (editando.id) {
        await atualizar.mutateAsync({ id: editando.id, patch: editando });
        toast.success('Serviço atualizado', editando.name ?? '');
      } else {
        await criar.mutateAsync(editando);
        toast.success('Serviço criado', editando.name ?? '');
      }
      setEditando(null);
    } catch (err) {
      toast.error('Não foi possível salvar', err instanceof Error ? err.message : 'Erro');
    }
  }

  async function excluir(id: string) {
    try {
      await remover.mutateAsync(id);
      toast.success('Serviço removido', '');
      setConfirmarExclusao(null);
    } catch (err) {
      toast.error('Não foi possível remover', err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-pco-deep">Serviços oferecidos</h3>
          <p className="text-xs text-ink-muted mt-0.5">
            O serviço define o que é e quanto dura. Quanto custa vem da titulação de quem atende —
            na aba Valores.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            setEditando({
              name: '',
              type: 'analise',
              description: '',
              durationMinutes: 50,
              price: 0,
              active: true,
              paymentBeforeConfirmation: true,
            })
          }
          className="pco-btn-primary text-xs"
        >
          <Plus size={12} strokeWidth={2} />
          Novo serviço
        </button>
      </div>

      {sessionServices.length === 0 && (
        <div className="pco-card text-sm text-ink-muted">
          Nenhum serviço cadastrado ainda. Comece por "Análise pessoal" e "Supervisão clínica".
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {sessionServices.map((s) => (
          <div key={s.id} className="pco-card">
            <div className="flex items-start justify-between">
              <span className="pco-badge bg-pco-blue/10 text-pco-blue capitalize">{s.type}</span>
              <button
                type="button"
                onClick={() => atualizar.mutate({ id: s.id, patch: { active: !s.active } })}
                className={`pco-badge cursor-pointer ${
                  s.active
                    ? 'bg-status-success/10 text-status-success'
                    : 'bg-surface-gray text-ink-muted'
                }`}
              >
                {s.active ? 'Ativo' : 'Inativo'}
              </button>
            </div>
            <h4 className="mt-3 text-base font-semibold text-pco-deep">{s.name}</h4>
            <p className="mt-1 text-xs text-ink-muted line-clamp-2">{s.description}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <Tile label="Duração" value={`${s.durationMinutes} min`} />
              <Tile
                label="Pagamento"
                value={s.paymentBeforeConfirmation ? 'Antecipado' : 'Manual'}
              />
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setEditando({ ...s })}
                className="pco-btn-secondary text-xs flex-1 justify-center"
              >
                <Edit3 size={12} strokeWidth={1.75} />
                Editar
              </button>
              {confirmarExclusao === s.id ? (
                <button
                  type="button"
                  onClick={() => excluir(s.id)}
                  className="pco-btn-primary text-xs bg-status-danger"
                >
                  Confirmar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmarExclusao(s.id)}
                  className="pco-btn-ghost text-xs px-3 text-status-danger"
                >
                  <Trash2 size={12} strokeWidth={1.75} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {editando && (
        <div className="pco-card space-y-3 border-pco-blue/40">
          <h4 className="text-sm font-semibold text-pco-deep">
            {editando.id ? 'Editar serviço' : 'Novo serviço'}
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome">
              <input
                value={editando.name ?? ''}
                onChange={(e) => setEditando({ ...editando, name: e.target.value })}
                className="pco-input"
                placeholder="Análise pessoal"
              />
            </Field>
            <Field label="Tipo">
              <select
                value={editando.type ?? 'analise'}
                onChange={(e) =>
                  setEditando({ ...editando, type: e.target.value as SessionService['type'] })
                }
                className="pco-input"
              >
                <option value="analise">Análise</option>
                <option value="supervisao">Supervisão</option>
                <option value="orientacao">Orientação</option>
              </select>
            </Field>
            <Field label="Duração (min)">
              <input
                type="number"
                min={10}
                max={240}
                value={editando.durationMinutes ?? 50}
                onChange={(e) =>
                  setEditando({ ...editando, durationMinutes: Number(e.target.value) })
                }
                className="pco-input"
              />
            </Field>
            <Field label="Pagamento antes da confirmação">
              <label className="inline-flex items-center gap-2 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editando.paymentBeforeConfirmation ?? true}
                  onChange={(e) =>
                    setEditando({ ...editando, paymentBeforeConfirmation: e.target.checked })
                  }
                  className="h-4 w-4 rounded"
                />
                <span className="text-sm text-pco-deep">Sim</span>
              </label>
            </Field>
          </div>
          <Field label="Descrição">
            <textarea
              value={editando.description ?? ''}
              onChange={(e) => setEditando({ ...editando, description: e.target.value })}
              rows={2}
              className="pco-input"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditando(null)}
              className="pco-btn-ghost text-xs"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={salvar}
              disabled={!editando.name || criar.isPending || atualizar.isPending}
              className="pco-btn-primary text-xs"
            >
              Salvar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfissionaisPane() {
  const toast = useToast();
  const { data: professionals = [] } = useAdminProfessionals();
  const { data: faixas = [] } = usePriceTiers();
  const criar = useCreateProfessional();
  const atualizar = useUpdateProfessional();
  const remover = useDeleteProfessional();
  const [editando, setEditando] = useState<Partial<AdminProfessionalRow> | null>(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState<string | null>(null);

  async function salvar() {
    if (!editando) return;
    try {
      if (editando.id) {
        await atualizar.mutateAsync({ id: editando.id, patch: editando });
        toast.success('Profissional atualizado', editando.name ?? '');
      } else {
        await criar.mutateAsync(editando);
        toast.success('Profissional cadastrado', editando.name ?? '');
      }
      setEditando(null);
    } catch (err) {
      toast.error('Não foi possível salvar', err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-pco-deep">Profissionais</h3>
          <p className="text-xs text-ink-muted mt-0.5">
            A titulação define o valor da sessão. "Disponível" é o que decide quem aparece para o
            aluno agendar agora.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            setEditando({
              name: '',
              email: '',
              bio: '',
              credentials: '',
              level: faixas[0]?.id ?? 'escola',
              avatarColor: 'from-pco-blue to-pco-cyan',
              specialties: [],
              serviceIds: [],
              active: true,
              available: true,
            })
          }
          className="pco-btn-primary text-xs"
        >
          <Plus size={12} strokeWidth={2} />
          Novo profissional
        </button>
      </div>

      {professionals.length === 0 && (
        <div className="pco-card text-sm text-ink-muted">
          Nenhum profissional cadastrado. Sem ninguém disponível, o aluno não consegue agendar.
        </div>
      )}

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
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-semibold text-pco-deep">{p.name}</h4>
                  <button
                    type="button"
                    onClick={() =>
                      atualizar.mutate({ id: p.id, patch: { available: !p.available } })
                    }
                    className={`pco-badge cursor-pointer shrink-0 ${
                      p.available
                        ? 'bg-status-success/10 text-status-success'
                        : 'bg-surface-gray text-ink-muted'
                    }`}
                  >
                    {p.available ? 'Disponível' : 'Sem agenda'}
                  </button>
                </div>
                <p className="text-xs text-ink-subtle mt-0.5">{p.credentials}</p>
                <p className="text-xs text-ink-muted line-clamp-2 mt-1">{p.bio}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.specialties.map((sp) => (
                    <span key={sp} className="pco-badge bg-pco-blue/10 text-pco-blue">
                      {sp}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ink-subtle">
                  <span className="inline-flex items-center gap-1">
                    <Mail size={11} />
                    {p.email}
                  </span>
                  <span className="font-semibold text-pco-deep">
                    {faixas.find((f) => f.id === p.level)?.label ?? p.level} ·{' '}
                    {p.precoIndefinido ? 'sem faixa ativa' : reais(p.priceCents)}
                  </span>
                </div>
                {/*
                  Os dois motivos silenciosos de um profissional cadastrado não
                  aparecer para o aluno. Antes, o primeiro fazia o contrário —
                  sem serviço marcado, ele era oferecido para todos — e o
                  segundo o deixava valendo R$ 0,00.
                */}
                {(p.serviceIds.length === 0 || p.precoIndefinido) && (
                  <div className="mt-2 rounded-lg bg-pco-orange/10 px-2.5 py-2 text-xs text-pco-orange">
                    Não aparece para o aluno:{' '}
                    {p.serviceIds.length === 0
                      ? 'nenhum serviço marcado'
                      : 'titulação sem faixa de preço ativa'}
                    .
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditando({ ...p })}
                    className="pco-btn-secondary text-xs"
                  >
                    Editar
                  </button>
                  {confirmarExclusao === p.id ? (
                    <button
                      type="button"
                      onClick={async () => {
                        await remover.mutateAsync(p.id);
                        setConfirmarExclusao(null);
                      }}
                      className="pco-btn-primary text-xs bg-status-danger"
                    >
                      Confirmar exclusão
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmarExclusao(p.id)}
                      className="pco-btn-ghost text-xs text-status-danger"
                    >
                      Excluir
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editando && (
        <div className="pco-card space-y-3 border-pco-blue/40">
          <h4 className="text-sm font-semibold text-pco-deep">
            {editando.id ? 'Editar profissional' : 'Novo profissional'}
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome">
              <input
                value={editando.name ?? ''}
                onChange={(e) => setEditando({ ...editando, name: e.target.value })}
                className="pco-input"
              />
            </Field>
            <Field label="E-mail">
              <input
                type="email"
                value={editando.email ?? ''}
                onChange={(e) => setEditando({ ...editando, email: e.target.value })}
                className="pco-input"
              />
            </Field>
            <Field label="Titulação (define o valor)">
              <select
                value={editando.level ?? 'escola'}
                onChange={(e) => setEditando({ ...editando, level: e.target.value })}
                className="pco-input"
              >
                {faixas.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label} — {reais(f.priceCents)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Credenciais (texto exibido)">
              <input
                value={editando.credentials ?? ''}
                onChange={(e) => setEditando({ ...editando, credentials: e.target.value })}
                placeholder="Doutora em Psicologia Clínica — USP"
                className="pco-input"
              />
            </Field>
            <Field label="Especialidades (separadas por vírgula)">
              <input
                value={(editando.specialties ?? []).join(', ')}
                onChange={(e) =>
                  setEditando({
                    ...editando,
                    specialties: e.target.value
                      .split(',')
                      .map((x) => x.trim())
                      .filter(Boolean),
                  })
                }
                className="pco-input"
              />
            </Field>
            <Field label="Estado">
              <div className="flex gap-4 mt-2">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editando.active ?? true}
                    onChange={(e) => setEditando({ ...editando, active: e.target.checked })}
                    className="h-4 w-4 rounded"
                  />
                  <span className="text-sm text-pco-deep">Ativo</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editando.available ?? true}
                    onChange={(e) => setEditando({ ...editando, available: e.target.checked })}
                    className="h-4 w-4 rounded"
                  />
                  <span className="text-sm text-pco-deep">Disponível agora</span>
                </label>
              </div>
            </Field>
          </div>
          <Field label="Bio">
            <textarea
              value={editando.bio ?? ''}
              onChange={(e) => setEditando({ ...editando, bio: e.target.value })}
              rows={2}
              className="pco-input"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditando(null)}
              className="pco-btn-ghost text-xs"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={salvar}
              disabled={!editando.name || !editando.email || criar.isPending || atualizar.isPending}
              className="pco-btn-primary text-xs"
            >
              Salvar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Agenda real.
 *
 * O calendário marcava sessões nos dias 4, 9, 12, 15, 21 e 28 — uma lista
 * escrita à mão, igual em todo mês, para sempre. E "Próximas sessões" listava
 * Carla, Diego e Renata, que não existem. Enquanto não havia agendamento no
 * sistema isso era maquete; depois que passou a haver, virou desinformação
 * apresentada como agenda.
 */
function AgendaPane() {
  const { data: professionals = [] } = useAdminProfessionals();
  const bookingsQ = useAllBookings();
  const bookings = bookingsQ.data ?? VAZIO;
  const [profFiltro, setProfFiltro] = useState<string>('');
  const [mesOffset, setMesOffset] = useState(0);

  const hoje = new Date();
  const base = new Date(hoje.getFullYear(), hoje.getMonth() + mesOffset, 1);
  const ano = base.getFullYear();
  const mes = base.getMonth();
  const rotuloMes = base.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const primeiroDia = new Date(ano, mes, 1).getDay();
  const diasSemana = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  // Só sessões de pé ocupam a agenda: cancelada não é compromisso de ninguém.
  const dePe = useMemo(
    () =>
      bookings.filter(
        (b) =>
          b.status !== 'cancelled' && (!profFiltro || b.professionalId === profFiltro),
      ),
    [bookings, profFiltro],
  );

  /** Quantas sessões em cada dia do mês exibido. */
  const porDia = useMemo(() => {
    const mapa = new Map<number, number>();
    for (const b of dePe) {
      const d = new Date(b.scheduledFor);
      if (d.getFullYear() !== ano || d.getMonth() !== mes) continue;
      mapa.set(d.getDate(), (mapa.get(d.getDate()) ?? 0) + 1);
    }
    return mapa;
  }, [dePe, ano, mes]);

  const proximas = useMemo(() => {
    const agora = Date.now();
    return dePe
      .filter((b) => new Date(b.scheduledFor).getTime() >= agora)
      .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))
      .slice(0, 8);
  }, [dePe]);

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="lg:col-span-2 pco-card">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMesOffset((m) => m - 1)}
              className="pco-btn-ghost text-xs"
              aria-label="Mês anterior"
            >
              ‹
            </button>
            <h3 className="text-base font-semibold text-pco-deep capitalize">{rotuloMes}</h3>
            <button
              onClick={() => setMesOffset((m) => m + 1)}
              className="pco-btn-ghost text-xs"
              aria-label="Próximo mês"
            >
              ›
            </button>
            {mesOffset !== 0 && (
              <button onClick={() => setMesOffset(0)} className="pco-btn-ghost text-xs">
                Hoje
              </button>
            )}
          </div>
          <select
            value={profFiltro}
            onChange={(e) => setProfFiltro(e.target.value)}
            className="pco-input w-auto text-xs"
          >
            <option value="">Todos os profissionais</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {diasSemana.map((d, i) => (
            <div
              key={`${d}-${i}`}
              className="text-xs uppercase tracking-wider text-ink-subtle text-center py-1"
            >
              {d}
            </div>
          ))}
          {Array.from({ length: primeiroDia }).map((_, i) => (
            <div key={`vazio-${i}`} />
          ))}
          {Array.from({ length: diasNoMes }).map((_, i) => {
            const dia = i + 1;
            const ehHoje =
              mesOffset === 0 && dia === hoje.getDate() && mes === hoje.getMonth();
            const quantas = porDia.get(dia) ?? 0;
            return (
              <div
                key={dia}
                title={quantas ? `${quantas} sessão(ões)` : undefined}
                className={`aspect-square rounded-lg border text-xs font-medium ${
                  ehHoje
                    ? 'border-pco-blue bg-pco-blue/10 text-pco-blue'
                    : 'border-surface-gray text-ink-muted'
                }`}
              >
                <div className="relative h-full grid place-items-center">
                  {dia}
                  {quantas > 0 && (
                    <span className="absolute bottom-1 text-[9px] font-semibold text-pco-orange">
                      {quantas}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {!bookingsQ.isPending &&
          !bookingsQ.isError &&
          bookingsQ.fetchStatus !== 'paused' &&
          dePe.length === 0 && (
          <p className="mt-4 text-xs text-ink-muted">
            Nenhuma sessão agendada ainda — os pontos aparecem quando houver.
          </p>
        )}
      </div>

      <div className="pco-card">
        <h3 className="text-base font-semibold text-pco-deep mb-3">Próximas sessões</h3>
{bookingsQ.fetchStatus === 'paused' ? (
          <SemConexao oQue="os agendamentos" />
        ) : bookingsQ.isError ? (
          <FalhaAoCarregar
            erro={bookingsQ.error}
            oQue="os agendamentos"
            aoTentarDeNovo={() => void bookingsQ.refetch()}
          />
        ) : bookingsQ.isPending ? (
          <p className="text-xs text-ink-muted">Carregando…</p>
        ) : proximas.length === 0 ? (
          <p className="text-xs text-ink-muted">Nada marcado daqui para frente.</p>
        ) : (
          <ul className="space-y-2">
            {proximas.map((b) => (
              <li key={b.id} className="rounded-xl bg-surface-off p-3">
                <div className="text-xs font-semibold text-pco-blue">
                  {new Date(b.scheduledFor).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
                <div className="text-sm font-semibold text-pco-deep">{b.userEmail}</div>
                <div className="text-xs text-ink-subtle">
                  {b.serviceName} · {b.professionalName}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ValoresPane() {
  const toast = useToast();
  const { data: faixas = [] } = usePriceTiers();
  const { data: professionals = [] } = useAdminProfessionals();
  const salvarFaixa = useUpsertPriceTier();
  const semear = useSeedPriceTiers();
  const [rascunho, setRascunho] = useState<Record<string, string>>({});

  async function salvar(f: PriceTier) {
    const bruto = rascunho[f.id];
    if (bruto === undefined) return;
    // Aceita "80", "80,00" e "R$ 80,00": quem digita preço não deveria ter que
    // pensar em centavos.
    const limpo = bruto.replace(/[^\d,.]/g, '').replace(',', '.');
    const valor = Number(limpo);
    if (!Number.isFinite(valor) || valor < 0) {
      toast.error('Valor inválido', 'Use algo como 80 ou 80,00.');
      return;
    }
    try {
      await salvarFaixa.mutateAsync({
        id: f.id,
        patch: { ...f, priceCents: Math.round(valor * 100) },
      });
      setRascunho((r) => {
        const { [f.id]: _, ...resto } = r;
        return resto;
      });
      toast.success(
        `${f.label}: ${reais(Math.round(valor * 100))}`,
        'Vale para toda sessão nesta faixa.',
      );
    } catch (err) {
      toast.error('Não foi possível salvar', err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <div className="space-y-5">
      <div className="pco-card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-pco-deep">Valor da sessão por titulação</h3>
            <p className="text-xs text-ink-muted mt-1 max-w-xl">
              É a titulação de quem atende que define o preço, não o serviço: a mesma análise custa
              um valor com profissional da escola e outro com doutor. Mudar aqui muda o valor de
              todos os profissionais daquela faixa.
            </p>
          </div>
          {faixas.length === 0 && (
            <button
              type="button"
              onClick={() => semear.mutate(undefined)}
              className="pco-btn-secondary text-xs shrink-0"
            >
              Criar as três faixas
            </button>
          )}
        </div>

        <ul className="mt-4 space-y-2">
          {faixas.map((f) => {
            const quantos = professionals.filter((p) => p.level === f.id).length;
            const editado = rascunho[f.id] !== undefined;
            return (
              <li
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-off p-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-pco-deep">{f.label}</div>
                  <div className="text-xs text-ink-muted">
                    {f.description}
                    {quantos > 0 && (
                      <>
                        {' '}
                        · {quantos} {quantos === 1 ? 'profissional' : 'profissionais'}
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-ink-subtle">R$</span>
                  <input
                    value={
                      editado ? rascunho[f.id] : (f.priceCents / 100).toFixed(2).replace('.', ',')
                    }
                    onChange={(e) => setRascunho((r) => ({ ...r, [f.id]: e.target.value }))}
                    className="pco-input w-28 text-right tabular-nums"
                    inputMode="decimal"
                  />
                  <button
                    type="button"
                    onClick={() => salvar(f)}
                    disabled={!editado || salvarFaixa.isPending}
                    className="pco-btn-primary text-xs"
                  >
                    Salvar
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="pco-card space-y-3">
        <h3 className="text-base font-semibold text-pco-deep">Pacotes de sessões</h3>
        <p className="text-sm text-ink-muted">
          Pacotes com desconto entram como produto no catálogo. Um pacote continua sendo compra
          avulsa: não pode virar condição para nada.
        </p>
        <Link to="/admin/produtos" className="pco-btn-secondary text-xs w-fit">
          <Plus size={12} strokeWidth={2} />
          Abrir catálogo de produtos
        </Link>
      </div>
    </div>
  );
}

/**
 * Integrações — o que existe, e o que não existe.
 *
 * Esta aba dizia "Google Calendar: Conectado" e "Google Meet: Conectado". Nem
 * uma nem outra existem no sistema. Um admin lia isso e concluía que a sessão
 * agendada apareceria na agenda dele — não aparece, e ele descobriria faltando
 * ao atendimento. Havia também interruptores de lembrete marcados que não
 * ligavam em coisa nenhuma.
 *
 * Agora a aba mostra estado real: o Zoom, que de fato existe, aparece com a
 * configuração dele; o resto aparece como não implementado, sem botão de
 * "Conectar" que não conecta. E os lembretes, que passaram a existir de
 * verdade, mostram o estado do worker em vez de um toggle decorativo.
 */
function IntegracoesPane() {
  const { data: zoom } = useZoomConfig();
  const { data: jobsData } = useJobs();

  const lembretes = jobsData?.jobs?.find((j) => j.name === 'session-reminders');
  const zoomConfigurado = Boolean(
    (zoom as { accountId?: string; clientId?: string } | undefined)?.clientId,
  );

  const naoImplementadas = ['Google Calendar', 'Google Meet', 'Microsoft Teams', 'Whereby'];

  return (
    <div className="space-y-4">
      <div className="pco-card">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm font-semibold text-pco-deep">Zoom</div>
            <div className="text-xs text-ink-subtle">
              {zoomConfigurado
                ? 'Configurado — sessões ao vivo podem usar o SDK do Zoom.'
                : 'Não configurado.'}
            </div>
          </div>
          <Link to="/admin/zoom" className="pco-btn-secondary text-xs">
            {zoomConfigurado ? 'Configurar' : 'Conectar'}
          </Link>
        </div>
      </div>

      <div className="pco-card">
        <h3 className="text-base font-semibold text-pco-deep">Lembretes automáticos</h3>
        <p className="mt-1 text-xs text-ink-muted">
          O aluno recebe aviso 24h e 1h antes da sessão, por notificação e e-mail. Um lembrete
          por faixa, nunca repetido.
        </p>
        <div className="mt-3 flex items-center gap-2 text-xs">
          <span
            className={`pco-badge ${
              lembretes?.enabled
                ? 'bg-status-success/10 text-status-success'
                : 'bg-surface-gray text-ink-muted'
            }`}
          >
            {lembretes?.enabled ? 'Ativo' : 'Parado'}
          </span>
          {lembretes?.lastRunAt && (
            <span className="text-ink-subtle">
              última varredura: {new Date(lembretes.lastRunAt).toLocaleString('pt-BR')}
            </span>
          )}
          <Link to="/admin/jobs" className="text-pco-blue underline">
            ver em Jobs
          </Link>
        </div>
      </div>

      <div className="pco-card">
        <h3 className="text-base font-semibold text-pco-deep">Ainda não implementadas</h3>
        <p className="mt-1 text-xs text-ink-muted">
          O link da reunião é colocado à mão pela coordenação, na aba Agendamentos. Enquanto
          nenhuma destas existir, é assim que ele chega ao aluno.
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {naoImplementadas.map((nome) => (
            <li key={nome} className="pco-badge bg-surface-gray text-ink-muted">
              {nome}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * Agendamentos reais.
 *
 * Esta tela mostrava três agendamentos escritos à mão — com nomes de alunos
 * inventados e um botão "Detalhes" que não abria nada. Enquanto não havia rota
 * de agendamento isso era maquete; depois que passou a haver, virou risco de
 * alguém acreditar. Agora vem do banco, e o que está aqui pode ser mexido.
 */
function AgendamentosPane() {
  const { data: bookings = [], isLoading } = useAllBookings();
  const atualizar = useUpdateBooking();
  const cancelar = useCancelBooking();
  const [linkAberto, setLinkAberto] = useState<string | null>(null);
  const [rascunhoLink, setRascunhoLink] = useState('');

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

  if (isLoading) {
    return <div className="pco-card text-sm text-ink-muted">Carregando agendamentos…</div>;
  }

  if (bookings.length === 0) {
    return (
      <div className="pco-card text-sm text-ink-muted">
        Nenhum agendamento ainda. Assim que um aluno marcar em{' '}
        <span className="font-medium text-pco-deep">/analise-supervisao</span>, ele aparece aqui.
      </div>
    );
  }

  return (
    <div className="pco-card p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-off">
            <tr className="text-xs uppercase tracking-wider text-ink-subtle">
              <th className="px-4 py-3 text-left font-medium">Aluno</th>
              <th className="px-4 py-3 text-left font-medium">Serviço</th>
              <th className="px-4 py-3 text-left font-medium">Profissional</th>
              <th className="px-4 py-3 text-left font-medium">Data</th>
              <th className="px-4 py-3 text-left font-medium">Valor</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Reunião</th>
              <th className="px-4 py-3 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id} className="border-t border-surface-gray hover:bg-surface-off">
                <td className="px-4 py-3 font-semibold text-pco-deep">{b.userEmail}</td>
                <td className="px-4 py-3 text-ink-muted">{b.serviceName}</td>
                <td className="px-4 py-3 text-ink-muted">{b.professionalName}</td>
                <td className="px-4 py-3 text-ink-muted">
                  {new Date(b.scheduledFor).toLocaleString('pt-BR', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </td>
                <td className="px-4 py-3 text-ink-muted">{reais(b.priceCents)}</td>
                <td className="px-4 py-3">
                  <select
                    value={b.status}
                    disabled={atualizar.isPending}
                    onChange={(e) =>
                      atualizar.mutate({
                        id: b.id,
                        patch: { status: e.target.value as typeof b.status },
                      })
                    }
                    className={`pco-badge border-0 ${statusStyle[b.status]}`}
                  >
                    {Object.entries(statusLabel).map(([v, label]) => (
                      <option key={v} value={v}>
                        {label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-ink-muted">
                  {linkAberto === b.id ? (
                    <div className="flex gap-1">
                      <input
                        value={rascunhoLink}
                        onChange={(e) => setRascunhoLink(e.target.value)}
                        placeholder="https://meet…"
                        className="pco-input text-xs w-44"
                      />
                      <button
                        className="pco-btn-primary text-xs"
                        onClick={() => {
                          atualizar.mutate({ id: b.id, patch: { meetingLink: rascunhoLink } });
                          setLinkAberto(null);
                        }}
                      >
                        Salvar
                      </button>
                    </div>
                  ) : (
                    <button
                      className="pco-btn-ghost text-xs"
                      onClick={() => {
                        setLinkAberto(b.id);
                        setRascunhoLink(b.meetingLink);
                      }}
                    >
                      {b.meetingLink ? 'Editar link' : 'Definir link'}
                    </button>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {b.status !== 'cancelled' && b.status !== 'done' && (
                    <button
                      className="pco-btn-ghost text-xs text-status-danger"
                      disabled={cancelar.isPending}
                      onClick={() => cancelar.mutate({ id: b.id, reason: 'Cancelado pela gestão' })}
                    >
                      Cancelar
                    </button>
                  )}
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
  const { data } = useSessionPolicy();
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="pco-card space-y-4">
        <h3 className="text-base font-semibold text-pco-deep">
          Por que estes serviços não podem ser obrigatórios
        </h3>
        {/* Não é campo editável de propósito. O texto que impede a venda casada
            não deveria depender de alguém lembrar de mantê-lo — ele vem do
            servidor, de um módulo só, e os testes cobram a citação da lei. */}
        <div className="rounded-xl bg-surface-off p-4 space-y-3">
          <p className="text-sm text-pco-deep font-medium">{data?.aviso}</p>
          <p className="text-xs text-ink-muted leading-relaxed">{data?.baseLegal}</p>
        </div>
        <ul className="text-xs text-ink-muted space-y-1.5 list-disc pl-4">
          <li>Nenhuma sessão pode ser requisito para acesso, progresso ou conclusão de curso.</li>
          <li>O certificado sai igual para quem contrata e para quem não contrata.</li>
          <li>Pacote com desconto continua sendo compra avulsa — nunca condição.</li>
        </ul>
        <p className="text-xs text-ink-subtle">
          Este aviso aparece nas telas do aluno e antes de qualquer agendamento.
        </p>
      </div>

      {/*
        Estes dois campos não guardavam nada e, pior, descreviam regras que o
        sistema não aplica: hoje cancelar e remarcar valem até a hora da sessão,
        sem prazo mínimo. Deixá-los editáveis fazia a coordenação acreditar que
        tinha configurado uma política que nunca existiu.
      */}
      <div className="pco-card space-y-3">
        <h3 className="text-base font-semibold text-pco-deep">Políticas adicionais</h3>
        <p className="rounded-lg bg-pco-orange/10 px-3 py-2 text-xs text-pco-orange">
          Ainda não implementadas. Hoje o aluno pode cancelar ou remarcar até a hora da
          sessão, sem prazo mínimo — e é isso que o sistema faz, independentemente do que
          for escolhido aqui.
        </p>
        <Field label="Prazo mínimo para cancelamento">
          <select className="pco-input" disabled>
            <option>Sem prazo mínimo</option>
          </select>
        </Field>
        <Field label="Permite remarcação?">
          <select className="pco-input" disabled>
            <option>Sim, até a hora da sessão</option>
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
      <div className="text-xs uppercase tracking-wider text-ink-subtle">{label}</div>
      <div className="text-sm font-semibold text-pco-deep">{value}</div>
    </div>
  );
}


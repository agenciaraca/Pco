import { useMemo, useState } from 'react';
import {
  Trash2,
  CheckCircle2,
  XCircle,
  Search,
  Loader2,
  Clock,
  Eye,
  ShieldAlert,
  Lock,
} from 'lucide-react';
import {
  useAdminDeletionRequests,
  useUpdateAdminDeletionRequest,
  useExpurgarSolicitacao,
} from '../../data/hooks';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import { SemConexao, FalhaAoCarregar } from '../../components/EstadosDeConsulta';
import EmptyState from '../../components/EmptyState';
import { useToast } from '../../components/Toast';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import type {
  DeletionRequestDto,
  DeletionStatusDto,
  ExpurgoResultadoDto,
} from '../../data/api';

/**
 * A tela onde "concluída" deixou de ser um carimbo.
 *
 * Até 5/set/2026 o botão "Marcar concluída" perguntava *"confirmar que os
 * dados foram REMOVIDOS do sistema?"* — e a única coisa que ele fazia era
 * gravar um campo e uma nota. Nada era apagado em lugar nenhum. A frase pedia
 * ao operador que confirmasse, por conta própria, algo que o produto não fazia
 * e que ele não tinha como ter feito à mão: são dezenove categorias em treze
 * stores diferentes.
 *
 * Agora o fluxo tem três passos, e é o do meio que faltava:
 *
 * 1. **Aprovar** — a conferência humana de que o pedido é do titular daquela
 *    conta. Continua sendo de gente.
 * 2. **Ensaiar** — o relatório do que seria apagado, do que fica retido e por
 *    quê. Leitura pura; roda antes da aprovação também, porque é ele que ajuda
 *    a decidir.
 * 3. **Executar** — só depois de aprovada. E só depois disso "concluída" é
 *    aceita pelo servidor (409 `EXPURGO_NAO_EXECUTADO`, de propósito).
 *
 * O relatório fica anexado ao pedido: é o que distingue a escola ter apagado
 * de alguém ter marcado a caixinha.
 */

const STATUS_LABELS: Record<DeletionStatusDto, string> = {
  pending: 'Pendente',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
  completed: 'Concluída',
};

const STATUS_STYLE: Record<DeletionStatusDto, string> = {
  pending: 'bg-pco-orange/10 text-pco-orange',
  approved: 'bg-pco-blue/10 text-pco-blue',
  rejected: 'bg-surface-gray text-ink-muted',
  completed: 'bg-status-success/10 text-status-success',
};

const DESTINO_LABEL: Record<string, string> = {
  apagar: 'apagado',
  anonimizar: 'anonimizado',
  reter: 'retido',
};

export default function AdminDeletionRequests() {
  useDocumentMeta({ title: 'Exclusões de conta — Admin' });
  const list = useAdminDeletionRequests();
  const updateMut = useUpdateAdminDeletionRequest();
  const expurgoMut = useExpurgarSolicitacao();
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState<DeletionStatusDto | 'all'>('pending');
  const [search, setSearch] = useState('');
  /** Relatório do último ensaio/execução, por solicitação. */
  const [relatorios, setRelatorios] = useState<Record<string, ExpurgoResultadoDto>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);

  const visible = useMemo(() => {
    return (list.data ?? []).filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!r.userEmail.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [list.data, statusFilter, search]);

  async function handleAction(
    r: DeletionRequestDto,
    status: 'approved' | 'rejected' | 'completed',
  ) {
    const note = prompt(`Nota da decisão (opcional) para ${status} da conta ${r.userEmail}:`);
    if (note === null) return;
    try {
      await updateMut.mutateAsync({ id: r.id, status, note: note || undefined });
      toast.success(`Marcado como ${STATUS_LABELS[status]}`);
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  async function rodarExpurgo(r: DeletionRequestDto, commit: boolean) {
    if (commit) {
      const relatorio = relatorios[r.id];
      if (!relatorio) {
        toast.error('Ensaie primeiro', 'Rode o ensaio e confira o relatório antes de executar.');
        return;
      }
      if (
        !confirm(
          `Apagar definitivamente os dados de ${r.userEmail}?\n\n` +
            `Serão tratadas ${relatorio.tratadas.length} categorias e retidas ` +
            `${relatorio.retidas.length} por obrigação legal. Não há desfazer.`,
        )
      )
        return;
    }
    setOcupado(r.id);
    try {
      const res = await expurgoMut.mutateAsync({ id: r.id, commit });
      setRelatorios((m) => ({ ...m, [r.id]: res }));
      if (commit) {
        toast.success(
          'Expurgo executado',
          res.completo
            ? 'Todas as categorias foram tratadas.'
            : 'Houve categoria pendente — confira o relatório.',
        );
      } else {
        toast.success('Ensaio concluído', 'Nada foi alterado. Confira o relatório abaixo.');
      }
    } catch (err) {
      toast.error('Falha no expurgo', err instanceof Error ? err.message : 'Erro');
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <header>
        <h1 className="text-2xl font-bold text-pco-deep flex items-center gap-2">
          <Trash2 size={20} className="text-status-danger" strokeWidth={1.75} />
          Solicitações de exclusão (LGPD)
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          Direito ao esquecimento (art. 18, VI). Aprove, ensaie o expurgo, confira o relatório e só
          então execute — <strong>concluir exige que o expurgo tenha rodado</strong>.
        </p>
      </header>

      <div className="pco-card p-3 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[260px]">
          <Search size={13} className="text-ink-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar email..."
            className="pco-input text-sm flex-1"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as DeletionStatusDto | 'all')}
          className="pco-input text-sm"
        >
          <option value="all">Todos</option>
          <option value="pending">Pendentes</option>
          <option value="approved">Aprovadas</option>
          <option value="rejected">Rejeitadas</option>
          <option value="completed">Concluídas</option>
        </select>
      </div>

      {list.fetchStatus === 'paused' ? (
        <SemConexao oQue="as solicitações de exclusão" />
      ) : list.isPending ? (
        <CardListSkeleton count={3} />
      ) : list.isError ? (
        <FalhaAoCarregar
          erro={list.error}
          oQue="as solicitações de exclusão"
          aoTentarDeNovo={() => void list.refetch()}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title="Sem solicitações"
          description={
            statusFilter !== 'all'
              ? `Nenhuma solicitação com status "${STATUS_LABELS[statusFilter as DeletionStatusDto]}".`
              : 'Nenhuma solicitação de exclusão registrada.'
          }
          icon={<Trash2 size={28} className="text-pco-blue" />}
        />
      ) : (
        <ul className="space-y-2">
          {visible.map((r) => {
            const relatorio = relatorios[r.id];
            const rodando = ocupado === r.id;
            return (
              <li key={r.id} className="pco-card p-4">
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="flex-1 min-w-[260px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`pco-badge text-xs ${STATUS_STYLE[r.status]}`}>
                        {STATUS_LABELS[r.status]}
                      </span>
                      <span className="text-sm font-bold text-pco-deep">{r.userEmail}</span>
                      <span className="text-xs text-ink-subtle">
                        <Clock size={10} className="inline" />{' '}
                        {new Date(r.requestedAt).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    {r.reason && (
                      <p className="mt-2 text-xs text-ink-muted bg-surface-mute p-2 rounded italic">
                        &ldquo;{r.reason}&rdquo;
                      </p>
                    )}
                    {r.resolutionNote && (
                      <div className="mt-2 text-xs text-ink-subtle">
                        <strong>Nota:</strong> {r.resolutionNote}
                        {r.resolvedBy && ` · por ${r.resolvedBy}`}
                        {r.resolvedAt && ` em ${new Date(r.resolvedAt).toLocaleString('pt-BR')}`}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5 shrink-0">
                    {r.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleAction(r, 'approved')}
                          disabled={updateMut.isPending}
                          className="pco-btn-secondary text-xs"
                        >
                          <CheckCircle2 size={11} strokeWidth={2} />
                          Aprovar
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleAction(r, 'rejected')}
                          disabled={updateMut.isPending}
                          className="pco-btn-ghost text-xs"
                        >
                          <XCircle size={11} strokeWidth={2} />
                          Rejeitar
                        </button>
                      </>
                    )}

                    {r.status !== 'rejected' && r.status !== 'completed' && (
                      <button
                        type="button"
                        onClick={() => void rodarExpurgo(r, false)}
                        disabled={rodando}
                        className="pco-btn-ghost text-xs"
                        title="Leitura pura: lista o que seria apagado, sem tocar em nada."
                      >
                        {rodando ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <Eye size={11} strokeWidth={2} />
                        )}
                        Ensaiar expurgo
                      </button>
                    )}

                    {r.status === 'approved' && !r.expurgo && (
                      <button
                        type="button"
                        onClick={() => void rodarExpurgo(r, true)}
                        disabled={rodando || !relatorio}
                        className="pco-btn-primary text-xs bg-status-danger hover:bg-status-danger"
                        title={
                          relatorio
                            ? 'Apaga definitivamente. Não há desfazer.'
                            : 'Rode o ensaio antes.'
                        }
                      >
                        <ShieldAlert size={11} strokeWidth={2} />
                        Executar expurgo
                      </button>
                    )}

                    {r.status === 'approved' && r.expurgo && (
                      <button
                        type="button"
                        onClick={() => void handleAction(r, 'completed')}
                        disabled={updateMut.isPending}
                        className="pco-btn-primary text-xs"
                      >
                        <CheckCircle2 size={11} strokeWidth={2} />
                        Marcar concluída
                      </button>
                    )}
                  </div>
                </div>

                {/*
                  O expurgo que ficou registrado no pedido — e o relatório da
                  rodada atual, quando houver. Os dois aparecem: o primeiro é a
                  prova arquivada, o segundo é o que a pessoa acabou de ver.
                */}
                {r.expurgo && (
                  <p className="mt-3 text-xs text-status-success flex items-center gap-1">
                    <Lock size={11} strokeWidth={2} />
                    Expurgo executado em {new Date(r.expurgo.executadoEm).toLocaleString('pt-BR')}{' '}
                    por {r.expurgo.executadoPor} · {r.expurgo.tratadas.length} categorias tratadas,{' '}
                    {r.expurgo.retidas.length} retidas
                    {r.expurgo.pendentes.length > 0 &&
                      ` · ${r.expurgo.pendentes.length} PENDENTES`}
                  </p>
                )}

                {relatorio && <Relatorio r={relatorio} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Relatorio({ r }: { r: ExpurgoResultadoDto }) {
  return (
    <div className="mt-3 rounded border border-border-subtle bg-surface-mute p-3 space-y-3">
      <p className="text-xs font-bold text-pco-deep">
        {r.ensaio ? 'Ensaio — nada foi alterado' : 'Execução'}
        {!r.completo && (
          <span className="ml-2 text-status-danger">· incompleto, veja as pendências</span>
        )}
      </p>

      <table className="w-full text-xs">
        <thead className="text-ink-subtle">
          <tr>
            <th className="text-left font-medium pb-1">Categoria</th>
            <th className="text-left font-medium pb-1">Destino</th>
            <th className="text-right font-medium pb-1">Encontrados</th>
            <th className="text-right font-medium pb-1">{r.ensaio ? '—' : 'Tratados'}</th>
          </tr>
        </thead>
        <tbody>
          {r.itens.map((i) => (
            <tr key={i.categoria} className={i.erro ? 'text-status-danger' : 'text-ink-muted'}>
              <td className="py-0.5">{i.categoria}</td>
              <td className="py-0.5">{DESTINO_LABEL[i.destino] ?? i.destino}</td>
              <td className="py-0.5 text-right tabular-nums">
                {/* Erro não vira zero: zero diz "medi e não houve". */}
                {i.erro ? '—' : i.encontrados}
              </td>
              <td className="py-0.5 text-right tabular-nums">
                {i.erro ? i.erro : r.ensaio ? '—' : i.tratados}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {r.retidas.length > 0 && (
        <div className="text-xs text-ink-subtle space-y-1">
          <p className="font-medium text-ink-muted">O que fica, e por quê:</p>
          {r.retidas.map((x) => (
            <p key={x.categoria}>
              <strong>{x.categoria}</strong> — {x.motivo}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

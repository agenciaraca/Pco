import { useState } from 'react';
import { Mail, Save, Loader2, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  useStudentProgressEmailConfig,
  useUpdateStudentProgressEmailConfig,
  useStudentProgressEmailStatus,
} from '../../data/hooks';
import { useToast } from '../../components/Toast';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import { ErrorState } from '../../components/EmptyState';

const DAYS = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
];

export default function AdminStudentProgressEmail() {
  useDocumentMeta({ title: 'Progresso semanal do aluno — Admin AVA PCO' });
  const cfg = useStudentProgressEmailConfig();
  const status = useStudentProgressEmailStatus();
  const update = useUpdateStudentProgressEmailConfig();
  const toast = useToast();

  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [dayOfWeekUtc, setDay] = useState<number | null>(null);
  const [hourUtc, setHour] = useState<number | null>(null);

  const current = cfg.data;
  const effEnabled = enabled ?? current?.enabled ?? false;
  const effDay = dayOfWeekUtc ?? current?.dayOfWeekUtc ?? 0;
  const effHour = hourUtc ?? current?.hourUtc ?? 10;

  const dirty =
    !!current &&
    (effEnabled !== current.enabled ||
      effDay !== current.dayOfWeekUtc ||
      effHour !== current.hourUtc);

  async function handleSave() {
    try {
      await update.mutateAsync({
        enabled: effEnabled,
        dayOfWeekUtc: effDay,
        hourUtc: effHour,
      });
      toast.success('Salvo');
      setEnabled(null);
      setDay(null);
      setHour(null);
      void status.refetch();
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  if (cfg.isLoading) return <CardListSkeleton count={2} />;
  if (cfg.isError)
    return (
      <ErrorState
        action={
          <button onClick={() => cfg.refetch()} className="pco-btn-secondary text-xs">
            Tentar novamente
          </button>
        }
      />
    );

  const st = status.data;

  return (
    <div className="space-y-6 max-w-4xl">
      <header>
        <h1 className="text-2xl font-bold text-pco-deep flex items-center gap-2">
          <Mail size={20} className="text-pco-blue" strokeWidth={1.75} />
          E-mail semanal de progresso (aluno)
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          Envia a cada semana, para cada aluno ativo, um resumo do próprio progresso:
          aulas concluídas na semana, total acumulado, sequência de estudo e percentual
          por curso.
        </p>
      </header>

      <section className="pco-card p-4 space-y-2">
        <h2 className="text-sm font-semibold text-pco-deep flex items-center gap-2">
          <Clock size={14} strokeWidth={2} />
          Última execução
        </h2>
        {st?.lastRunAt ? (
          <div className="flex items-center gap-2 text-sm text-ink-muted flex-wrap">
            <CheckCircle2 size={13} className="text-status-success" strokeWidth={2} />
            <span>{new Date(st.lastRunAt).toLocaleString('pt-BR')}</span>
            {st.lastResult && (
              <span className="text-[11px] text-ink-subtle">
                · {st.lastResult.sent} enviados · {st.lastResult.skipped} pulados (sem
                e-mail ou sem progresso)
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-ink-muted">
            <AlertCircle size={13} className="text-pco-orange" strokeWidth={2} />
            Nenhum envio desde o último restart do servidor.
          </div>
        )}
      </section>

      <section className="pco-card p-4 space-y-4">
        <h2 className="text-sm font-semibold text-pco-deep">Configuração</h2>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={effEnabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="accent-pco-blue"
          />
          <span>Ativo — enviar toda semana</span>
        </label>

        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-ink-muted">
            Dia da semana (UTC)
          </span>
          <select
            value={effDay}
            onChange={(e) => setDay(Number(e.target.value))}
            className="pco-input mt-1 text-sm w-48 block"
          >
            {DAYS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-ink-muted">
            Hora de envio (UTC; BRT = UTC-3)
          </span>
          <input
            type="number"
            min={0}
            max={23}
            value={effHour}
            onChange={(e) => setHour(Number(e.target.value))}
            className="pco-input mt-1 text-sm w-32"
          />
          <span className="ml-2 text-[11px] text-ink-subtle">
            {String(effHour).padStart(2, '0')}:00 UTC ={' '}
            {String((effHour - 3 + 24) % 24).padStart(2, '0')}:00 BRT
          </span>
        </label>

        <p className="text-[11px] text-ink-muted">
          O worker verifica a cada 1h e dispara uma única vez na janela configurada.
          Alunos que optaram por não receber reengajamento ficam de fora automaticamente.
        </p>

        <div className="flex items-center gap-2 justify-end">
          {dirty && (
            <span className="text-[11px] text-pco-orange">Alterações não salvas</span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || update.isPending}
            className="pco-btn-primary"
          >
            {update.isPending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Save size={12} strokeWidth={2} />
            )}
            Salvar
          </button>
        </div>
      </section>
    </div>
  );
}

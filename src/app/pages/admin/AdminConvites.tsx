import { useState } from 'react';
import { Send, Users, ShieldAlert, Loader2, CheckCircle2, Mail } from 'lucide-react';
import { useConviteSegmentos, useConviteExcluidos, useEnviarConvites } from '../../data/hooks';
import { useToast } from '../../components/Toast';
import { CardListSkeleton } from '../../components/LoadingSkeleton';

/**
 * Convite de primeiro acesso para quem veio da plataforma antiga.
 *
 * A tela existe por causa de uma decisão que não cabe num script: quem NÃO deve
 * receber. Desistente, inadimplente, reembolsado, quem não tem matrícula e quem
 * já entrou ficam de fora — e a conta de cada exclusão aparece antes de qualquer
 * disparo, porque convite errado chega como cobrança disfarçada de boas-vindas.
 */
export default function AdminConvites() {
  const toast = useToast();
  const segQ = useConviteSegmentos();
  const enviar = useEnviarConvites();
  const [motivoAberto, setMotivoAberto] = useState<string | undefined>();
  const excluidosQ = useConviteExcluidos(motivoAberto);

  const [dias, setDias] = useState(7);
  const [porLote, setPorLote] = useState(25);
  const [progresso, setProgresso] = useState<{ enviados: number; restantes: number } | null>(null);
  const [enviandoTudo, setEnviandoTudo] = useState(false);

  const seg = segQ.data;

  async function simular() {
    try {
      const r = await enviar.mutateAsync({ limite: porLote, diasValidade: dias, simular: true });
      toast.success(
        'Simulação',
        `${r.destinatarios?.length ?? 0} pessoa(s) receberiam agora · ${r.restantes} na fila`,
      );
    } catch (err) {
      toast.error('Falha na simulação', err instanceof Error ? err.message : 'Erro');
    }
  }

  async function enviarUmLote() {
    try {
      const r = await enviar.mutateAsync({ limite: porLote, diasValidade: dias });
      setProgresso({ enviados: r.enviados, restantes: r.restantes });
      if (r.falhas && r.falhas.length > 0) {
        toast.error(`${r.enviados} enviado(s), ${r.falhas.length} falha(s)`, r.falhas[0]?.erro ?? '');
      } else {
        toast.success(`${r.enviados} convite(s) enviado(s)`, `${r.restantes} ainda na fila`);
      }
      return r;
    } catch (err) {
      toast.error('Falha no envio', err instanceof Error ? err.message : 'Erro');
      return null;
    }
  }

  async function enviarTudo() {
    setEnviandoTudo(true);
    let total = 0;
    try {
      // Lote a lote em vez de uma requisição só: a tela mostra progresso de
      // verdade, e uma queda no meio não deixa dúvida sobre quantos e-mails
      // saíram.
      for (let volta = 0; volta < 200; volta++) {
        const r = await enviarUmLote();
        if (!r) break;
        total += r.enviados;
        if (r.enviados === 0 || r.restantes === 0) break;
      }
      toast.success('Envio concluído', `${total} convite(s) nesta rodada`);
    } finally {
      setEnviandoTudo(false);
      void segQ.refetch();
    }
  }

  if (segQ.isLoading) return <CardListSkeleton count={3} />;
  if (!seg) return <div className="pco-card text-sm text-ink-muted">Não foi possível carregar.</div>;

  const motivos = Object.entries(seg.porMotivo).sort((a, b) => b[1] - a[1]);
  const ocupado = enviar.isPending || enviandoTudo;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-pco-deep">Convite de primeiro acesso</h1>
        <p className="text-sm text-ink-muted mt-1 max-w-2xl">
          Quem veio da plataforma antiga tem conta, matrícula e progresso aqui, mas nunca definiu
          senha. O convite manda um link para a própria pessoa escolher a senha — nenhuma senha
          viaja por e-mail.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="pco-card">
          <div className="text-xs uppercase tracking-wide text-ink-subtle">Vão receber</div>
          <div className="text-3xl font-bold text-status-success mt-1">{seg.elegiveis}</div>
          <div className="text-xs text-ink-muted mt-1">com matrícula ativa e sem convite ainda</div>
        </div>
        <div className="pco-card">
          <div className="text-xs uppercase tracking-wide text-ink-subtle">Ficam de fora</div>
          <div className="text-3xl font-bold text-pco-deep mt-1">{seg.total - seg.elegiveis}</div>
          <div className="text-xs text-ink-muted mt-1">detalhado abaixo, por motivo</div>
        </div>
        <div className="pco-card">
          <div className="text-xs uppercase tracking-wide text-ink-subtle">Base total</div>
          <div className="text-3xl font-bold text-pco-deep mt-1">{seg.total}</div>
          <div className="text-xs text-ink-muted mt-1">alunos cadastrados</div>
        </div>
      </div>

      <section className="pco-card">
        <h2 className="text-base font-semibold text-pco-deep flex items-center gap-2">
          <ShieldAlert size={16} strokeWidth={1.75} className="text-status-warning" />
          Quem não recebe, e por quê
        </h2>
        <p className="text-xs text-ink-muted mt-1">
          Clique num motivo para ver as pessoas. Vale conferir antes: convite errado chega como
          cobrança disfarçada de boas-vindas.
        </p>
        <ul className="mt-3 divide-y divide-surface-gray">
          {motivos.map(([motivo, n]) => (
            <li key={motivo}>
              <button
                type="button"
                onClick={() => setMotivoAberto(motivoAberto === motivo ? undefined : motivo)}
                className="w-full flex items-center justify-between gap-3 py-2.5 text-left hover:bg-surface-off px-2 rounded"
              >
                <span className="text-sm text-pco-deep">{seg.rotulos[motivo] ?? motivo}</span>
                <span className="text-sm font-semibold text-ink-muted tabular-nums">{n}</span>
              </button>
              {motivoAberto === motivo && (
                <div className="pb-3 px-2">
                  {excluidosQ.isLoading ? (
                    <div className="text-xs text-ink-subtle">carregando…</div>
                  ) : (
                    <ul className="text-xs text-ink-muted space-y-1 max-h-56 overflow-y-auto">
                      {(excluidosQ.data?.lista ?? []).map((p) => (
                        <li key={p.id} className="flex justify-between gap-3">
                          <span className="truncate">{p.nome}</span>
                          <span className="text-ink-subtle truncate">{p.email}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="pco-card space-y-4">
        <h2 className="text-base font-semibold text-pco-deep flex items-center gap-2">
          <Mail size={16} strokeWidth={1.75} className="text-pco-blue" />
          Disparo
        </h2>

        {/* Quanto o provedor deixa enviar hoje. Sem esta linha o disparo é às
            cegas: envio de e-mail é best-effort, então uma cota estourada não
            derruba nada — simplesmente ninguém recebe. */}
        {seg.cota && (
          <div
            className={`rounded-lg p-3 text-sm ${
              seg.cota.aviso || (seg.cota.restantes !== null && seg.cota.restantes < seg.elegiveis)
                ? 'bg-status-warning/10 text-status-warning'
                : 'bg-surface-off text-ink-muted'
            }`}
          >
            {seg.cota.aviso ? (
              <strong>{seg.cota.aviso}</strong>
            ) : seg.cota.restantes === null ? (
              <>Não foi possível consultar a cota do provedor ({seg.cota.provider}).</>
            ) : seg.cota.restantes < seg.elegiveis ? (
              <>
                O provedor permite mais <strong>{seg.cota.restantes}</strong> envio(s) hoje, e a
                lista tem {seg.elegiveis}. Mande o que couber e continue amanhã — quem já recebeu
                sai da fila sozinho.
              </>
            ) : (
              <>
                Provedor {seg.cota.provider}: {seg.cota.restantes} envio(s) disponíveis — suficiente
                para os {seg.elegiveis}.
              </>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 max-w-lg">
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-ink-muted">
              Link vale por (dias)
            </span>
            <input
              type="number"
              min={1}
              max={90}
              value={dias}
              onChange={(e) => setDias(Math.max(1, Number(e.target.value) || 7))}
              className="pco-input mt-1"
            />
            <span className="text-xs text-ink-subtle">
              Quem abrir o e-mail depois disso usa "Esqueci minha senha".
            </span>
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-ink-muted">Por lote</span>
            <input
              type="number"
              min={1}
              max={100}
              value={porLote}
              onChange={(e) => setPorLote(Math.min(100, Math.max(1, Number(e.target.value) || 25)))}
              className="pco-input mt-1"
            />
            <span className="text-xs text-ink-subtle">
              Lotes pequenos evitam que o provedor marque o domínio como spam.
            </span>
          </label>
        </div>

        {progresso && (
          <div className="rounded-lg bg-surface-off p-3 text-sm text-ink-muted flex items-center gap-2">
            <CheckCircle2 size={15} className="text-status-success" />
            {progresso.enviados} enviado(s) no último lote · {progresso.restantes} na fila
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-surface-gray">
          <button
            type="button"
            onClick={simular}
            disabled={ocupado || seg.elegiveis === 0}
            className="pco-btn-secondary text-xs"
          >
            <Users size={13} strokeWidth={2} />
            Simular (não envia)
          </button>
          <button
            type="button"
            onClick={enviarUmLote}
            disabled={ocupado || seg.elegiveis === 0}
            className="pco-btn-secondary text-xs"
          >
            {ocupado ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            Enviar {porLote} (leva de teste)
          </button>
          <button
            type="button"
            onClick={enviarTudo}
            disabled={ocupado || seg.elegiveis === 0}
            className="pco-btn-primary text-xs"
          >
            {enviandoTudo ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            Enviar para os {seg.elegiveis}
          </button>
        </div>
        <p className="text-xs text-ink-subtle">
          Comece pela leva de teste e confira uma caixa de entrada de verdade antes de mandar o
          resto. Ninguém recebe duas vezes: quem já foi convidado sai da lista.
        </p>
      </section>
    </div>
  );
}

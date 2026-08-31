import { useEffect, useState } from 'react';
import { Save, ShieldCheck, Tag, AlertTriangle } from 'lucide-react';
import { useMarketingTags, useUpdateMarketingTags } from '../../data/hooks';
import { useToast } from '../../components/Toast';
import { CardListSkeleton } from '../../components/LoadingSkeleton';

/**
 * Onde entram as tags de Google e Meta.
 *
 * Até 31/ago/2026 esta tela não existia — a de integrações listava o Google
 * Analytics como *inexistente*, e não como "não conectado". A medição de tráfego
 * do painel é própria, sem cookie e sem IP; isto aqui existe para anúncio pago,
 * que precisa de pixel para medir conversão.
 *
 * **Só o identificador entra.** Não há campo de "cole aqui o código": campo
 * livre de script seria XSS com aparência de recurso — conta de admin
 * comprometida executaria JavaScript em toda página, para todo visitante. Quem
 * monta o trecho é o servidor, e a política de segurança do site continua
 * proibindo script inline (o que também barra tag de HTML customizado do GTM).
 */

const CAMPOS = [
  {
    chave: 'gtmId' as const,
    rotulo: 'Google Tag Manager',
    dica: 'GTM-ABC1234 — quando preenchido, é o único carregado: o GA4 entra por dentro dele.',
    exemplo: 'GTM-ABC1234',
  },
  {
    chave: 'ga4Id' as const,
    rotulo: 'Google Analytics 4',
    dica: 'G-ABCDE12345 — use só se você NÃO usa o Gerenciador de Tags.',
    exemplo: 'G-ABCDE12345',
  },
  {
    chave: 'metaPixelId' as const,
    rotulo: 'Pixel do Meta (Facebook e Instagram)',
    dica: 'Só números. É o identificador do pixel, não o código inteiro.',
    exemplo: '1234567890123456',
  },
  {
    chave: 'googleSiteVerification' as const,
    rotulo: 'Verificação do Google Search Console',
    dica: 'O conteúdo da meta tag que o Google manda colar — não a tag inteira.',
    exemplo: 'AbCdEf...',
  },
  {
    chave: 'facebookDomainVerification' as const,
    rotulo: 'Verificação de domínio do Meta',
    dica: 'O conteúdo da meta tag do Gerenciador de Negócios.',
    exemplo: 'a1b2c3...',
  },
];

export default function AdminMarketing() {
  const q = useMarketingTags();
  const mut = useUpdateMarketingTags();
  const toast = useToast();

  const [form, setForm] = useState({
    gtmId: '',
    ga4Id: '',
    metaPixelId: '',
    googleSiteVerification: '',
    facebookDomainVerification: '',
    metaCapiToken: '',
    enviarConversaoServidor: false,
    exigirConsentimento: true,
    ativo: true,
  });

  useEffect(() => {
    const d = q.data;
    if (!d) return;
    setForm({
      gtmId: d.gtmId,
      ga4Id: d.ga4Id,
      metaPixelId: d.metaPixelId,
      googleSiteVerification: d.googleSiteVerification,
      facebookDomainVerification: d.facebookDomainVerification,
      // O token nunca volta do servidor. Campo vazio significa "manter o que
      // está guardado"; digitar algo substitui.
      metaCapiToken: '',
      enviarConversaoServidor: d.enviarConversaoServidor,
      exigirConsentimento: d.exigirConsentimento,
      ativo: d.ativo,
    });
  }, [q.data]);

  if (q.isLoading) return <CardListSkeleton />;

  const salvar = async () => {
    try {
      // Token em branco não é "apagar o token": é "não mexi nele". Mandar vazio
      // apagaria a credencial de quem só quis trocar o pixel.
      const { metaCapiToken, ...resto } = form;
      await mut.mutateAsync(metaCapiToken ? form : resto);
      toast.success('Tags salvas. Vale na próxima carga das páginas públicas.');
    } catch (e) {
      // O servidor recusa identificador fora do formato do provedor — mostrar a
      // mensagem dele é mais útil que um "erro ao salvar" genérico.
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar');
    }
  };

  const temAlgo = Boolean(form.gtmId || form.ga4Id || form.metaPixelId);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-ink-900 flex items-center gap-2">
          <Tag size={20} strokeWidth={1.75} /> Tags de marketing
        </h1>
        <p className="text-sm text-ink-500 max-w-3xl">
          Aqui entram os identificadores do Google e do Meta. A medição de tráfego do painel é
          própria, sem cookie e sem IP, e não depende de nada disto — isto existe para anúncio pago
          medir conversão.
        </p>
      </header>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 flex gap-3">
        <AlertTriangle size={18} strokeWidth={1.75} className="shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold">Só o identificador, nunca o código inteiro.</p>
          <p>
            Cole apenas o código curto que o provedor mostra (por exemplo{' '}
            <code className="font-mono">GTM-ABC1234</code>). O trecho de script é montado pelo
            servidor — é assim que uma conta de admin invadida não vira execução de JavaScript no
            site inteiro.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-ink-100 bg-white p-5 space-y-5">
        {CAMPOS.map((campo) => (
          <label key={campo.chave} className="block space-y-1.5">
            <span className="text-sm font-medium text-ink-700">{campo.rotulo}</span>
            <input
              type="text"
              value={form[campo.chave]}
              placeholder={campo.exemplo}
              onChange={(e) => setForm((f) => ({ ...f, [campo.chave]: e.target.value.trim() }))}
              className="w-full rounded-lg border border-ink-200 px-3 py-2 font-mono text-sm focus:border-pco-blue focus:outline-none focus:ring-2 focus:ring-pco-blue/20"
            />
            <span className="block text-xs text-ink-500">{campo.dica}</span>
          </label>
        ))}
      </div>

      <div className="rounded-xl border border-ink-100 bg-white p-5 space-y-4">
        <h2 className="text-sm font-semibold text-ink-900">
          Conversão pelo servidor (opcional)
        </h2>
        <p className="text-xs text-ink-500 max-w-3xl">
          O pixel do navegador perde parte das compras: bloqueador de anúncio, aba fechada durante o
          redirecionamento para o gateway, Safari cortando cookie. Como quem paga sai do site para a
          página do provedor e muitas vezes não volta, essa perda aqui é grande. Ligando isto, o
          evento de compra sai <strong>do servidor</strong>, no instante em que o pedido vira pago —
          com o id do pedido como chave, para o Meta juntar com o do navegador em vez de contar duas
          vezes.
        </p>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink-700">
            Token da API de Conversões do Meta
          </span>
          <input
            type="password"
            value={form.metaCapiToken}
            placeholder={q.data?.temCapiToken ? '•••••• (guardado — digite para substituir)' : 'cole o token aqui'}
            onChange={(e) => setForm((f) => ({ ...f, metaCapiToken: e.target.value.trim() }))}
            className="w-full rounded-lg border border-ink-200 px-3 py-2 font-mono text-sm focus:border-pco-blue focus:outline-none focus:ring-2 focus:ring-pco-blue/20"
          />
          <span className="block text-xs text-ink-500">
            Este é o único campo desta tela que é credencial de verdade: fica cifrado em repouso,
            como as chaves de gateway, e nunca volta para cá. Deixar em branco mantém o que já está
            guardado.
          </span>
        </label>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={form.enviarConversaoServidor}
            onChange={(e) => setForm((f) => ({ ...f, enviarConversaoServidor: e.target.checked }))}
            className="mt-1"
          />
          <span>
            <span className="font-medium text-ink-800">Enviar a compra pelo servidor</span>
            <span className="block text-xs text-ink-500">
              Nasce desligado de propósito: mandar dado de comprador para um terceiro — mesmo em
              hash irreversível de e-mail, nome e telefone — é decisão sua, não padrão de fábrica.
              Sem pixel e sem token, ligar não faz nada.
            </span>
          </span>
        </label>
      </div>

      <div className="rounded-xl border border-ink-100 bg-white p-5 space-y-4">
        <h2 className="text-sm font-semibold text-ink-900 flex items-center gap-2">
          <ShieldCheck size={16} strokeWidth={1.75} /> Consentimento e interruptor
        </h2>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={form.exigirConsentimento}
            onChange={(e) => setForm((f) => ({ ...f, exigirConsentimento: e.target.checked }))}
            className="mt-1"
          />
          <span>
            <span className="font-medium text-ink-800">Pedir consentimento antes de carregar</span>
            <span className="block text-xs text-ink-500">
              Recomendado. Nada de terceiro sobe antes do visitante aceitar, e o aviso de cookies só
              aparece quando há tag esperando aceite. Desligar isto carrega as tags para todo mundo
              — decisão sua, e ela conversa com a LGPD e com o que a sua política de privacidade
              promete.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={form.ativo}
            onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
            className="mt-1"
          />
          <span>
            <span className="font-medium text-ink-800">Tags ligadas</span>
            <span className="block text-xs text-ink-500">
              Desligar suspende tudo sem apagar o que está cadastrado — útil para conferir se algum
              problema no site vem daqui.
            </span>
          </span>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={salvar}
          disabled={mut.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-pco-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Save size={16} strokeWidth={1.75} /> {mut.isPending ? 'Salvando…' : 'Salvar'}
        </button>
        {!temAlgo && (
          <span className="text-xs text-ink-500">
            Sem nenhum identificador, o site não carrega nada de terceiro — e a política de
            segurança continua fechada.
          </span>
        )}
      </div>
    </div>
  );
}

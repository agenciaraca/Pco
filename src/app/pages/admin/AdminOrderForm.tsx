import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ShoppingBag, Save, Info } from 'lucide-react';
import {
  useAllOrders,
  useAdminProducts,
  useCourses,
  useCreateOrder,
  useUpdateOrder,
} from '../../data/hooks';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import EmptyState from '../../components/EmptyState';
import { useToast } from '../../components/Toast';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import type { AtribuicaoDto, OrderStatus } from '../../data/api';

/**
 * Cadastro de pedido em tela cheia — criar e editar.
 *
 * Era um modal com seis campos, e um pedido tem bem mais que seis: produto do
 * catálogo, curso vinculado, moeda, data do pagamento e as doze chaves de
 * atribuição. Num popup, "todos os detalhes" não cabe sem virar rolagem dentro
 * de rolagem, então o cadastro ganhou endereço próprio — que também dá link
 * para mandar a alguém e sobrevive a um F5 no meio do preenchimento.
 *
 * Campos de gateway continuam de fora de propósito: `externalId`, `checkoutUrl`
 * e `qrCode` são escritos pela resposta do provedor, e deixá-los editáveis
 * criaria pedido apontando para cobrança que não existe. Aqui eles aparecem
 * como leitura, na ficha do rodapé.
 */
export default function AdminOrderForm() {
  const { id } = useParams<{ id: string }>();
  const editando = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();

  useDocumentMeta({ title: editando ? 'Editar pedido — Admin' : 'Novo pedido — Admin' });

  // A lista já está em cache quando se chega pela tela de pedidos; quando se
  // chega por link direto, esta é a única busca da página.
  const { data: pedidos, isLoading } = useAllOrders();
  const pedido = useMemo(
    () => (editando ? (pedidos ?? []).find((o) => o.id === id) : undefined),
    [pedidos, id, editando],
  );

  const { data: produtos } = useAdminProducts();
  const { data: cursos } = useCourses();
  const criarMut = useCreateOrder();
  const editarMut = useUpdateOrder();
  const salvando = criarMut.isPending || editarMut.isPending;

  // ---- estado do formulário ----
  const [productId, setProductId] = useState('');
  const [email, setEmail] = useState('');
  const [produto, setProduto] = useState('');
  const [refId, setRefId] = useState('');
  const [valor, setValor] = useState('0,00');
  const [moeda, setMoeda] = useState('BRL');
  const [status, setStatus] = useState<OrderStatus>('pending');
  const [pagoEm, setPagoEm] = useState('');
  const [nota, setNota] = useState('');
  const [atrib, setAtrib] = useState<Record<string, string>>({});
  const [tentouSalvar, setTentouSalvar] = useState(false);

  // Preenche a partir do pedido assim que ele chega do cache/rede. Sem isto, o
  // formulário de edição abriria vazio e um "Salvar" apressado apagaria dados.
  useEffect(() => {
    if (!pedido) return;
    setEmail(pedido.userEmail);
    setProduto(pedido.productSnapshot.name);
    setRefId(pedido.productSnapshot.refId ?? '');
    setValor((pedido.amountCents / 100).toFixed(2).replace('.', ','));
    setMoeda(pedido.currency);
    setStatus(pedido.status);
    setPagoEm(paraCampoLocal(pedido.paidAt));
    const a = pedido.attribution ?? {};
    setAtrib(Object.fromEntries(Object.entries(a).filter(([, v]) => v != null)) as Record<string, string>);
  }, [pedido]);

  function escolherProduto(pid: string) {
    setProductId(pid);
    const p = (produtos ?? []).find((x) => x.id === pid);
    if (!p) return;
    // Escolher do catálogo preenche, não tranca: venda com desconto combinado
    // é caso comum, e o valor precisa continuar editável.
    setProduto(p.name);
    setValor((p.priceCents / 100).toFixed(2).replace('.', ','));
    setMoeda(p.currency);
    if (p.refId) setRefId(p.refId);
  }

  const centavos = Math.round(Number(valor.replace(/\./g, '').replace(',', '.')) * 100);
  const erros: string[] = [];
  if (!email.includes('@')) erros.push('E-mail do aluno inválido.');
  if (produto.trim().length < 2) erros.push('Descreva o produto (mínimo 2 caracteres).');
  if (!Number.isFinite(centavos) || centavos < 0) erros.push('Valor inválido.');
  if (moeda.trim().length !== 3) erros.push('A moeda tem três letras (BRL, USD…).');
  const valido = erros.length === 0;

  function montaAtribuicao(): AtribuicaoDto | null {
    const limpo = Object.fromEntries(
      Object.entries(atrib)
        .map(([k, v]) => [k, (v ?? '').trim()])
        .filter(([, v]) => v !== ''),
    );
    // Vazio vira null, não objeto vazio: a coluna precisa poder dizer "não sei"
    // em vez de "medi e não veio de lugar nenhum".
    return Object.keys(limpo).length ? (limpo as AtribuicaoDto) : null;
  }

  async function salvar() {
    setTentouSalvar(true);
    if (!valido) {
      toast.error('Confira o formulário', erros[0]);
      return;
    }
    try {
      if (editando && pedido) {
        await editarMut.mutateAsync({
          id: pedido.id,
          input: {
            userEmail: email.trim(),
            productName: produto.trim(),
            refId: refId.trim() || null,
            amountCents: centavos,
            currency: moeda.trim().toUpperCase(),
            status,
            attribution: montaAtribuicao(),
            paidAt: pagoEm ? new Date(pagoEm).toISOString() : null,
            nota: nota.trim() || undefined,
          },
        });
        toast.success('Pedido salvo');
      } else {
        await criarMut.mutateAsync({
          userEmail: email.trim(),
          productId: productId || undefined,
          productName: produto.trim(),
          refId: refId.trim() || null,
          amountCents: centavos,
          currency: moeda.trim().toUpperCase(),
          status,
          attribution: montaAtribuicao(),
          nota: nota.trim() || undefined,
        });
        toast.success('Pedido criado');
      }
      navigate('/admin/pedidos');
    } catch (err) {
      toast.error('Falha ao salvar', err instanceof Error ? err.message : 'Erro');
    }
  }

  if (editando && isLoading) return <CardListSkeleton count={2} />;
  if (editando && !pedido) {
    return (
      <EmptyState
        icon={<ShoppingBag size={20} />}
        title="Pedido não encontrado"
        description="Ele pode ter sido excluído. Volte à lista para conferir."
        action={
          <Link to="/admin/pedidos" className="pco-btn-primary text-sm">
            Voltar aos pedidos
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-5 pb-4">
      <div className="flex items-center gap-3">
        <Link to="/admin/pedidos" className="pco-btn-ghost p-2" aria-label="Voltar aos pedidos">
          <ArrowLeft size={16} />
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-pco-deep truncate">
            {editando ? `Editar pedido ${pedido!.id}` : 'Novo pedido'}
          </h1>
          <p className="text-xs text-ink-muted">
            {editando
              ? 'Alterações entram no histórico do pedido, junto de quem alterou.'
              : 'Lançamento manual: não cobra nada e não chama gateway. Registra venda feita fora do sistema.'}
          </p>
        </div>
      </div>

      {tentouSalvar && !valido && (
        <div
          className="pco-card border-status-danger/40 bg-status-danger/5 p-4 text-sm text-status-danger"
          role="alert"
        >
          <strong className="block mb-1">Corrija antes de salvar:</strong>
          <ul className="list-disc list-inside space-y-0.5">
            {erros.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <Secao titulo="Aluno" descricao="Quem comprou. O pedido fica ligado à conta com este e-mail.">
        <Campo label="E-mail do aluno" obrigatorio>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            className="pco-input w-full text-sm"
            placeholder="aluno@exemplo.com"
          />
        </Campo>
        <p className="text-xs text-ink-muted sm:col-span-2">
          Se ainda não houver conta com este e-mail, o pedido é registrado mesmo assim e passa a
          valer quando a conta for criada — não se perde a venda por causa de cadastro.
        </p>
      </Secao>

      <Secao
        titulo="O que foi vendido"
        descricao="Escolher do catálogo preenche nome, valor e curso — e tudo continua editável."
      >
        {!editando && (
          <Campo label="Produto do catálogo" dica="Opcional. Deixe em branco para venda avulsa.">
            <select
              value={productId}
              onChange={(e) => escolherProduto(e.target.value)}
              className="pco-input w-full text-sm"
            >
              <option value="">— venda avulsa —</option>
              {(produtos ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {formataMoeda(p.priceCents, p.currency)}
                  {p.active ? '' : ' (inativo)'}
                </option>
              ))}
            </select>
          </Campo>
        )}
        <Campo label="Descrição do produto" obrigatorio>
          <input
            value={produto}
            onChange={(e) => setProduto(e.target.value)}
            className="pco-input w-full text-sm"
            placeholder="Formação em Psicanálise Clínica"
          />
        </Campo>
        <Campo label="Curso vinculado" dica="É o que dá acesso quando o pedido é pago.">
          <select
            value={refId}
            onChange={(e) => setRefId(e.target.value)}
            className="pco-input w-full text-sm"
          >
            <option value="">— nenhum —</option>
            {(cursos ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Valor" obrigatorio dica="Em reais, com vírgula. 0,00 registra cortesia.">
          <input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            inputMode="decimal"
            className="pco-input w-full text-sm"
          />
        </Campo>
        <Campo label="Moeda">
          <input
            value={moeda}
            onChange={(e) => setMoeda(e.target.value.toUpperCase().slice(0, 3))}
            maxLength={3}
            className="pco-input w-full text-sm uppercase"
          />
        </Campo>
      </Secao>

      <Secao
        titulo="Situação"
        descricao="Só 'Pago' matricula. Estorno e cancelamento derrubam a matrícula."
      >
        <Campo label="Status">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as OrderStatus)}
            className="pco-input w-full text-sm"
          >
            <option value="pending">Pendente</option>
            <option value="processing">Processando</option>
            <option value="paid">Pago</option>
            <option value="failed">Falhou</option>
            <option value="canceled">Cancelado</option>
            <option value="refunded">Reembolsado</option>
          </select>
        </Campo>
        {editando && (
          <Campo
            label="Pago em"
            dica="Vazio = sem data de pagamento. Importa para relatório e para o prazo de acesso."
          >
            <input
              type="datetime-local"
              value={pagoEm}
              onChange={(e) => setPagoEm(e.target.value)}
              className="pco-input w-full text-sm"
            />
          </Campo>
        )}
      </Secao>

      <Secao
        titulo="De onde veio a venda"
        descricao="Campo em branco fica em branco — não vira 'direto'. Não medir e ter vindo direto são coisas diferentes."
      >
        <Campo label="Tipo de origem" dica="Como a origem foi classificada.">
          <select
            value={atrib.tipoOrigem ?? ''}
            onChange={(e) => setAtrib((a) => ({ ...a, tipoOrigem: e.target.value }))}
            className="pco-input w-full text-sm"
          >
            <option value="">— não sei —</option>
            <option value="utm">Campanha (UTM)</option>
            <option value="organic">Busca orgânica</option>
            <option value="referral">Indicação / referrer</option>
            <option value="typein">Digitou o endereço</option>
            <option value="admin">Lançado pelo admin</option>
          </select>
        </Campo>
        {CAMPOS_ORIGEM.map((c) => (
          <Campo key={c.chave} label={c.label} dica={c.dica}>
            <input
              value={atrib[c.chave] ?? ''}
              onChange={(e) => setAtrib((a) => ({ ...a, [c.chave]: e.target.value }))}
              className="pco-input w-full text-sm"
              placeholder={c.exemplo}
            />
          </Campo>
        ))}
      </Secao>

      <Secao titulo="Nota interna" descricao="Fica no histórico do pedido, junto de quem alterou.">
        <div className="sm:col-span-2">
          <Campo label="Nota">
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value.slice(0, 400))}
              rows={3}
              className="pco-input w-full text-sm"
              placeholder="Pagamento por transferência, combinado com a coordenação."
            />
          </Campo>
        </div>
      </Secao>

      {editando && pedido && (
        <section className="pco-card p-5">
          <h2 className="text-sm font-semibold text-pco-deep mb-1">Registrado pelo sistema</h2>
          <p className="text-xs text-ink-muted mb-3 flex items-start gap-1.5">
            <Info size={12} className="mt-0.5 shrink-0" />
            Escrito pelo gateway e pelo histórico. Não se edita aqui: pedido apontando para cobrança
            inexistente é pior que pedido sem dado.
          </p>
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2 text-xs">
            <Leitura termo="ID do pedido" valor={pedido.id} />
            <Leitura termo="Gateway" valor={`${pedido.gatewayProvider} (${pedido.gatewayId})`} />
            <Leitura termo="ID externo" valor={pedido.externalId ?? '—'} />
            <Leitura termo="Criado em" valor={new Date(pedido.createdAt).toLocaleString('pt-BR')} />
            <Leitura
              termo="Atualizado em"
              valor={new Date(pedido.updatedAt).toLocaleString('pt-BR')}
            />
            <Leitura termo="Eventos" valor={`${pedido.events.length} no histórico`} />
          </dl>
        </section>
      )}

      {/* Barra sempre à vista: o formulário é longo, e botão de salvar que exige
          rolar até o fim faz a pessoa perder o trabalho por não achá-lo.
          `sticky` e não `fixed` de propósito — o menu lateral recolhe de 256px
          para 72px, e uma barra fixa com deslocamento fixo descolaria dele. */}
      <div className="sticky bottom-0 -mx-1 z-30 border-t border-surface-gray bg-white/95 backdrop-blur px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          <Link to="/admin/pedidos" className="pco-btn-ghost text-sm">
            Cancelar
          </Link>
          <button onClick={salvar} disabled={salvando} className="pco-btn-primary text-sm">
            <Save size={14} strokeWidth={2} />
            {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Criar pedido'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Os campos de origem, na ordem em que fazem sentido para quem preenche. */
const CAMPOS_ORIGEM: Array<{ chave: string; label: string; dica?: string; exemplo?: string }> = [
  { chave: 'origem', label: 'Origem', dica: 'utm_source', exemplo: 'google, facebook, instagram' },
  { chave: 'meio', label: 'Meio', dica: 'utm_medium', exemplo: 'cpc, organic, referral' },
  { chave: 'campanha', label: 'Campanha', dica: 'utm_campaign', exemplo: 'formacao-2026' },
  { chave: 'conteudo', label: 'Conteúdo', dica: 'utm_content', exemplo: 'anuncio-a' },
  { chave: 'termo', label: 'Termo', dica: 'utm_term', exemplo: 'curso de psicanálise' },
  { chave: 'idCampanha', label: 'ID da campanha', exemplo: '120210000000000' },
  { chave: 'referrer', label: 'Referrer', exemplo: 'https://…' },
  { chave: 'entrada', label: 'Página de entrada', exemplo: '/curso/formacao' },
  { chave: 'dispositivo', label: 'Dispositivo', exemplo: 'mobile, desktop' },
  { chave: 'gclid', label: 'gclid', dica: 'Clique do Google Ads' },
  { chave: 'fbclid', label: 'fbclid', dica: 'Clique do Meta' },
];

function Secao({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="pco-card p-5">
      <h2 className="text-sm font-semibold text-pco-deep">{titulo}</h2>
      {descricao && <p className="text-xs text-ink-muted mt-0.5 mb-3">{descricao}</p>}
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Campo({
  label,
  children,
  dica,
  obrigatorio,
}: {
  label: string;
  children: React.ReactNode;
  dica?: string;
  obrigatorio?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-ink-muted">
        {label}
        {obrigatorio && <span className="text-status-danger ml-0.5">*</span>}
      </span>
      {children}
      {dica && <span className="block text-xs text-ink-muted mt-0.5">{dica}</span>}
    </label>
  );
}

function Leitura({ termo, valor }: { termo: string; valor: string }) {
  return (
    <div className="flex gap-2 min-w-0">
      <dt className="text-ink-muted shrink-0">{termo}:</dt>
      <dd className="text-pco-deep truncate font-medium">{valor}</dd>
    </div>
  );
}

function formataMoeda(centavos: number, moeda: string) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: moeda });
}

/** ISO → valor de `datetime-local`, que não aceita fuso nem segundos. */
function paraCampoLocal(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}


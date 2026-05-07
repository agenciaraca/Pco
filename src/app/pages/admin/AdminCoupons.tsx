import { useMemo, useState } from 'react';
import {
  Tag,
  Plus,
  Edit3,
  Trash2,
  Power,
  Percent,
  DollarSign,
  AlertCircle,
  Download,
  Sparkles,
  Loader2,
} from 'lucide-react';
import {
  useCoupons,
  useCreateCoupon,
  useUpdateCoupon,
  useDeleteCoupon,
  useAdminProducts,
  useCreateCouponsBulk,
} from '../../data/hooks';
import { downloadCouponsCsv } from '../../data/api';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import EmptyState from '../../components/EmptyState';
import { useToast } from '../../components/Toast';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import type { BulkCouponInputDto, CouponDto, CouponInputDto } from '../../data/api';

export default function AdminCoupons() {
  useDocumentMeta({ title: 'Cupons — Admin AVA PCO' });
  const coupons = useCoupons();
  const products = useAdminProducts();
  const create = useCreateCoupon();
  const update = useUpdateCoupon();
  const del = useDeleteCoupon();
  const bulk = useCreateCouponsBulk();
  const toast = useToast();

  const [editing, setEditing] = useState<CouponDto | null>(null);
  const [creating, setCreating] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  async function handleExport() {
    try {
      await downloadCouponsCsv();
      toast.success('CSV baixado');
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-pco-deep flex items-center gap-2">
            <Tag size={20} className="text-pco-blue" strokeWidth={1.75} />
            Cupons de desconto
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Gere códigos com desconto percentual ou em valor fixo. Pode limitar
            por produto, validade ou número de usos.
          </p>
        </div>
        {!editing && !creating && !bulkOpen && (
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleExport}
              className="pco-btn-ghost text-xs"
              title="Exportar todos como CSV"
            >
              <Download size={11} strokeWidth={2} />
              Exportar CSV
            </button>
            <button
              type="button"
              onClick={() => setBulkOpen(true)}
              className="pco-btn-ghost text-xs"
            >
              <Sparkles size={11} strokeWidth={2} />
              Gerar lote
            </button>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="pco-btn-primary"
            >
              <Plus size={12} strokeWidth={2} />
              Novo cupom
            </button>
          </div>
        )}
      </header>

      {(coupons.data?.length ?? 0) > 0 && (
        <div className="grid gap-2 sm:grid-cols-4">
          <CouponStatCard
            label="Total"
            value={coupons.data?.length ?? 0}
            color="text-pco-deep"
          />
          <CouponStatCard
            label="Ativos"
            value={(coupons.data ?? []).filter((c) => c.active).length}
            color="text-status-success"
          />
          <CouponStatCard
            label="Expirados"
            value={
              (coupons.data ?? []).filter(
                (c) =>
                  c.validUntil &&
                  new Date(c.validUntil).getTime() < Date.now(),
              ).length
            }
            color="text-pco-orange"
          />
          <CouponStatCard
            label="Esgotando (< 7d)"
            value={
              (coupons.data ?? []).filter((c) => {
                if (!c.validUntil) return false;
                const exp = new Date(c.validUntil).getTime();
                const now = Date.now();
                return exp > now && exp - now < 7 * 24 * 60 * 60_000;
              }).length
            }
            color="text-status-danger"
          />
        </div>
      )}

      {bulkOpen && (
        <BulkEditor
          products={products.data ?? []}
          isPending={bulk.isPending}
          onSave={async (input) => {
            try {
              const r = await bulk.mutateAsync(input);
              toast.success(
                'Lote gerado',
                `${r.createdCount} criados, ${r.skippedCount} ignorados`,
              );
              setBulkOpen(false);
            } catch (err) {
              toast.error('Falha', err instanceof Error ? err.message : 'Erro');
            }
          }}
          onCancel={() => setBulkOpen(false)}
        />
      )}

      {coupons.isLoading ? (
        <CardListSkeleton count={3} />
      ) : (coupons.data ?? []).length === 0 && !creating ? (
        <EmptyState
          title="Nenhum cupom"
          description="Crie o primeiro cupom para liberar descontos no checkout."
          icon={<Tag size={28} className="text-pco-blue" strokeWidth={1.5} />}
        />
      ) : (
        <ul className="space-y-2">
          {(coupons.data ?? []).map((c) => {
            const expired = c.validUntil && new Date(c.validUntil) < new Date();
            const exhausted = c.maxUses !== null && c.usedCount >= c.maxUses;
            return (
              <li key={c.id} className="pco-card p-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-[260px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-sm font-mono font-bold text-pco-deep bg-pco-blue/10 px-2 py-0.5 rounded">
                        {c.code}
                      </code>
                      <span
                        className={`pco-badge text-[10px] ${
                          c.active
                            ? 'bg-status-success/10 text-status-success'
                            : 'bg-surface-gray text-ink-muted'
                        }`}
                      >
                        {c.active ? 'ativo' : 'inativo'}
                      </span>
                      {expired && (
                        <span className="pco-badge text-[10px] bg-pco-orange/10 text-pco-orange">
                          expirado
                        </span>
                      )}
                      {exhausted && (
                        <span className="pco-badge text-[10px] bg-status-danger/10 text-status-danger">
                          esgotado
                        </span>
                      )}
                    </div>
                    {c.description && (
                      <div className="text-xs text-ink-muted mt-0.5">
                        {c.description}
                      </div>
                    )}
                    <div className="text-[11px] text-ink-subtle mt-1 flex items-center gap-2 flex-wrap">
                      <span className="flex items-center gap-1">
                        {c.discount.kind === 'percent' ? (
                          <>
                            <Percent size={10} />
                            {c.discount.value}% off
                          </>
                        ) : (
                          <>
                            <DollarSign size={10} />
                            {(c.discount.value / 100).toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}{' '}
                            off
                          </>
                        )}
                      </span>
                      <span>·</span>
                      <span>
                        {c.usedCount} usos
                        {c.maxUses !== null ? ` / ${c.maxUses}` : ' (ilimitado)'}
                      </span>
                      {c.validUntil && (
                        <>
                          <span>·</span>
                          <span>
                            válido até{' '}
                            {new Date(c.validUntil).toLocaleDateString('pt-BR')}
                          </span>
                        </>
                      )}
                      {c.appliesToProductIds.length > 0 && (
                        <>
                          <span>·</span>
                          <span>{c.appliesToProductIds.length} produto(s)</span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await update.mutateAsync({
                          id: c.id,
                          input: { active: !c.active },
                        });
                        toast.success(c.active ? 'Desativado' : 'Ativado');
                      } catch (err) {
                        toast.error(
                          'Falha',
                          err instanceof Error ? err.message : 'Erro',
                        );
                      }
                    }}
                    className="pco-btn-ghost text-xs"
                    title={c.active ? 'Desativar' : 'Ativar'}
                  >
                    <Power size={11} strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(c)}
                    className="pco-btn-ghost text-xs"
                  >
                    <Edit3 size={11} strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm(`Excluir cupom ${c.code}?`)) return;
                      try {
                        await del.mutateAsync(c.id);
                        toast.success('Removido');
                      } catch (err) {
                        toast.error(
                          'Falha',
                          err instanceof Error ? err.message : 'Erro',
                        );
                      }
                    }}
                    className="pco-btn-ghost text-xs text-status-danger"
                  >
                    <Trash2 size={11} strokeWidth={2} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {(editing || creating) && (
        <CouponEditor
          editing={editing}
          products={products.data ?? []}
          onSave={async (input) => {
            try {
              if (editing) {
                await update.mutateAsync({ id: editing.id, input });
                toast.success('Atualizado');
              } else {
                await create.mutateAsync(input as CouponInputDto);
                toast.success('Criado');
              }
              setEditing(null);
              setCreating(false);
            } catch (err) {
              toast.error('Falha', err instanceof Error ? err.message : 'Erro');
            }
          }}
          onCancel={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

function CouponEditor({
  editing,
  products,
  onSave,
  onCancel,
}: {
  editing: CouponDto | null;
  products: { id: string; name: string }[];
  onSave: (input: Partial<CouponInputDto>) => void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState(editing?.code ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [kind, setKind] = useState<'percent' | 'amount'>(
    editing?.discount.kind ?? 'percent',
  );
  const [value, setValue] = useState<number>(editing?.discount.value ?? 10);
  const [maxUses, setMaxUses] = useState<number | ''>(editing?.maxUses ?? '');
  const [validFrom, setValidFrom] = useState(
    editing?.validFrom?.slice(0, 10) ?? '',
  );
  const [validUntil, setValidUntil] = useState(
    editing?.validUntil?.slice(0, 10) ?? '',
  );
  const [productIds, setProductIds] = useState<string[]>(
    editing?.appliesToProductIds ?? [],
  );
  const [active, setActive] = useState(editing?.active ?? true);

  const codeValid = useMemo(
    () => /^[A-Z0-9_-]{2,40}$/i.test(code.trim()),
    [code],
  );

  function toggleProduct(id: string) {
    setProductIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  return (
    <section className="pco-card p-4 space-y-4">
      <h3 className="text-sm font-semibold text-pco-deep flex items-center gap-2">
        <Plus size={14} strokeWidth={2} className="text-pco-blue" />
        {editing ? `Editar: ${editing.code}` : 'Novo cupom'}
      </h3>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-ink-muted">
            Código
          </span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="DESCONTO20"
            maxLength={40}
            disabled={!!editing}
            className="pco-input mt-1 text-sm font-mono w-full"
          />
          {!codeValid && code.length > 0 && (
            <span className="text-[10px] text-status-danger">
              Use letras/números/_-, 2 a 40 chars.
            </span>
          )}
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-ink-muted">
            Descrição (opcional)
          </span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Promoção fim de ano"
            className="pco-input mt-1 text-sm w-full"
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-ink-muted">
            Tipo de desconto
          </span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as 'percent' | 'amount')}
            className="pco-input mt-1 text-sm"
          >
            <option value="percent">Percentual (%)</option>
            <option value="amount">Valor fixo (R$)</option>
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-ink-muted">
            {kind === 'percent' ? 'Percentual' : 'Valor (centavos)'}
          </span>
          <input
            type="number"
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            min={0}
            max={kind === 'percent' ? 100 : undefined}
            className="pco-input mt-1 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-ink-muted">
            Limite de usos (opcional)
          </span>
          <input
            type="number"
            value={maxUses}
            onChange={(e) =>
              setMaxUses(e.target.value === '' ? '' : Number(e.target.value))
            }
            min={1}
            placeholder="ilimitado"
            className="pco-input mt-1 text-sm"
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-ink-muted">
            Válido a partir de (opcional)
          </span>
          <input
            type="date"
            value={validFrom}
            onChange={(e) => setValidFrom(e.target.value)}
            className="pco-input mt-1 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-ink-muted">
            Válido até (opcional)
          </span>
          <input
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className="pco-input mt-1 text-sm"
          />
        </label>
      </div>

      <div>
        <span className="text-[11px] uppercase tracking-wide text-ink-muted">
          Produtos aplicáveis
        </span>
        <p className="text-[11px] text-ink-subtle mb-1">
          Sem nenhum selecionado = vale para todos os produtos.
        </p>
        <div className="grid gap-1.5 sm:grid-cols-2 md:grid-cols-3 max-h-40 overflow-y-auto border border-pco-border rounded p-2">
          {products.map((p) => (
            <label
              key={p.id}
              className="flex items-center gap-2 text-xs p-1 rounded hover:bg-surface-mute cursor-pointer"
            >
              <input
                type="checkbox"
                checked={productIds.includes(p.id)}
                onChange={() => toggleProduct(p.id)}
                className="accent-pco-blue"
              />
              <span className="truncate">{p.name}</span>
            </label>
          ))}
          {products.length === 0 && (
            <span className="text-[11px] text-ink-subtle col-span-full">
              Nenhum produto cadastrado
            </span>
          )}
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs text-ink-muted">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="accent-pco-blue"
        />
        Cupom ativo
      </label>

      <div className="pco-card border-pco-blue/30 bg-pco-blue/5 p-3 flex gap-2 items-start text-[11px]">
        <AlertCircle size={12} className="text-pco-blue shrink-0 mt-0.5" />
        <div className="text-ink-muted">
          {kind === 'amount' &&
            'Lembre que o valor é em centavos: 5000 = R$ 50,00. '}
          O desconto é aplicado sobre o preço integral do produto no checkout.
        </div>
      </div>

      <div className="flex items-center gap-2 justify-end">
        <button type="button" onClick={onCancel} className="pco-btn-ghost text-xs">
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => {
            if (!codeValid) return;
            onSave({
              code: code.trim().toUpperCase(),
              description: description || undefined,
              discount: { kind, value },
              maxUses: maxUses === '' ? null : maxUses,
              validFrom: validFrom ? new Date(validFrom).toISOString() : null,
              validUntil: validUntil
                ? new Date(validUntil + 'T23:59:59').toISOString()
                : null,
              appliesToProductIds: productIds,
              active,
            });
          }}
          disabled={!codeValid}
          className="pco-btn-primary"
        >
          {editing ? 'Salvar' : 'Criar'}
        </button>
      </div>
    </section>
  );
}

function BulkEditor({
  products,
  isPending,
  onSave,
  onCancel,
}: {
  products: { id: string; name: string }[];
  isPending: boolean;
  onSave: (input: BulkCouponInputDto) => void;
  onCancel: () => void;
}) {
  const [count, setCount] = useState(10);
  const [prefix, setPrefix] = useState('');
  const [sequential, setSequential] = useState(false);
  const [randomLength, setRandomLength] = useState(8);
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<'percent' | 'amount'>('percent');
  const [value, setValue] = useState(10);
  const [maxUses, setMaxUses] = useState<number | ''>(1);
  const [validUntil, setValidUntil] = useState('');
  const [productIds, setProductIds] = useState<string[]>([]);

  function toggleProduct(id: string) {
    setProductIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  return (
    <section className="pco-card p-4 space-y-4 border-pco-blue/30">
      <h3 className="text-sm font-semibold text-pco-deep flex items-center gap-2">
        <Sparkles size={14} strokeWidth={2} className="text-pco-blue" />
        Gerar lote de cupons
      </h3>
      <p className="text-[11px] text-ink-muted">
        Cria N cupons de uma vez. Use prefix+sequencial pra códigos legíveis
        (BLACK01, BLACK02...) ou random pra anti-fraude.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-ink-muted">
            Quantidade (1-1000)
          </span>
          <input
            type="number"
            min={1}
            max={1000}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="pco-input mt-1 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-ink-muted">
            Prefixo (opcional)
          </span>
          <input
            value={prefix}
            onChange={(e) => setPrefix(e.target.value.toUpperCase())}
            placeholder="BLACK"
            maxLength={20}
            className="pco-input mt-1 text-sm font-mono"
          />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-ink-muted">
            {sequential ? 'Modo' : 'Tamanho random'}
          </span>
          {sequential ? (
            <div className="pco-input mt-1 text-sm bg-surface-mute text-ink-muted">
              Sequencial (PREFIX01...)
            </div>
          ) : (
            <input
              type="number"
              min={4}
              max={20}
              value={randomLength}
              onChange={(e) => setRandomLength(Number(e.target.value))}
              className="pco-input mt-1 text-sm"
            />
          )}
        </label>
      </div>

      <label className="flex items-center gap-2 text-xs text-ink-muted">
        <input
          type="checkbox"
          checked={sequential}
          onChange={(e) => setSequential(e.target.checked)}
          disabled={!prefix}
          className="accent-pco-blue"
        />
        Numeração sequencial (precisa de prefix)
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-ink-muted">
            Tipo
          </span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as 'percent' | 'amount')}
            className="pco-input mt-1 text-sm"
          >
            <option value="percent">Percentual</option>
            <option value="amount">Valor fixo</option>
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-ink-muted">
            {kind === 'percent' ? '%' : 'Centavos'}
          </span>
          <input
            type="number"
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            min={0}
            className="pco-input mt-1 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-ink-muted">
            Usos por cupom
          </span>
          <input
            type="number"
            value={maxUses}
            onChange={(e) =>
              setMaxUses(e.target.value === '' ? '' : Number(e.target.value))
            }
            min={1}
            placeholder="ilimitado"
            className="pco-input mt-1 text-sm"
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-ink-muted">
            Descrição (todos)
          </span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Black Friday 2025"
            className="pco-input mt-1 text-sm w-full"
          />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-ink-muted">
            Válido até (opcional)
          </span>
          <input
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className="pco-input mt-1 text-sm"
          />
        </label>
      </div>

      <div>
        <span className="text-[11px] uppercase tracking-wide text-ink-muted">
          Produtos (vazio = todos)
        </span>
        <div className="grid gap-1.5 sm:grid-cols-2 md:grid-cols-3 max-h-32 overflow-y-auto border border-pco-border rounded p-2 mt-1">
          {products.map((p) => (
            <label
              key={p.id}
              className="flex items-center gap-2 text-xs p-1 rounded hover:bg-surface-mute cursor-pointer"
            >
              <input
                type="checkbox"
                checked={productIds.includes(p.id)}
                onChange={() => toggleProduct(p.id)}
                className="accent-pco-blue"
              />
              <span className="truncate">{p.name}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 justify-end">
        <button type="button" onClick={onCancel} className="pco-btn-ghost text-xs">
          Cancelar
        </button>
        <button
          type="button"
          onClick={() =>
            onSave({
              count,
              prefix: prefix || undefined,
              sequential: sequential && !!prefix,
              randomLength,
              description: description || undefined,
              discount: { kind, value },
              maxUsesPerCoupon: maxUses === '' ? null : maxUses,
              validUntil: validUntil
                ? new Date(validUntil + 'T23:59:59').toISOString()
                : null,
              appliesToProductIds: productIds,
            })
          }
          disabled={isPending || count < 1 || count > 1000}
          className="pco-btn-primary"
        >
          {isPending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} strokeWidth={2} />}
          Gerar {count} cupons
        </button>
      </div>
    </section>
  );
}

function CouponStatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="pco-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-ink-muted">
        {label}
      </div>
      <div className={`text-2xl font-bold mt-1 tabular-nums ${color}`}>
        {value}
      </div>
    </div>
  );
}

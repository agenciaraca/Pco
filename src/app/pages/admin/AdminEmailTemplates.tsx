import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Mail,
  Save,
  RotateCcw,
  Loader2,
  Eye,
  Info,
  Copy,
} from 'lucide-react';
import {
  useTemplateOverrides,
  useSaveTemplateOverride,
  useDeleteTemplateOverride,
} from '../../data/hooks';
import { useToast } from '../../components/Toast';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import * as api from '../../data/api';
import type { EmailTemplateOverrideDto } from '../../data/api';

const TEMPLATES = [
  { name: 'password_reset', label: 'Redefinição de senha' },
  { name: 'order_paid', label: 'Pagamento confirmado' },
  { name: 'course_enrolled', label: 'Matrícula confirmada' },
  { name: 'welcome', label: 'Boas-vindas' },
] as const;

// Variáveis preenchidas pelo sistema no body de cada template.
// Hoje o body é fixo e usa esses valores automaticamente — mas o admin
// pode mencionar os mesmos rótulos no greeting/footer/subject pra
// consistência visual.
const TEMPLATE_VARS: Record<string, Array<{ key: string; desc: string }>> = {
  password_reset: [
    { key: 'userName', desc: 'Nome do destinatário' },
    { key: 'resetUrl', desc: 'Link único de redefinição (24h)' },
    { key: 'expiresInMinutes', desc: 'Validade do link em minutos' },
  ],
  order_paid: [
    { key: 'userName', desc: 'Nome do comprador' },
    { key: 'productName', desc: 'Produto/curso adquirido' },
    { key: 'amountFormatted', desc: 'Valor em BRL formatado' },
    { key: 'orderUrl', desc: 'Link pro pedido na conta do aluno' },
  ],
  course_enrolled: [
    { key: 'userName', desc: 'Nome do aluno' },
    { key: 'courseTitle', desc: 'Título do curso' },
    { key: 'courseUrl', desc: 'Link direto pro curso' },
    { key: 'expiresAt', desc: 'Data de expiração do acesso (se houver)' },
  ],
  welcome: [
    { key: 'userName', desc: 'Nome do novo aluno' },
    { key: 'loginUrl', desc: 'Link de login no AVA' },
    { key: 'tempPassword', desc: 'Senha temporária (só no welcome auto)' },
  ],
};

interface EditState {
  subject: string;
  greeting: string;
  footerNote: string;
  brandColor: string;
  logoUrl: string;
  orgName: string;
}

const EMPTY: EditState = {
  subject: '',
  greeting: '',
  footerNote: '',
  brandColor: '',
  logoUrl: '',
  orgName: '',
};

export default function AdminEmailTemplates() {
  useDocumentMeta({ title: 'Templates de e-mail — Admin' });
  const overridesQ = useTemplateOverrides();
  const saveMut = useSaveTemplateOverride();
  const deleteMut = useDeleteTemplateOverride();
  const toast = useToast();

  const [active, setActive] = useState<string>(TEMPLATES[0].name);
  const [edit, setEdit] = useState<EditState>(EMPTY);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewSubject, setPreviewSubject] = useState<string>('');
  const [previewing, setPreviewing] = useState(false);

  const overridesByName = useMemo(() => {
    const m = new Map<string, EmailTemplateOverrideDto>();
    for (const o of overridesQ.data?.overrides ?? []) m.set(o.name, o);
    return m;
  }, [overridesQ.data]);

  // Sync edit state quando troca de template
  useEffect(() => {
    const ov = overridesByName.get(active);
    setEdit({
      subject: ov?.subject ?? '',
      greeting: ov?.greeting ?? '',
      footerNote: ov?.footerNote ?? '',
      brandColor: ov?.brandColor ?? '',
      logoUrl: ov?.logoUrl ?? '',
      orgName: ov?.orgName ?? '',
    });
  }, [active, overridesByName]);

  // Live preview com debounce
  useEffect(() => {
    let cancelled = false;
    setPreviewing(true);
    const t = setTimeout(async () => {
      try {
        const r = await api.previewTemplateLive(active, edit);
        if (!cancelled) {
          setPreviewHtml(r.html);
          setPreviewSubject(r.subject);
        }
      } catch {
        if (!cancelled) {
          setPreviewHtml('<p>Erro ao gerar preview.</p>');
        }
      } finally {
        if (!cancelled) setPreviewing(false);
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [active, edit]);

  async function save() {
    try {
      await saveMut.mutateAsync({ name: active, patch: edit });
      toast.success('Override salvo');
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  async function reset() {
    if (!overridesByName.has(active)) {
      setEdit(EMPTY);
      return;
    }
    if (!confirm('Remover override e voltar pro default global?')) return;
    try {
      await deleteMut.mutateAsync(active);
      setEdit(EMPTY);
      toast.success('Override removido');
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <Link
          to="/admin/email"
          className="text-xs text-pco-blue hover:underline inline-flex items-center gap-1"
        >
          <ArrowLeft size={11} strokeWidth={2} />
          Voltar para configurações de e-mail
        </Link>
        <h1 className="text-2xl font-bold text-pco-deep flex items-center gap-2 mt-2">
          <Mail size={20} className="text-pco-blue" strokeWidth={1.75} />
          Templates de e-mail
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          Customize subject, cor primária, logo e mensagens de cada
          template. Body HTML continua controlado pelo sistema (proteção XSS).
        </p>
      </header>

      <div className="flex gap-2 flex-wrap">
        {TEMPLATES.map((t) => {
          const hasOverride = overridesByName.has(t.name);
          const isActive = active === t.name;
          return (
            <button
              key={t.name}
              type="button"
              onClick={() => setActive(t.name)}
              className={`px-4 py-2 rounded-lg text-sm border-2 transition-colors ${
                isActive
                  ? 'border-pco-blue bg-pco-blue/10 text-pco-deep font-semibold'
                  : 'border-pco-border bg-white text-ink-muted hover:border-pco-blue/40'
              }`}
            >
              {t.label}
              {hasOverride && (
                <span
                  className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-pco-orange"
                  title="Tem customização"
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="pco-card p-5 space-y-3">
          <header className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-pco-deep">
              Customização
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={reset}
                className="pco-btn-ghost text-xs"
                title="Voltar pros defaults globais"
                disabled={!overridesByName.has(active) && Object.values(edit).every((v) => !v)}
              >
                <RotateCcw size={11} strokeWidth={2} />
                Reset
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saveMut.isPending}
                className="pco-btn-primary text-xs"
              >
                <Save size={11} strokeWidth={2} />
                {saveMut.isPending ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </header>

          <label className="block">
            <span className="text-xs uppercase tracking-wide text-ink-muted">
              Subject
            </span>
            <input
              value={edit.subject}
              onChange={(e) => setEdit({ ...edit, subject: e.target.value })}
              placeholder="Default global do template"
              className="pco-input text-sm mt-1"
              maxLength={200}
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-ink-muted">
              Cor primária (#RRGGBB)
            </span>
            <input
              value={edit.brandColor}
              onChange={(e) => setEdit({ ...edit, brandColor: e.target.value })}
              placeholder="#0a2540"
              className="pco-input text-sm mt-1 font-mono"
              maxLength={7}
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-ink-muted">
              Logo URL (opcional)
            </span>
            <input
              value={edit.logoUrl}
              onChange={(e) => setEdit({ ...edit, logoUrl: e.target.value })}
              placeholder="https://..."
              className="pco-input text-sm mt-1 font-mono text-xs"
              maxLength={500}
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-ink-muted">
              Nome da organização
            </span>
            <input
              value={edit.orgName}
              onChange={(e) => setEdit({ ...edit, orgName: e.target.value })}
              placeholder="AVA PCO"
              className="pco-input text-sm mt-1"
              maxLength={120}
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-ink-muted">
              Mensagem extra no topo (greeting)
            </span>
            <textarea
              value={edit.greeting}
              onChange={(e) => setEdit({ ...edit, greeting: e.target.value })}
              rows={2}
              placeholder="Ex: Estamos muito felizes em te ter aqui!"
              className="pco-input text-sm mt-1 resize-none"
              maxLength={500}
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-ink-muted">
              Nota de rodapé (footer)
            </span>
            <textarea
              value={edit.footerNote}
              onChange={(e) =>
                setEdit({ ...edit, footerNote: e.target.value })
              }
              rows={2}
              placeholder="Ex: Em caso de dúvida, responda este e-mail."
              className="pco-input text-sm mt-1 resize-none"
              maxLength={500}
            />
          </label>
          <p className="text-xs text-ink-subtle">
            Campos vazios usam o default global do template. Cor inválida
            (não-hex) é ignorada.
          </p>

          <details className="border border-pco-border rounded-lg overflow-hidden">
            <summary className="text-xs font-semibold text-pco-deep px-3 py-2 cursor-pointer bg-surface-off hover:bg-surface-gray inline-flex items-center gap-1.5 w-full">
              <Info size={12} strokeWidth={2} />
              Variáveis disponíveis neste template
              <span className="ml-auto text-xs text-ink-subtle font-normal">
                {TEMPLATE_VARS[active]?.length ?? 0} vars
              </span>
            </summary>
            <div className="p-3 space-y-1.5">
              {(TEMPLATE_VARS[active] ?? []).map((v) => (
                <div key={v.key} className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard
                        .writeText(`{{${v.key}}}`)
                        .then(() => toast.success(`{{${v.key}}} copiado`))
                        .catch(() => {});
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-pco-blue/10 text-pco-blue font-mono text-xs hover:bg-pco-blue/20"
                    title="Copiar placeholder"
                  >
                    {`{{${v.key}}}`}
                    <Copy size={9} strokeWidth={2} />
                  </button>
                  <span className="text-ink-muted">{v.desc}</span>
                </div>
              ))}
              <p className="text-xs text-ink-subtle pt-1 border-t border-pco-border mt-2">
                Estas variáveis aparecem automaticamente no corpo do template
                (sistema). Use os mesmos termos no subject/greeting/footer pra
                manter consistência visual.
              </p>
            </div>
          </details>
        </section>

        <section className="pco-card p-0 overflow-hidden">
          <header className="flex items-center justify-between gap-2 p-3 bg-surface-off border-b border-pco-border">
            <h3 className="text-sm font-semibold text-pco-deep flex items-center gap-1.5">
              <Eye size={14} strokeWidth={2} />
              Preview ao vivo
            </h3>
            {previewing && (
              <Loader2
                size={12}
                className="animate-spin text-ink-subtle"
                strokeWidth={2}
              />
            )}
          </header>
          {previewSubject && (
            <div className="p-3 bg-surface-mute/30 border-b border-pco-border">
              <div className="text-xs uppercase tracking-wide text-ink-muted">
                Subject
              </div>
              <div className="text-sm font-medium text-pco-deep mt-0.5">
                {previewSubject}
              </div>
            </div>
          )}
          <iframe
            title="Preview do template"
            srcDoc={previewHtml}
            sandbox="allow-same-origin"
            className="w-full h-[600px] border-0"
          />
        </section>
      </div>
    </div>
  );
}

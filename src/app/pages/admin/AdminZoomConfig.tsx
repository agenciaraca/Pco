import { useState } from 'react';
import {
  Video,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Save,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { useZoomConfig, useSaveZoomConfig } from '../../data/hooks';
import { useToast } from '../../components/Toast';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { CardListSkeleton } from '../../components/LoadingSkeleton';

export default function AdminZoomConfig() {
  useDocumentMeta({ title: 'Zoom SDK — Admin' });
  const configQ = useZoomConfig();
  const saveMut = useSaveZoomConfig();
  const toast = useToast();

  const [sdkKey, setSdkKey] = useState('');
  const [sdkSecret, setSdkSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [editing, setEditing] = useState(false);

  const config = configQ.data;

  if (configQ.isLoading) return <CardListSkeleton count={1} />;

  const isConfigured = config?.configured && config?.enabled;

  async function handleSave() {
    if (!sdkKey.trim() || !sdkSecret.trim()) {
      toast.error('Preencha SDK Key e SDK Secret');
      return;
    }
    try {
      await saveMut.mutateAsync({ sdkKey: sdkKey.trim(), sdkSecret: sdkSecret.trim() });
      toast.success('Zoom SDK configurado com sucesso');
      setEditing(false);
      setSdkSecret('');
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro ao salvar');
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-pco-deep flex items-center gap-2">
          <Video size={20} className="text-pco-blue" strokeWidth={1.75} />
          Zoom SDK
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          Configure as credenciais do Zoom Meeting SDK para embed de sessoes ao vivo.
        </p>
      </header>

      <div className="pco-card p-6 max-w-xl space-y-5">
        <div className="flex items-center gap-3">
          {isConfigured ? (
            <>
              <CheckCircle2 size={20} className="text-status-success" />
              <div>
                <p className="text-sm font-semibold text-status-success">Configurado</p>
                <p className="text-xs text-ink-muted">
                  SDK Key: <code className="text-ink-strong">{config?.sdkKey}</code>
                </p>
              </div>
            </>
          ) : (
            <>
              <AlertCircle size={20} className="text-pco-orange" />
              <div>
                <p className="text-sm font-semibold text-pco-orange">Nao configurado</p>
                <p className="text-xs text-ink-muted">
                  Configure o SDK Key e Secret para habilitar embed de Zoom nas sessoes ao vivo.
                </p>
              </div>
            </>
          )}
        </div>

        {!editing && isConfigured && (
          <button
            type="button"
            onClick={() => {
              setSdkKey(config?.sdkKey ?? '');
              setSdkSecret('');
              setEditing(true);
            }}
            className="pco-btn-secondary text-xs"
          >
            Alterar credenciais
          </button>
        )}

        {(!isConfigured || editing) && (
          <div className="space-y-4 pt-2 border-t border-surface-gray">
            <div className="bg-pco-blue/5 border border-pco-blue/20 rounded-lg p-3 text-xs text-ink-muted space-y-1">
              <p className="font-medium text-pco-blue">Como obter as credenciais:</p>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>
                  Acesse o{' '}
                  <a
                    href="https://marketplace.zoom.us/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-pco-blue hover:underline inline-flex items-center gap-0.5"
                  >
                    Zoom Marketplace <ExternalLink size={10} />
                  </a>
                </li>
                <li>Crie um app do tipo <strong>Meeting SDK</strong></li>
                <li>Copie o <strong>SDK Key</strong> (Client ID) e <strong>SDK Secret</strong> (Client Secret)</li>
              </ol>
            </div>

            <label className="block">
              <span className="text-xs uppercase tracking-wide text-ink-muted">
                SDK Key (Client ID)
              </span>
              <input
                value={sdkKey}
                onChange={(e) => setSdkKey(e.target.value)}
                className="pco-input text-sm mt-1"
                placeholder="Ex: AbCdEfGhIjKlMnOpQrStUv"
                autoComplete="off"
              />
            </label>

            <label className="block">
              <span className="text-xs uppercase tracking-wide text-ink-muted">
                SDK Secret (Client Secret)
              </span>
              <div className="relative mt-1">
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={sdkSecret}
                  onChange={(e) => setSdkSecret(e.target.value)}
                  className="pco-input text-sm pr-10"
                  placeholder={isConfigured ? '••••••••  (deixe vazio para manter)' : 'Cole o SDK Secret aqui'}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted hover:text-pco-blue"
                >
                  {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </label>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleSave}
                disabled={saveMut.isPending || !sdkKey.trim() || !sdkSecret.trim()}
                className="pco-btn-primary text-xs"
              >
                {saveMut.isPending ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <Save size={11} />
                )}
                Salvar
              </button>
              {editing && (
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="pco-btn-ghost text-xs"
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="pco-card p-6 max-w-xl space-y-3">
        <h2 className="text-sm font-bold text-pco-deep">Como usar</h2>
        <ol className="text-xs text-ink-muted space-y-1.5 list-decimal list-inside">
          <li>Configure as credenciais acima</li>
          <li>
            Em <strong>Sessoes ao vivo</strong>, ao criar uma sessao, escolha{' '}
            <em>"Zoom embed"</em> como tipo de acesso
          </li>
          <li>Preencha o <strong>Meeting Number</strong> e a senha (opcional) da reuniao Zoom</li>
          <li>Os alunos vao entrar na reuniao diretamente dentro da plataforma</li>
        </ol>
        <p className="text-xs text-ink-subtle">
          Custo: gratuito. O Meeting SDK funciona com qualquer plano Zoom (Basic, Pro, Business).
        </p>
      </div>
    </div>
  );
}

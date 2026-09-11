import { useState } from 'react';
import {
  Target,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Save,
  Loader2,
  ExternalLink,
  PlayCircle,
  Zap,
} from 'lucide-react';
import {
  useGoogleAdsConfig,
  useSaveGoogleAdsConfig,
  useTestGoogleAdsConnection,
  useRunGoogleAdsCustomerMatch,
  useRunGoogleAdsOfflineConversions,
} from '../../data/hooks';
import { useToast } from '../../components/Toast';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { CardListSkeleton } from '../../components/LoadingSkeleton';
import { SemConexao, FalhaAoCarregar } from '../../components/EstadosDeConsulta';

function fmtQuando(iso: string | undefined): string {
  if (!iso) return 'nunca';
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function AdminGoogleAdsConfig() {
  useDocumentMeta({ title: 'Google Ads — Admin' });
  const configQ = useGoogleAdsConfig();
  const saveMut = useSaveGoogleAdsConfig();
  const testMut = useTestGoogleAdsConnection();
  const customerMatchMut = useRunGoogleAdsCustomerMatch();
  const offlineConvMut = useRunGoogleAdsOfflineConversions();
  const toast = useToast();

  const [developerToken, setDeveloperToken] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [loginCustomerId, setLoginCustomerId] = useState('');
  const [showSecrets, setShowSecrets] = useState(false);
  const [editing, setEditing] = useState(false);

  const config = configQ.data;

  if (configQ.fetchStatus === 'paused') return <SemConexao oQue="a conexão com o Google Ads" />;
  if (configQ.isPending) return <CardListSkeleton count={1} />;
  if (configQ.isError)
    return (
      <FalhaAoCarregar
        erro={configQ.error}
        oQue="a conexão com o Google Ads"
        aoTentarDeNovo={() => void configQ.refetch()}
      />
    );

  const isConfigured = !!(config?.hasDeveloperToken && config?.hasClientSecret && config?.hasRefreshToken);

  async function handleSave() {
    if (!developerToken.trim() || !clientId.trim() || !clientSecret.trim() || !refreshToken.trim() || !customerId.trim()) {
      toast.error('Preencha developer token, client ID, client secret, refresh token e customer ID');
      return;
    }
    try {
      await saveMut.mutateAsync({
        developerToken: developerToken.trim(),
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim(),
        refreshToken: refreshToken.trim(),
        customerId: customerId.trim(),
        loginCustomerId: loginCustomerId.trim() || undefined,
      });
      toast.success('Google Ads configurado com sucesso');
      setEditing(false);
      setDeveloperToken('');
      setClientSecret('');
      setRefreshToken('');
    } catch (err) {
      toast.error('Falha', err instanceof Error ? err.message : 'Erro ao salvar');
    }
  }

  async function handleTest() {
    try {
      const r = await testMut.mutateAsync();
      toast.success('Conexão OK', r.accountName ? `Conta: ${r.accountName}` : undefined);
    } catch (err) {
      toast.error('Falha na conexão', err instanceof Error ? err.message : 'Erro desconhecido');
    }
  }

  async function handleRunCustomerMatch() {
    try {
      const r = await customerMatchMut.mutateAsync();
      toast.success(
        'Customer Match enviado',
        `${r.uploaded} de ${r.complete} clientes completos (${r.scanned} pedidos pagos)`,
      );
    } catch (err) {
      toast.error('Falha no Customer Match', err instanceof Error ? err.message : 'Erro desconhecido');
    }
  }

  async function handleRunOfflineConversions() {
    try {
      const r = await offlineConvMut.mutateAsync();
      toast.success('Conversões offline enviadas', `${r.enviados} de ${r.candidatos} com gclid na janela de 90 dias`);
    } catch (err) {
      toast.error('Falha nas conversões offline', err instanceof Error ? err.message : 'Erro desconhecido');
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-pco-deep flex items-center gap-2">
          <Target size={20} className="text-pco-blue" strokeWidth={1.75} />
          Google Ads
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          Credenciais da conta de Google Ads da PCO. Alimentam dois envios independentes: Customer
          Match (público-alvo, mensal) e Conversões Offline (atribuição de venda, diário).
        </p>
      </header>

      <div className="pco-card p-6 max-w-2xl space-y-5">
        <div className="flex items-center gap-3">
          {isConfigured ? (
            <>
              <CheckCircle2 size={20} className="text-status-success" />
              <div>
                <p className="text-sm font-semibold text-status-success">Configurado</p>
                <p className="text-xs text-ink-muted">
                  Conta: <code className="text-ink-strong">{config?.customerId}</code>
                  {config?.loginCustomerId && (
                    <>
                      {' '}
                      · MCC: <code className="text-ink-strong">{config.loginCustomerId}</code>
                    </>
                  )}
                </p>
              </div>
            </>
          ) : (
            <>
              <AlertCircle size={20} className="text-pco-orange" />
              <div>
                <p className="text-sm font-semibold text-pco-orange">Não configurado</p>
                <p className="text-xs text-ink-muted">
                  Cole as credenciais da conta de Google Ads da PCO para habilitar os envios.
                </p>
              </div>
            </>
          )}
        </div>

        {isConfigured && config?.lastTestedAt && (
          <p className="text-xs text-ink-muted">
            Último teste: {fmtQuando(config.lastTestedAt)} —{' '}
            <span className={config.lastTestStatus === 'ok' ? 'text-status-success' : 'text-status-error'}>
              {config.lastTestStatus === 'ok' ? 'ok' : 'falhou'}
            </span>
            {config.lastTestMessage ? ` (${config.lastTestMessage})` : ''}
          </p>
        )}

        {!editing && isConfigured && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleTest}
              disabled={testMut.isPending}
              className="pco-btn-secondary text-xs"
            >
              {testMut.isPending ? <Loader2 size={11} className="animate-spin" /> : <PlayCircle size={11} />}
              Testar conexão
            </button>
            <button
              type="button"
              onClick={() => {
                setDeveloperToken('');
                setClientId(config?.clientId ?? '');
                setClientSecret('');
                setRefreshToken('');
                setCustomerId(config?.customerId ?? '');
                setLoginCustomerId(config?.loginCustomerId ?? '');
                setEditing(true);
              }}
              className="pco-btn-secondary text-xs"
            >
              Alterar credenciais
            </button>
          </div>
        )}

        {(!isConfigured || editing) && (
          <div className="space-y-4 pt-2 border-t border-surface-gray">
            <div className="bg-pco-blue/5 border border-pco-blue/20 rounded-lg p-3 text-xs text-ink-muted space-y-1">
              <p className="font-medium text-pco-blue">Como obter as credenciais:</p>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>
                  Developer Token em{' '}
                  <a
                    href="https://ads.google.com/aw/apicenter"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-pco-blue hover:underline inline-flex items-center gap-0.5"
                  >
                    Ferramentas → API Center <ExternalLink size={10} />
                  </a>
                </li>
                <li>
                  Client ID e Client Secret em um app OAuth no{' '}
                  <a
                    href="https://console.cloud.google.com/apis/credentials"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-pco-blue hover:underline inline-flex items-center gap-0.5"
                  >
                    Google Cloud Console <ExternalLink size={10} />
                  </a>
                </li>
                <li>Refresh Token: gerado uma vez pelo fluxo OAuth do próprio Client ID acima</li>
                <li>Customer ID: o número da conta de Ads (só dígitos, sem hífen)</li>
                <li>Login Customer ID: só se a conta for gerenciada por uma MCC</li>
              </ol>
            </div>

            <label className="block">
              <span className="text-xs uppercase tracking-wide text-ink-muted">Developer Token</span>
              <div className="relative mt-1">
                <input
                  type={showSecrets ? 'text' : 'password'}
                  value={developerToken}
                  onChange={(e) => setDeveloperToken(e.target.value)}
                  className="pco-input text-sm pr-10"
                  placeholder={isConfigured ? '••••••••  (deixe vazio para manter)' : 'Cole o developer token'}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowSecrets((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted hover:text-pco-blue"
                >
                  {showSecrets ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </label>

            <label className="block">
              <span className="text-xs uppercase tracking-wide text-ink-muted">Client ID</span>
              <input
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="pco-input text-sm mt-1"
                placeholder="Ex: 123456789-abc.apps.googleusercontent.com"
                autoComplete="off"
              />
            </label>

            <label className="block">
              <span className="text-xs uppercase tracking-wide text-ink-muted">Client Secret</span>
              <input
                type={showSecrets ? 'text' : 'password'}
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                className="pco-input text-sm mt-1"
                placeholder={isConfigured ? '••••••••  (deixe vazio para manter)' : 'Cole o client secret'}
                autoComplete="off"
              />
            </label>

            <label className="block">
              <span className="text-xs uppercase tracking-wide text-ink-muted">Refresh Token</span>
              <input
                type={showSecrets ? 'text' : 'password'}
                value={refreshToken}
                onChange={(e) => setRefreshToken(e.target.value)}
                className="pco-input text-sm mt-1"
                placeholder={isConfigured ? '••••••••  (deixe vazio para manter)' : 'Cole o refresh token'}
                autoComplete="off"
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-xs uppercase tracking-wide text-ink-muted">Customer ID</span>
                <input
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="pco-input text-sm mt-1"
                  placeholder="1234567890"
                  autoComplete="off"
                />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-wide text-ink-muted">
                  Login Customer ID (MCC, opcional)
                </span>
                <input
                  value={loginCustomerId}
                  onChange={(e) => setLoginCustomerId(e.target.value)}
                  className="pco-input text-sm mt-1"
                  placeholder="Deixe vazio se não houver MCC"
                  autoComplete="off"
                />
              </label>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleSave}
                disabled={saveMut.isPending}
                className="pco-btn-primary text-xs"
              >
                {saveMut.isPending ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                Salvar
              </button>
              {editing && (
                <button type="button" onClick={() => setEditing(false)} className="pco-btn-ghost text-xs">
                  Cancelar
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {isConfigured && !editing && (
        <div className="pco-card p-6 max-w-2xl space-y-5">
          <h2 className="text-sm font-bold text-pco-deep flex items-center gap-2">
            <Zap size={16} className="text-pco-blue" />
            Envios
          </h2>

          <div className="flex items-start justify-between gap-4 flex-wrap py-3 border-b border-surface-gray">
            <div>
              <p className="text-sm font-semibold text-ink-strong">Customer Match</p>
              <p className="text-xs text-ink-muted mt-0.5">
                Lista de clientes pagantes como público-alvo. Roda sozinho todo dia 1.
              </p>
              <p className="text-xs text-ink-subtle mt-1">
                Última vez: {fmtQuando(config?.lastCustomerMatchAt)}
                {typeof config?.lastCustomerMatchCount === 'number'
                  ? ` — ${config.lastCustomerMatchCount} enviados`
                  : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={handleRunCustomerMatch}
              disabled={customerMatchMut.isPending}
              className="pco-btn-secondary text-xs shrink-0"
            >
              {customerMatchMut.isPending ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <PlayCircle size={11} />
              )}
              Rodar agora
            </button>
          </div>

          <div className="flex items-start justify-between gap-4 flex-wrap py-3">
            <div>
              <p className="text-sm font-semibold text-ink-strong">Conversões Offline</p>
              <p className="text-xs text-ink-muted mt-0.5">
                Qual clique (gclid) virou venda paga. Roda sozinho todo dia.
              </p>
              <p className="text-xs text-ink-subtle mt-1">
                Última vez: {fmtQuando(config?.lastOfflineConversionsAt)}
                {typeof config?.lastOfflineConversionsCount === 'number'
                  ? ` — ${config.lastOfflineConversionsCount} enviados`
                  : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={handleRunOfflineConversions}
              disabled={offlineConvMut.isPending}
              className="pco-btn-secondary text-xs shrink-0"
            >
              {offlineConvMut.isPending ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <PlayCircle size={11} />
              )}
              Rodar agora
            </button>
          </div>
        </div>
      )}

      <div className="pco-card p-6 max-w-2xl space-y-3">
        <h2 className="text-sm font-bold text-pco-deep">Duas coisas diferentes</h2>
        <p className="text-xs text-ink-muted">
          <strong>Customer Match</strong> diz ao Google "essas pessoas já são clientes" — vira
          audiência pra excluir de campanhas de captação ou criar públicos parecidos.{' '}
          <strong>Conversões Offline</strong> diz "esse clique virou venda" — é o que faz o Ads
          otimizar lance pela venda de verdade, não por clique. Uma não substitui a outra.
        </p>
        <p className="text-xs text-ink-subtle">
          Nenhum dado sai em texto puro: e-mail, nome e telefone são hasheados (SHA-256) antes de
          sair do servidor — é o que a própria API do Customer Match exige.
        </p>
      </div>
    </div>
  );
}

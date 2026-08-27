import { useState, useEffect } from 'react';
import {
  Building2,
  Globe2,
  Plug,
  Mail,
  Lock,
  ScrollText,
  Save,
} from 'lucide-react';
import Tabs from '../../components/Tabs';
import { Link } from 'react-router-dom';
import { useSettings, useUpdateSettings, useIntegracoes } from '../../data/hooks';
import { useToast } from '../../components/Toast';
import { CardListSkeleton } from '../../components/LoadingSkeleton';

const tabs = [
  { id: 'instituicao', label: 'Instituição', icon: <Building2 size={14} strokeWidth={1.75} /> },
  { id: 'localizacao', label: 'Idioma e fuso', icon: <Globe2 size={14} strokeWidth={1.75} /> },
  { id: 'integracoes', label: 'Integrações', icon: <Plug size={14} strokeWidth={1.75} /> },
  { id: 'emails', label: 'E-mails', icon: <Mail size={14} strokeWidth={1.75} /> },
  { id: 'seguranca', label: 'Segurança', icon: <Lock size={14} strokeWidth={1.75} /> },
  {
    id: 'politicas',
    label: 'Termos e privacidade',
    icon: <ScrollText size={14} strokeWidth={1.75} />,
  },
];


export default function AdminSettings() {
  const [active, setActive] = useState('instituicao');
  const settingsQ = useSettings();
  const integracoesQ = useIntegracoes();
  const updateMut = useUpdateSettings();
  const toast = useToast();

  const [siteName, setSiteName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [helpEmail, setHelpEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [timezone, setTimezone] = useState('America/Sao_Paulo');
  const [cookiePolicy, setCookiePolicy] = useState('');
  const [termsUrl, setTermsUrl] = useState('');
  const [privacyUrl, setPrivacyUrl] = useState('');

  useEffect(() => {
    const s = settingsQ.data;
    if (!s) return;
    setSiteName(s.siteName);
    setContactEmail(s.contactEmail);
    setHelpEmail(s.helpEmail);
    setWhatsapp(s.whatsappNumber);
    setTimezone(s.timezone);
    setCookiePolicy(s.cookiePolicyText);
    setTermsUrl(s.termsUrl);
    setPrivacyUrl(s.privacyUrl);
  }, [settingsQ.data]);

  if (settingsQ.isLoading) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="pco-section-title">Configurações Gerais</h1>
        </header>
        <CardListSkeleton count={3} />
      </div>
    );
  }

  async function handleSave() {
    try {
      await updateMut.mutateAsync({
        siteName,
        contactEmail,
        helpEmail,
        whatsappNumber: whatsapp,
        timezone,
        cookiePolicyText: cookiePolicy,
        termsUrl,
        privacyUrl,
      });
      toast.success('Configurações salvas');
    } catch (err) {
      toast.error('Falha ao salvar', err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="pco-section-title">Configurações Gerais</h1>
          <p className="pco-section-subtitle mt-1">
            Dados institucionais, contato, fuso horário e políticas.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={updateMut.isPending}
          className="pco-btn-primary text-xs"
        >
          <Save size={12} strokeWidth={2} />
          {updateMut.isPending ? 'Salvando...' : 'Salvar configurações'}
        </button>
      </header>

      <Tabs items={tabs} active={active} onChange={setActive} />

      {active === 'instituicao' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="pco-card p-6 space-y-4">
            <h3 className="text-base font-semibold text-pco-deep">Dados institucionais</h3>
            <Field label="Nome do site">
              <input
                className="pco-input"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                maxLength={120}
              />
            </Field>
            <Field label="E-mail de contato">
              <input
                className="pco-input"
                type="text"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </Field>
            <Field label="E-mail de suporte">
              <input
                className="pco-input"
                type="text"
                value={helpEmail}
                onChange={(e) => setHelpEmail(e.target.value)}
              />
            </Field>
            <Field label="WhatsApp (opcional)">
              <input
                className="pco-input"
                type="text"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="+55 11 99999-0000"
              />
            </Field>
          </div>
          <div className="pco-card p-6 space-y-3">
            <h3 className="text-base font-semibold text-pco-deep">Marca e branding</h3>
            <p className="text-xs text-ink-muted">
              A customização visual da tela de login (logo, gradient, headline) é gerida em{' '}
              <a href="/admin/login-customizacao" className="text-pco-blue hover:underline">
                Customizar Login
              </a>
              .
            </p>
            <p className="text-xs text-ink-muted">
              Última atualização das configurações:{' '}
              <span className="font-mono text-pco-deep">
                {settingsQ.data?.updatedAt && settingsQ.data.updatedAt !== '1970-01-01T00:00:00.000Z'
                  ? new Date(settingsQ.data.updatedAt).toLocaleString('pt-BR')
                  : 'Nunca'}
              </span>
            </p>
          </div>
        </div>
      )}

      {active === 'localizacao' && (
        <div className="pco-card p-6 space-y-4 max-w-md">
          <h3 className="text-base font-semibold text-pco-deep">Fuso horário</h3>
          <Field label="Timezone IANA">
            <select
              className="pco-input"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            >
              <option value="America/Sao_Paulo">America/Sao_Paulo (BRT)</option>
              <option value="America/Manaus">America/Manaus</option>
              <option value="America/Belem">America/Belem</option>
              <option value="UTC">UTC</option>
            </select>
          </Field>
          <p className="text-xs text-ink-muted">
            Idioma da interface está fixado em pt-BR. Suporte a outros idiomas será incremental.
          </p>
        </div>
      )}

      {/*
        Esta aba mostrava cinco nomes com o selo "não conectado" escrito à mão
        no arquivo, e a frase "Atualmente nenhum provedor terceiro está
        conectado". Mentia nos dois sentidos: dizia isso com gateway Stripe
        ativo processando pagamento e com provedor de e-mail configurado e
        testado. E listava Google Calendar, que não existe no código.

        Agora vem de `/admin/integracoes`. Três estados, e a diferença entre os
        dois últimos importa: "disponível" é falta configurar; "não existe" é
        não há o que configurar.
      */}
      {active === 'integracoes' && (
        <div className="pco-card p-6 space-y-3">
          <h3 className="text-base font-semibold text-pco-deep">Integrações</h3>
          <p className="text-xs text-ink-muted">
            Apurado agora, a partir das configurações existentes.
          </p>
          {integracoesQ.isLoading && <p className="text-xs text-ink-subtle">Consultando…</p>}
          {integracoesQ.isError && (
            <p className="text-xs text-status-danger">
              Não foi possível apurar. A tela prefere não dizer nada a repetir um estado antigo.
            </p>
          )}
          <ul className="grid gap-2 sm:grid-cols-2">
            {(integracoesQ.data ?? []).map((i) => (
              <li
                key={i.id}
                className="flex items-start justify-between gap-3 rounded-lg bg-surface-mute/40 p-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-pco-deep">{i.nome}</div>
                  <div className="text-[10px] text-ink-subtle">{i.categoria}</div>
                  <p className="mt-1 text-[11px] leading-snug text-ink-muted">{i.detalhe}</p>
                  {i.ondeConfigurar && i.estado !== 'conectado' && (
                    <Link
                      to={i.ondeConfigurar}
                      className="mt-1 inline-block text-[11px] font-medium text-pco-blue underline"
                    >
                      Configurar
                    </Link>
                  )}
                </div>
                <span
                  className={`pco-badge shrink-0 ${
                    i.estado === 'conectado'
                      ? 'bg-status-success/10 text-status-success'
                      : i.estado === 'disponivel'
                        ? 'bg-pco-orange/10 text-pco-orange'
                        : 'bg-surface-gray text-ink-subtle'
                  }`}
                >
                  {i.estado === 'conectado'
                    ? 'conectado'
                    : i.estado === 'disponivel'
                      ? 'falta configurar'
                      : 'não existe'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {active === 'emails' && (
        <div className="pco-card p-6 space-y-4 max-w-xl">
          <h3 className="text-base font-semibold text-pco-deep">E-mails de envio</h3>
          <Field label="Remetente padrão (contato)">
            <input
              className="pco-input"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
          </Field>
          <Field label="E-mail de suporte/help">
            <input
              className="pco-input"
              value={helpEmail}
              onChange={(e) => setHelpEmail(e.target.value)}
            />
          </Field>
          <p className="text-xs text-ink-muted">
            Atualmente o sistema não envia e-mails reais — tokens de reset são exibidos no painel
            durante o fluxo de "esqueci minha senha".
          </p>
        </div>
      )}

      {active === 'seguranca' && (
        <div className="pco-card p-6 space-y-3">
          <h3 className="text-base font-semibold text-pco-deep">Segurança</h3>
          <ul className="text-sm text-ink-muted space-y-1.5">
            <li>• Senhas hash com bcrypt (cost 11)</li>
            <li>• JWT HS256, validade de 7 dias</li>
            <li>• Token version: troca de senha invalida sessões em outros dispositivos</li>
            <li>• Rate-limit em /auth/login (5/min) e /auth/forgot-password (3/5min)</li>
            <li>• Audit log persistente em /admin/auditoria</li>
            <li>• Captura de erros não tratados em /admin/erros</li>
          </ul>
          <p className="text-xs text-ink-subtle">
            2FA TOTP e SSO/OAuth ainda não foram habilitados — entrarão em sprints futuros.
          </p>
        </div>
      )}

      {active === 'politicas' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="pco-card p-6 space-y-4">
            <h3 className="text-base font-semibold text-pco-deep">URLs públicos</h3>
            <Field label="URL dos Termos de uso">
              <input
                className="pco-input"
                value={termsUrl}
                onChange={(e) => setTermsUrl(e.target.value)}
              />
            </Field>
            <Field label="URL da Política de Privacidade">
              <input
                className="pco-input"
                value={privacyUrl}
                onChange={(e) => setPrivacyUrl(e.target.value)}
              />
            </Field>
          </div>
          <div className="pco-card p-6 space-y-3">
            <h3 className="text-base font-semibold text-pco-deep">Aviso de cookies</h3>
            <textarea
              className="pco-input resize-none text-sm"
              rows={6}
              value={cookiePolicy}
              onChange={(e) => setCookiePolicy(e.target.value)}
            />
          </div>
        </div>
      )}
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

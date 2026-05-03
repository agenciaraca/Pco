import { useState } from 'react';
import {
  Building2,
  Globe2,
  Plug,
  Mail,
  Lock,
  ScrollText,
  Save,
  Check,
  X,
} from 'lucide-react';
import Tabs from '../../components/Tabs';

const tabs = [
  { id: 'instituicao', label: 'Instituição', icon: <Building2 size={14} strokeWidth={1.75} /> },
  { id: 'localizacao', label: 'Idioma e fuso', icon: <Globe2 size={14} strokeWidth={1.75} /> },
  { id: 'integracoes', label: 'Integrações', icon: <Plug size={14} strokeWidth={1.75} /> },
  { id: 'emails', label: 'E-mails', icon: <Mail size={14} strokeWidth={1.75} /> },
  { id: 'seguranca', label: 'Segurança', icon: <Lock size={14} strokeWidth={1.75} /> },
  { id: 'politicas', label: 'Termos e privacidade', icon: <ScrollText size={14} strokeWidth={1.75} /> },
];

const integrationsList = [
  { name: 'Google Analytics', category: 'Métricas', status: 'disconnected' },
  { name: 'Google Search Console', category: 'Métricas', status: 'disconnected' },
  { name: 'Google Calendar', category: 'Agenda', status: 'connected' },
  { name: 'Google Meet', category: 'Reuniões', status: 'connected' },
  { name: 'Zoom', category: 'Reuniões', status: 'disconnected' },
  { name: 'Microsoft Teams', category: 'Reuniões', status: 'disconnected' },
  { name: 'Stripe', category: 'Pagamentos externos', status: 'disconnected' },
  { name: 'Mailgun / SES', category: 'E-mail transacional', status: 'connected' },
];

export default function AdminSettings() {
  const [active, setActive] = useState('instituicao');

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="pco-section-title">Configurações Gerais</h1>
          <p className="pco-section-subtitle mt-1">
            Configurações globais do AVA: instituição, integrações, segurança e políticas.
          </p>
        </div>
        <button className="pco-btn-primary text-xs">
          <Save size={12} strokeWidth={2} />
          Salvar configurações
        </button>
      </header>

      <Tabs items={tabs} active={active} onChange={setActive} />

      {active === 'instituicao' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="pco-card space-y-4">
            <h3 className="text-base font-semibold text-pco-deep">Dados institucionais</h3>
            <Field label="Nome da escola">
              <input className="pco-input" defaultValue="PCO — Psicanálise Clínica Online" />
            </Field>
            <Field label="CNPJ">
              <input className="pco-input" defaultValue="00.000.000/0000-00" />
            </Field>
            <Field label="E-mail de contato">
              <input className="pco-input" defaultValue="contato@pco.local" />
            </Field>
            <Field label="Site oficial">
              <input className="pco-input" defaultValue="https://pco.example" />
            </Field>
          </div>

          <div className="pco-card space-y-4">
            <h3 className="text-base font-semibold text-pco-deep">Marca</h3>
            <Field label="Logo principal">
              <button className="pco-btn-secondary w-full justify-center text-xs">
                Substituir logo
              </button>
            </Field>
            <Field label="Favicon">
              <button className="pco-btn-secondary w-full justify-center text-xs">
                Substituir favicon
              </button>
            </Field>
            <p className="text-[11px] text-ink-subtle">
              A paleta PCO está aplicada automaticamente em todo o sistema. Para customizar tela
              de login, use{' '}
              <a href="/admin/login-customizacao" className="text-pco-blue hover:underline">
                Customizar Login
              </a>
              .
            </p>
          </div>
        </div>
      )}

      {active === 'localizacao' && (
        <div className="pco-card space-y-4 max-w-2xl">
          <h3 className="text-base font-semibold text-pco-deep">Idioma e fuso horário</h3>
          <Field label="Idioma padrão">
            <select className="pco-input">
              <option>Português (Brasil)</option>
              <option>Português (Portugal)</option>
              <option>Espanhol</option>
              <option>Inglês</option>
            </select>
          </Field>
          <Field label="Fuso horário">
            <select className="pco-input">
              <option>America/Sao_Paulo (UTC-03)</option>
              <option>America/Manaus (UTC-04)</option>
              <option>America/Belem (UTC-03)</option>
              <option>UTC</option>
            </select>
          </Field>
          <Field label="Formato de data">
            <select className="pco-input">
              <option>DD/MM/AAAA</option>
              <option>AAAA-MM-DD</option>
            </select>
          </Field>
          <Field label="Moeda">
            <select className="pco-input">
              <option>Real (BRL)</option>
              <option>Dólar (USD)</option>
              <option>Euro (EUR)</option>
            </select>
          </Field>
        </div>
      )}

      {active === 'integracoes' && (
        <div className="grid gap-3 md:grid-cols-2">
          {integrationsList.map((i) => (
            <div key={i.name} className="pco-card flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-surface-off grid place-items-center">
                <Plug size={16} className="text-pco-blue" strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-pco-deep">{i.name}</div>
                <div className="text-[11px] text-ink-subtle">{i.category}</div>
              </div>
              <span
                className={`pco-badge ${
                  i.status === 'connected'
                    ? 'bg-status-success/10 text-status-success'
                    : 'bg-surface-gray text-ink-muted'
                }`}
              >
                {i.status === 'connected' ? (
                  <>
                    <Check size={10} strokeWidth={2.5} />
                    Conectado
                  </>
                ) : (
                  <>
                    <X size={10} strokeWidth={2.5} />
                    Não conectado
                  </>
                )}
              </span>
              <button
                className={i.status === 'connected' ? 'pco-btn-secondary text-xs' : 'pco-btn-primary text-xs'}
              >
                {i.status === 'connected' ? 'Configurar' : 'Conectar'}
              </button>
            </div>
          ))}
        </div>
      )}

      {active === 'emails' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="pco-card space-y-4">
            <h3 className="text-base font-semibold text-pco-deep">Provedor de e-mail</h3>
            <Field label="Provedor">
              <select className="pco-input">
                <option>Mailgun</option>
                <option>Amazon SES</option>
                <option>SendGrid</option>
                <option>SMTP customizado</option>
              </select>
            </Field>
            <Field label="E-mail remetente">
              <input className="pco-input" defaultValue="ava@pco.local" />
            </Field>
            <Field label="Nome remetente">
              <input className="pco-input" defaultValue="AVA PCO" />
            </Field>
          </div>
          <div className="pco-card space-y-4">
            <h3 className="text-base font-semibold text-pco-deep">Notificações automáticas</h3>
            <Toggle label="Boas-vindas após cadastro" defaultChecked />
            <Toggle label="Confirmação de aceite dos termos" defaultChecked />
            <Toggle label="Aviso de inatividade (7 dias)" defaultChecked />
            <Toggle label="Aviso de avaliação pendente" defaultChecked />
            <Toggle label="Emissão de certificado" defaultChecked />
            <Toggle label="Resumo semanal de progresso" />
          </div>
        </div>
      )}

      {active === 'seguranca' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="pco-card space-y-4">
            <h3 className="text-base font-semibold text-pco-deep">Senhas</h3>
            <Field label="Tamanho mínimo">
              <input type="number" className="pco-input" defaultValue={8} />
            </Field>
            <Toggle label="Exigir letras maiúsculas" defaultChecked />
            <Toggle label="Exigir números" defaultChecked />
            <Toggle label="Exigir caracteres especiais" />
            <Field label="Validade (dias)">
              <input type="number" className="pco-input" defaultValue={180} />
            </Field>
          </div>
          <div className="pco-card space-y-4">
            <h3 className="text-base font-semibold text-pco-deep">Sessão e acesso</h3>
            <Field label="Expirar sessão após inatividade (min)">
              <input type="number" className="pco-input" defaultValue={60} />
            </Field>
            <Toggle label="2FA opcional para alunos" />
            <Toggle label="2FA obrigatório para admin" defaultChecked />
            <Toggle label="Bloquear após 5 tentativas falhas" defaultChecked />
          </div>
        </div>
      )}

      {active === 'politicas' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="pco-card space-y-3">
            <h3 className="text-base font-semibold text-pco-deep">Termos de Uso</h3>
            <textarea
              className="pco-input resize-none text-xs font-mono leading-relaxed"
              rows={10}
              defaultValue="O AVA PCO é o ambiente virtual de aprendizagem destinado exclusivamente ao estudo dos cursos da PCO..."
            />
            <p className="text-[11px] text-ink-subtle">
              Última atualização: 2026-04-25 — alterações exigem novo aceite dos alunos.
            </p>
          </div>
          <div className="pco-card space-y-3">
            <h3 className="text-base font-semibold text-pco-deep">Política de Privacidade</h3>
            <textarea
              className="pco-input resize-none text-xs font-mono leading-relaxed"
              rows={10}
              defaultValue="Seus dados acadêmicos são utilizados para acompanhamento da sua jornada de aprendizagem dentro do AVA, conforme detalhado nesta política..."
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

function Toggle({ label, defaultChecked }: { label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-off cursor-pointer">
      <input
        type="checkbox"
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded text-pco-blue focus:ring-pco-blue"
      />
      <span className="text-sm text-pco-deep">{label}</span>
    </label>
  );
}

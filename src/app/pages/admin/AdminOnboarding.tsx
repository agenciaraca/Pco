import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowLeft,
  Sparkles,
  LayoutDashboard,
  GraduationCap,
  Users,
  HeadphonesIcon,
  ShoppingCart,
  BarChart3,
  Settings,
  Mail,
  CheckCircle2,
  type LucideIcon,
} from 'lucide-react';
import { useOnboardingStatus, useCompleteOnboarding } from '../../data/hooks';
import { useAuth } from '../../auth/AuthContext';

interface WizardStep {
  icon: LucideIcon;
  title: string;
  description: string;
  links: Array<{ label: string; path: string; hint: string }>;
}

const WELCOME_STEP: WizardStep = {
  icon: Sparkles,
  title: 'Bem-vindo ao AVA PCO',
  description:
    'Este assistente vai apresentar as ferramentas disponíveis para o seu papel na plataforma. Em poucos passos, voce estara pronto para comecar.',
  links: [],
};

const STEPS_BY_CONTEXT: Record<string, WizardStep[]> = {
  atendente: [
    {
      icon: HeadphonesIcon,
      title: 'Suporte ao aluno',
      description: 'Gerencie tickets de suporte, responda duvidas e acompanhe a satisfacao dos alunos.',
      links: [
        { label: 'Central de suporte', path: '/admin/suporte', hint: 'Tickets abertos e historico' },
        { label: 'Buscar alunos', path: '/admin/alunos', hint: 'Encontre alunos por nome, e-mail ou status' },
      ],
    },
    {
      icon: ShoppingCart,
      title: 'Pedidos e pagamentos',
      description: 'Consulte pedidos, verifique status de pagamento e acompanhe compras dos alunos.',
      links: [
        { label: 'Pedidos', path: '/admin/pedidos', hint: 'Lista completa de pedidos' },
        { label: 'Produtos', path: '/admin/produtos', hint: 'Catalogo de cursos e bundles a venda' },
      ],
    },
    {
      icon: Mail,
      title: 'Comunicacao',
      description: 'Envie broadcasts para grupos de alunos e acompanhe as entregas de e-mail.',
      links: [
        { label: 'Broadcasts', path: '/admin/broadcasts', hint: 'Campanhas segmentadas' },
        { label: 'E-mail', path: '/admin/email', hint: 'Configuracao e logs de envio' },
      ],
    },
  ],
  coordenador: [
    {
      icon: GraduationCap,
      title: 'Gestao academica',
      description: 'Crie e edite cursos, modulos e aulas. Acompanhe o progresso dos alunos em cada curso.',
      links: [
        { label: 'Cursos', path: '/admin/cursos', hint: 'CRUD completo de cursos' },
        { label: 'Trilhas de estudo', path: '/admin/trilhas', hint: 'Sequencias guiadas de cursos' },
        { label: 'Certificados', path: '/admin/certificados', hint: 'Emissao e validacao' },
      ],
    },
    {
      icon: Users,
      title: 'Alunos e retencao',
      description: 'Monitore matriculas, identifique alunos em risco de evasao e atue com planos de retomada.',
      links: [
        { label: 'Alunos', path: '/admin/alunos', hint: 'Perfis, progresso e analytics' },
        { label: 'Evasao', path: '/admin/evasao', hint: 'Predicao e kanban de risco' },
        { label: 'Retencao', path: '/admin/retencao', hint: 'Metricas de risco consolidadas' },
      ],
    },
    {
      icon: BarChart3,
      title: 'Metricas e relatorios',
      description: 'Acompanhe KPIs da plataforma, vendas e engajamento dos alunos.',
      links: [
        { label: 'Dashboard', path: '/admin/dashboard', hint: 'Visao geral com KPIs' },
        { label: 'Metricas', path: '/admin/metricas', hint: 'Analytics detalhado' },
        { label: 'Vendas', path: '/admin/vendas', hint: 'Receita e tendencias' },
      ],
    },
  ],
  admin: [
    {
      icon: LayoutDashboard,
      title: 'Painel de controle',
      description: 'O dashboard reune receita, alunos ativos, certificados e saude da plataforma num so lugar.',
      links: [
        { label: 'Dashboard', path: '/admin/dashboard', hint: 'KPIs e visao geral' },
        { label: 'Saude', path: '/admin/saude', hint: 'Health check e alertas' },
        { label: 'Setup', path: '/admin/setup', hint: 'Checklist de configuracao' },
      ],
    },
    {
      icon: GraduationCap,
      title: 'Conteudo e cursos',
      description: 'Gerencie todo o conteudo academico: cursos, modulos, aulas, biblioteca e podcasts.',
      links: [
        { label: 'Cursos', path: '/admin/cursos', hint: 'CRUD completo' },
        { label: 'Biblioteca', path: '/admin/biblioteca', hint: 'PDFs e materiais' },
        { label: 'Podcasts', path: '/admin/podcasts', hint: 'Audio on-demand' },
      ],
    },
    {
      icon: ShoppingCart,
      title: 'Vendas e financeiro',
      description: 'Configure gateways, gerencie produtos, acompanhe pedidos e cupons.',
      links: [
        { label: 'Gateways', path: '/admin/gateways', hint: 'Provedores de pagamento' },
        { label: 'Produtos', path: '/admin/produtos', hint: 'Cursos e bundles a venda' },
        { label: 'Vendas', path: '/admin/vendas', hint: 'Revenue analytics' },
      ],
    },
    {
      icon: Settings,
      title: 'Sistema e seguranca',
      description: 'Usuarios do sistema, papeis, auditoria, logs, API tokens e backups.',
      links: [
        { label: 'Usuarios', path: '/admin/usuarios', hint: 'Staff e permissoes' },
        { label: 'Papeis', path: '/admin/papeis', hint: 'Roles customizados' },
        { label: 'Auditoria', path: '/admin/auditoria', hint: 'Log de acoes' },
      ],
    },
  ],
};

function resolveSteps(role: string, customRoleSlug: string | null): WizardStep[] {
  if (customRoleSlug && STEPS_BY_CONTEXT[customRoleSlug]) {
    return [WELCOME_STEP, ...STEPS_BY_CONTEXT[customRoleSlug]];
  }
  if (role === 'superadmin' || role === 'admin') {
    return [WELCOME_STEP, ...STEPS_BY_CONTEXT.admin];
  }
  return [WELCOME_STEP, ...STEPS_BY_CONTEXT.admin];
}

const DONE_STEP: WizardStep = {
  icon: CheckCircle2,
  title: 'Tudo pronto!',
  description: 'Voce ja conhece as principais ferramentas. Pode voltar a qualquer area pelo menu lateral. Bom trabalho!',
  links: [],
};

export default function AdminOnboarding() {
  const { user } = useAuth();
  const { data: status } = useOnboardingStatus();
  const complete = useCompleteOnboarding();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  const role = status?.role ?? user?.role ?? 'admin';
  const customSlug = status?.customRoleSlug ?? null;
  const steps = [...resolveSteps(role, customSlug), DONE_STEP];
  const current = steps[step];
  const Icon = current.icon;
  const isLast = step === steps.length - 1;

  const handleFinish = async () => {
    await complete.mutateAsync();
    navigate('/admin/dashboard');
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-pco-deep flex items-center gap-2">
          <Sparkles size={20} className="text-pco-blue" strokeWidth={1.75} />
          Onboarding
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          Conheca as ferramentas do seu papel na plataforma.
        </p>
      </header>

      <div className="pco-card p-8 max-w-2xl">
        <div className="flex items-center gap-2 mb-6">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? 'bg-pco-blue w-8' : i < step ? 'bg-pco-cyan w-3' : 'bg-surface-gray w-3'
              }`}
            />
          ))}
          <span className="ml-auto text-xs text-ink-muted">
            {step + 1} / {steps.length}
          </span>
        </div>

        <div className="flex items-start gap-4 mb-6">
          <div className="h-12 w-12 shrink-0 rounded-xl bg-gradient-to-br from-pco-blue to-pco-cyan grid place-items-center shadow-soft">
            <Icon className="text-white" size={22} strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-pco-deep">{current.title}</h2>
            <p className="mt-1 text-sm text-ink-muted leading-relaxed">{current.description}</p>
          </div>
        </div>

        {current.links.length > 0 && (
          <div className="space-y-2 mb-6">
            {current.links.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className="flex items-center justify-between p-3 rounded-lg bg-surface-off hover:bg-pco-cyan/10 transition-colors group"
              >
                <div>
                  <span className="text-sm font-medium text-pco-deep group-hover:text-pco-blue transition-colors">
                    {link.label}
                  </span>
                  <span className="block text-xs text-ink-muted">{link.hint}</span>
                </div>
                <ArrowRight size={14} className="text-ink-muted group-hover:text-pco-blue transition-colors" />
              </Link>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-surface-gray">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="pco-btn-ghost disabled:opacity-30"
          >
            <ArrowLeft size={14} strokeWidth={2} />
            Anterior
          </button>

          {isLast ? (
            <button
              onClick={handleFinish}
              disabled={complete.isPending}
              className="pco-btn-primary"
            >
              {complete.isPending ? 'Salvando...' : 'Comecar a usar'}
              <ArrowRight size={14} strokeWidth={2} />
            </button>
          ) : (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="pco-btn-primary"
            >
              Proximo
              <ArrowRight size={14} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      {!isLast && (
        <div className="text-center">
          <button
            onClick={handleFinish}
            disabled={complete.isPending}
            className="text-xs text-ink-muted hover:text-pco-blue transition-colors"
          >
            Pular onboarding
          </button>
        </div>
      )}
    </div>
  );
}

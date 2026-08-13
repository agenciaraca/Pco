import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  GraduationCap,
  Layers,
  Users,
  Award,
  BookOpen,
  Newspaper,
  Mic2,
  Bot,
  Sparkles,
  Stethoscope,
  Brain,
  Send,
  Palette,
  Settings as SettingsIcon,
  ShieldCheck,
  ScrollText,
  Bell as BellIcon,
  AlertOctagon,
  LifeBuoy,
  Database as DatabaseIcon,
  CreditCard,
  Tag as TagIcon,
  Shield as ShieldIcon,
  Trophy,
  UploadCloud,
  Mail,
  Webhook,
  Activity,
  ListChecks,
  ShoppingBag,
  Heart,
  Info,
  KeyRound,
  Cpu,
  Radio,
  Gauge,
  MessageSquare,
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import ScrollToTop from '../components/ScrollToTop';
import EnvBanner from '../components/EnvBanner';
import ImpersonationBanner from '../components/ImpersonationBanner';
import Topbar from '../components/Topbar';
import MobileNav from '../components/MobileNav';
import Footer from '../components/Footer';
import AdminSearchPalette from '../components/AdminSearchPalette';
import { useMemo } from 'react';
import { useAdminKeyboardShortcuts, ADMIN_SHORTCUTS } from '../hooks/useKeyboardShortcuts';
import { useOnboardingStatus } from '../data/hooks';
import { useT } from '../i18n';

export default function AdminLayout() {
  const t = useT();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: onboarding } = useOnboardingStatus();
  const [showShortcuts, setShowShortcuts] = useState(false);
  useAdminKeyboardShortcuts({
    onShowHelp: () => setShowShortcuts(true),
  });

  useEffect(() => {
    if (
      onboarding?.needsOnboarding &&
      !location.pathname.startsWith('/admin/onboarding')
    ) {
      navigate('/admin/onboarding', { replace: true });
    }
  }, [onboarding, location.pathname, navigate]);
  const adminGroups = useMemo(
    () => [
      {
        title: t('admin.section.panel'),
        items: [
          { to: '/admin/dashboard', label: t('admin.nav.dashboard'), icon: LayoutDashboard },
          { to: '/admin/setup', label: t('admin.nav.setup'), icon: ListChecks },
          { to: '/admin/saude', label: t('admin.nav.health'), icon: Heart },
          { to: '/admin/atividade', label: t('admin.nav.activity'), icon: Activity },
          { to: '/admin/experiments', label: 'A/B Experiments', icon: Activity },
          { to: '/admin/alertas', label: t('admin.nav.alerts'), icon: BellIcon },
        ],
      },
      {
        title: t('admin.section.academic'),
        items: [
          { to: '/admin/cursos', label: t('admin.nav.courses'), icon: GraduationCap },
          { to: '/admin/trilhas', label: t('admin.nav.studyPaths'), icon: GraduationCap },
          { to: '/admin/modulos', label: t('admin.nav.modules'), icon: Layers },
          { to: '/admin/aulas', label: t('course.lessons'), icon: Layers },
          { to: '/admin/transcricoes', label: 'Transcrições', icon: ScrollText },
          { to: '/admin/alunos', label: t('admin.nav.students'), icon: Users },
          { to: '/admin/certificados', label: t('admin.nav.certificates'), icon: Award },
          { to: '/admin/conquistas', label: t('admin.nav.achievements'), icon: Trophy },
          { to: '/admin/leaderboard', label: t('admin.nav.leaderboard'), icon: Trophy },
        ],
      },
      {
        title: t('admin.section.content'),
        items: [
          { to: '/admin/biblioteca', label: t('admin.nav.library'), icon: BookOpen },
          { to: '/admin/news', label: t('admin.nav.news'), icon: Newspaper },
          { to: '/admin/podcasts', label: t('admin.nav.podcasts'), icon: Mic2 },
          { to: '/admin/sessoes-ao-vivo', label: t('admin.nav.liveSessions'), icon: Radio },
          { to: '/admin/zoom', label: 'Zoom SDK', icon: Radio },
          { to: '/admin/analise-supervisao', label: t('admin.nav.supervision'), icon: Stethoscope },
          { to: '/admin/mentorias', label: 'Mentorias', icon: Stethoscope },
        ],
      },
      {
        title: t('admin.section.sales'),
        items: [
          { to: '/admin/pedidos', label: t('admin.nav.orders'), icon: ShoppingBag },
          { to: '/admin/produtos', label: t('admin.nav.products'), icon: TagIcon },
          { to: '/admin/cupons', label: t('admin.nav.coupons'), icon: TagIcon },
          { to: '/admin/gateways', label: t('admin.nav.gateways'), icon: CreditCard },
          { to: '/admin/vendas', label: t('admin.nav.salesAnalytics'), icon: TrendingUp },
          { to: '/admin/wishlist', label: t('admin.nav.wishlist'), icon: BellIcon },
        ],
      },
      {
        title: t('admin.section.communications'),
        items: [
          { to: '/admin/email', label: t('admin.nav.email'), icon: Mail },
          { to: '/admin/progresso-aluno', label: 'Progresso semanal (aluno)', icon: Mail },
          { to: '/admin/mensageria', label: 'WhatsApp / SMS', icon: MessageSquare },
          { to: '/admin/broadcasts', label: t('admin.nav.broadcasts'), icon: Send },
          { to: '/admin/digest', label: 'Digest diário', icon: Mail },
          { to: '/admin/notificacoes', label: t('notifications.title'), icon: BellIcon },
          { to: '/admin/webhooks', label: 'Webhooks', icon: Webhook },
          { to: '/admin/reengajamento', label: 'Reengajamento', icon: Send },
          { to: '/admin/reengajamento-auto', label: 'Reengajamento auto.', icon: Sparkles },
        ],
      },
      {
        title: 'Inteligência',
        items: [
          { to: '/admin/ias', label: 'Gestão de IAs', icon: Brain },
          { to: '/admin/tutor', label: t('tutor.title'), icon: Bot },
          { to: '/admin/tutor-chat', label: 'Tutor IA — auditoria', icon: Bot },
          { to: '/admin/plano-retomada-ia', label: 'Plano de Retomada IA', icon: Sparkles },
          { to: '/admin/evasao', label: 'Previsão de Evasão', icon: AlertTriangle },
          { to: '/admin/retencao', label: 'Retenção', icon: TrendingUp },
          { to: '/admin/metricas', label: t('admin.nav.metrics'), icon: BarChart3 },
          { to: '/admin/jobs', label: 'Jobs / workers', icon: Cpu },
        ],
      },
      {
        title: t('admin.section.system'),
        items: [
          { to: '/admin/usuarios', label: t('admin.nav.users'), icon: ShieldCheck },
          { to: '/admin/papeis', label: t('admin.nav.roles'), icon: ShieldCheck },
          { to: '/admin/sessoes', label: 'Sessões', icon: KeyRound },
          { to: '/admin/api-tokens', label: 'API tokens', icon: KeyRound },
          { to: '/admin/auditoria', label: t('admin.nav.audit'), icon: ScrollText },
          { to: '/admin/erros', label: t('admin.nav.errors'), icon: AlertOctagon },
          { to: '/admin/logs', label: 'Logs', icon: ScrollText },
          { to: '/admin/rate-limits', label: 'Rate limits', icon: Gauge },
          { to: '/admin/imports', label: t('admin.nav.imports'), icon: UploadCloud },
          { to: '/admin/backups', label: t('admin.nav.backups'), icon: DatabaseIcon },
          { to: '/admin/backup', label: 'Backup de configs', icon: DatabaseIcon },
          { to: '/admin/login-modelos', label: 'Login Customizável', icon: Palette },
          { to: '/admin/login-customizacao', label: 'Customizar Login', icon: Palette },
          { to: '/admin/configuracoes', label: t('admin.nav.settings'), icon: SettingsIcon },
          { to: '/admin/moderacao', label: 'Moderação', icon: ShieldIcon },
          { to: '/admin/lgpd-exclusoes', label: 'LGPD — Exclusões', icon: ShieldCheck },
          { to: '/admin/suporte', label: t('support.title'), icon: LifeBuoy },
          { to: '/admin/sobre', label: 'Sobre', icon: Info },
        ],
      },
    ],
    [t],
  );

  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen bg-surface-off">
      <ScrollToTop />
      <EnvBanner />
      <ImpersonationBanner />
      <div className="flex flex-1 min-w-0">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-2 focus:rounded-lg focus:bg-pco-blue focus:text-white text-xs"
      >
        Pular para o conteúdo
      </a>
      <Sidebar variant="admin" groups={adminGroups} />
      <MobileNav open={mobileOpen} onClose={() => setMobileOpen(false)} groups={adminGroups} />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar variant="admin" onMenuClick={() => setMobileOpen(true)} />
        <main
          id="main-content"
          className="flex-1 px-4 lg:px-8 py-6 lg:py-8 max-w-[1400px] w-full mx-auto"
        >
          <Outlet />
        </main>
        <Footer />
      </div>
      <AdminSearchPalette />
      </div>
      {showShortcuts && (
        <ShortcutsModal onClose={() => setShowShortcuts(false)} />
      )}
    </div>
  );
}

function ShortcutsModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center px-4"
      onClick={(e) => {
        if (e.currentTarget === e.target) onClose();
      }}
    >
      <div className="absolute inset-0 bg-pco-deep/50 backdrop-blur-sm" />
      <div className="relative pco-card w-full max-w-md max-h-[80vh] overflow-y-auto p-0">
        <div className="sticky top-0 bg-white border-b border-surface-gray px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
              Atalhos
            </div>
            <h2 className="text-lg font-bold text-pco-deep">Atalhos de teclado</h2>
          </div>
          <button
            onClick={onClose}
            className="text-ink-muted hover:text-pco-deep"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>
        <div className="p-6 space-y-1">
          <div className="flex items-center justify-between py-1.5 border-b border-surface-gray">
            <span className="text-sm text-ink-muted">Buscar global</span>
            <kbd className="px-2 py-0.5 text-[11px] font-mono bg-surface-off rounded border border-surface-gray">
              Ctrl K
            </kbd>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-surface-gray">
            <span className="text-sm text-ink-muted">Mostrar este modal</span>
            <kbd className="px-2 py-0.5 text-[11px] font-mono bg-surface-off rounded border border-surface-gray">
              ?
            </kbd>
          </div>
          <div className="text-[11px] uppercase tracking-wider text-ink-subtle mt-4 mb-1">
            Navegação rápida (sequência "g" + letra)
          </div>
          {ADMIN_SHORTCUTS.map((s) => (
            <div
              key={s.keys}
              className="flex items-center justify-between py-1.5 border-b border-surface-gray last:border-0"
            >
              <span className="text-sm text-ink-muted">{s.label}</span>
              <kbd className="px-2 py-0.5 text-[11px] font-mono bg-surface-off rounded border border-surface-gray">
                {s.keys}
              </kbd>
            </div>
          ))}
          <p className="text-[10px] text-ink-subtle mt-4">
            Atalhos não funcionam quando o foco está em um campo de texto.
          </p>
        </div>
      </div>
    </div>
  );
}

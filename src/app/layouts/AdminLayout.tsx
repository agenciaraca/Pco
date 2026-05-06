import { Outlet } from 'react-router-dom';
import { useState } from 'react';
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
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import ScrollToTop from '../components/ScrollToTop';
import EnvBanner from '../components/EnvBanner';
import Topbar from '../components/Topbar';
import MobileNav from '../components/MobileNav';
import Footer from '../components/Footer';
import AdminSearchPalette from '../components/AdminSearchPalette';

const adminGroups = [
  {
    title: 'Painel',
    items: [
      { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/admin/setup', label: 'Setup', icon: ListChecks },
      { to: '/admin/saude', label: 'Saúde do sistema', icon: Heart },
      { to: '/admin/atividade', label: 'Feed de atividade', icon: Activity },
      { to: '/admin/alertas', label: 'Centro de alertas', icon: BellIcon },
    ],
  },
  {
    title: 'Acadêmico',
    items: [
      { to: '/admin/cursos', label: 'Cursos', icon: GraduationCap },
      { to: '/admin/modulos', label: 'Módulos e Aulas', icon: Layers },
      { to: '/admin/alunos', label: 'Alunos', icon: Users },
      { to: '/admin/certificados', label: 'Certificados', icon: Award },
      { to: '/admin/conquistas', label: 'Conquistas', icon: Trophy },
      { to: '/admin/leaderboard', label: 'Leaderboard', icon: Trophy },
    ],
  },
  {
    title: 'Conteúdo',
    items: [
      { to: '/admin/biblioteca', label: 'Biblioteca PCO', icon: BookOpen },
      { to: '/admin/news', label: 'PCO News', icon: Newspaper },
      { to: '/admin/podcasts', label: 'PCO POD', icon: Mic2 },
      { to: '/admin/sessoes-ao-vivo', label: 'Sessões ao vivo', icon: Radio },
      { to: '/admin/analise-supervisao', label: 'Análise e Supervisão', icon: Stethoscope },
    ],
  },
  {
    title: 'Vendas',
    items: [
      { to: '/admin/pedidos', label: 'Pedidos', icon: ShoppingBag },
      { to: '/admin/produtos', label: 'Produtos', icon: TagIcon },
      { to: '/admin/cupons', label: 'Cupons', icon: TagIcon },
      { to: '/admin/gateways', label: 'Pagamentos', icon: CreditCard },
      { to: '/admin/vendas', label: 'Vendas (analytics)', icon: TrendingUp },
      { to: '/admin/wishlist', label: 'Wishlist', icon: BellIcon },
    ],
  },
  {
    title: 'Comunicações',
    items: [
      { to: '/admin/email', label: 'E-mail transacional', icon: Mail },
      { to: '/admin/broadcasts', label: 'Campanhas', icon: Send },
      { to: '/admin/digest', label: 'Digest diário', icon: Mail },
      { to: '/admin/notificacoes', label: 'Notificações', icon: BellIcon },
      { to: '/admin/webhooks', label: 'Webhooks', icon: Webhook },
      { to: '/admin/reengajamento', label: 'Reengajamento', icon: Send },
      { to: '/admin/reengajamento-auto', label: 'Reengajamento auto.', icon: Sparkles },
    ],
  },
  {
    title: 'Inteligência',
    items: [
      { to: '/admin/ias', label: 'Gestão de IAs', icon: Brain },
      { to: '/admin/tutor', label: 'Tutor Virtual', icon: Bot },
      { to: '/admin/tutor-chat', label: 'Tutor IA — auditoria', icon: Bot },
      { to: '/admin/plano-retomada-ia', label: 'Plano de Retomada IA', icon: Sparkles },
      { to: '/admin/evasao', label: 'Previsão de Evasão', icon: AlertTriangle },
      { to: '/admin/retencao', label: 'Retenção', icon: TrendingUp },
      { to: '/admin/metricas', label: 'Métricas & SEO', icon: BarChart3 },
      { to: '/admin/jobs', label: 'Jobs / workers', icon: Cpu },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { to: '/admin/usuarios', label: 'Usuários do Sistema', icon: ShieldCheck },
      { to: '/admin/sessoes', label: 'Sessões', icon: KeyRound },
      { to: '/admin/api-tokens', label: 'API tokens', icon: KeyRound },
      { to: '/admin/auditoria', label: 'Auditoria', icon: ScrollText },
      { to: '/admin/erros', label: 'Erros do servidor', icon: AlertOctagon },
      { to: '/admin/logs', label: 'Logs do servidor', icon: ScrollText },
      { to: '/admin/rate-limits', label: 'Rate limits', icon: Gauge },
      { to: '/admin/imports', label: 'Importar dados', icon: UploadCloud },
      { to: '/admin/backups', label: 'Backups', icon: DatabaseIcon },
      { to: '/admin/backup', label: 'Backup de configs', icon: DatabaseIcon },
      { to: '/admin/login-modelos', label: 'Login Customizável', icon: Palette },
      { to: '/admin/login-customizacao', label: 'Customizar Login', icon: Palette },
      { to: '/admin/configuracoes', label: 'Configurações Gerais', icon: SettingsIcon },
      { to: '/admin/moderacao', label: 'Moderação', icon: ShieldIcon },
      { to: '/admin/lgpd-exclusoes', label: 'LGPD — Exclusões', icon: ShieldCheck },
      { to: '/admin/suporte', label: 'Suporte', icon: LifeBuoy },
      { to: '/admin/sobre', label: 'Sobre', icon: Info },
    ],
  },
];

export default function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen bg-surface-off">
      <ScrollToTop />
      <EnvBanner />
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
    </div>
  );
}

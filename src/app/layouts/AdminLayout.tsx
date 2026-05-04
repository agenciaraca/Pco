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
  UploadCloud,
  Mail,
  Webhook,
  Activity,
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import MobileNav from '../components/MobileNav';
import Footer from '../components/Footer';

const adminGroups = [
  {
    title: 'Painel',
    items: [
      { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/admin/evasao', label: 'Previsão de Evasão', icon: AlertTriangle },
      { to: '/admin/retencao', label: 'Retenção', icon: TrendingUp },
      { to: '/admin/metricas', label: 'Métricas & SEO', icon: BarChart3 },
    ],
  },
  {
    title: 'Acadêmico',
    items: [
      { to: '/admin/cursos', label: 'Cursos', icon: GraduationCap },
      { to: '/admin/modulos', label: 'Módulos e Aulas', icon: Layers },
      { to: '/admin/alunos', label: 'Alunos', icon: Users },
      { to: '/admin/certificados', label: 'Certificados', icon: Award },
    ],
  },
  {
    title: 'Conteúdo',
    items: [
      { to: '/admin/biblioteca', label: 'Biblioteca PCO', icon: BookOpen },
      { to: '/admin/news', label: 'PCO News', icon: Newspaper },
      { to: '/admin/podcasts', label: 'PCO POD', icon: Mic2 },
      { to: '/admin/tutor', label: 'Tutor Virtual', icon: Bot },
    ],
  },
  {
    title: 'Serviços',
    items: [
      { to: '/admin/analise-supervisao', label: 'Análise e Supervisão', icon: Stethoscope },
    ],
  },
  {
    title: 'IA e Automação',
    items: [
      { to: '/admin/ias', label: 'Gestão de IAs', icon: Brain },
      { to: '/admin/plano-retomada-ia', label: 'Plano de Retomada IA', icon: Sparkles },
      { to: '/admin/reengajamento', label: 'Reengajamento', icon: Send },
      { to: '/admin/notificacoes', label: 'Notificações', icon: BellIcon },
      { to: '/admin/suporte', label: 'Suporte', icon: LifeBuoy },
    ],
  },
  {
    title: 'Configurações',
    items: [
      { to: '/admin/usuarios', label: 'Usuários do Sistema', icon: ShieldCheck },
      { to: '/admin/auditoria', label: 'Auditoria', icon: ScrollText },
      { to: '/admin/erros', label: 'Erros do servidor', icon: AlertOctagon },
      { to: '/admin/backups', label: 'Backups', icon: DatabaseIcon },
      { to: '/admin/gateways', label: 'Pagamentos', icon: CreditCard },
      { to: '/admin/produtos', label: 'Produtos', icon: CreditCard },
      { to: '/admin/pedidos', label: 'Pedidos', icon: CreditCard },
      { to: '/admin/imports', label: 'Importar dados', icon: UploadCloud },
      { to: '/admin/email', label: 'E-mail transacional', icon: Mail },
      { to: '/admin/webhooks', label: 'Webhooks', icon: Webhook },
      { to: '/admin/saude', label: 'Saúde do sistema', icon: Activity },
      { to: '/admin/reengajamento-auto', label: 'Reengajamento auto.', icon: Sparkles },
      { to: '/admin/login-modelos', label: 'Login Customizável', icon: Palette },
      { to: '/admin/login-customizacao', label: 'Customizar Login', icon: Palette },
      { to: '/admin/configuracoes', label: 'Configurações Gerais', icon: SettingsIcon },
    ],
  },
];

export default function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-surface-off">
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
    </div>
  );
}

import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import {
  Home,
  Compass,
  GraduationCap,
  Package,
  StickyNote,
  BookOpen,
  Newspaper,
  Mic2,
  Bot,
  Award,
  LifeBuoy,
  UserCircle2,
  Stethoscope,
  ShoppingBag,
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import MobileNav from '../components/MobileNav';
import StudentSearchPalette from '../components/StudentSearchPalette';
import ScrollToTop from '../components/ScrollToTop';
import EnvBanner from '../components/EnvBanner';
import ImpersonationBanner from '../components/ImpersonationBanner';
import Footer from '../components/Footer';

const studentGroups = [
  {
    title: 'Estudo',
    items: [
      { to: '/dashboard', label: 'Início', icon: Home },
      { to: '/jornada', label: 'Minha Jornada', icon: Compass },
      { to: '/cursos', label: 'Meus Cursos', icon: GraduationCap },
      { to: '/pacotes', label: 'Pacotes', icon: Package },
      { to: '/anotacoes', label: 'Minhas anotações', icon: StickyNote },
    ],
  },
  {
    title: 'Conteúdo',
    items: [
      { to: '/biblioteca', label: 'Biblioteca PCO', icon: BookOpen },
      { to: '/news', label: 'PCO News', icon: Newspaper },
      { to: '/podcasts', label: 'PCO POD', icon: Mic2 },
      { to: '/eventos', label: 'Encontros ao vivo', icon: Mic2 },
      { to: '/tutor', label: 'Tutor Virtual', icon: Bot },
      { to: '/analise-supervisao', label: 'Análise e Supervisão', icon: Stethoscope },
    ],
  },
  {
    title: 'Conta',
    items: [
      { to: '/certificados', label: 'Certificados', icon: Award },
      { to: '/pedidos', label: 'Meus Pedidos', icon: ShoppingBag },
      { to: '/suporte', label: 'Suporte', icon: LifeBuoy },
      { to: '/perfil', label: 'Meu Perfil', icon: UserCircle2 },
    ],
  },
];

export default function StudentLayout() {
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
      <Sidebar variant="student" />
      <MobileNav
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        groups={studentGroups}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar variant="student" onMenuClick={() => setMobileOpen(true)} />
        <main
          id="main-content"
          className="flex-1 px-4 lg:px-8 py-6 lg:py-8 max-w-[1400px] w-full mx-auto"
        >
          <Outlet />
        </main>
        <Footer />
      </div>
      <StudentSearchPalette />
      </div>
    </div>
  );
}

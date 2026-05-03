import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import {
  Home,
  Compass,
  GraduationCap,
  BookOpen,
  Newspaper,
  Mic2,
  Bot,
  Award,
  LifeBuoy,
  UserCircle2,
  Stethoscope,
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import MobileNav from '../components/MobileNav';

const studentGroups = [
  {
    title: 'Estudo',
    items: [
      { to: '/dashboard', label: 'Início', icon: Home },
      { to: '/jornada', label: 'Minha Jornada', icon: Compass },
      { to: '/cursos', label: 'Meus Cursos', icon: GraduationCap },
    ],
  },
  {
    title: 'Conteúdo',
    items: [
      { to: '/biblioteca', label: 'Biblioteca PCO', icon: BookOpen },
      { to: '/news', label: 'PCO News', icon: Newspaper },
      { to: '/podcasts', label: 'PCO POD', icon: Mic2 },
      { to: '/tutor', label: 'Tutor Virtual', icon: Bot },
      { to: '/analise-supervisao', label: 'Análise e Supervisão', icon: Stethoscope },
    ],
  },
  {
    title: 'Conta',
    items: [
      { to: '/certificados', label: 'Certificados', icon: Award },
      { to: '/suporte', label: 'Suporte', icon: LifeBuoy },
      { to: '/perfil', label: 'Meu Perfil', icon: UserCircle2 },
    ],
  },
];

export default function StudentLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-surface-off">
      <Sidebar variant="student" />
      <MobileNav
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        groups={studentGroups}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar variant="student" onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 px-4 lg:px-8 py-6 lg:py-8 max-w-[1400px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { Home, Compass, LogIn, ShieldCheck } from 'lucide-react';
import Logo from '../components/Logo';
import { useAuth } from '../auth/AuthContext';

export default function NotFound() {
  const { user } = useAuth();
  const isAdmin = user && (user.role === 'admin' || user.role === 'superadmin');
  return (
    <div className="min-h-screen grid place-items-center bg-surface-off px-6">
      <div className="text-center max-w-md">
        <Logo className="justify-center mb-10" />
        <div className="relative mx-auto mb-6 h-32 w-32">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-pco-blue/10 to-pco-cyan/10" />
          <div className="absolute inset-4 rounded-full bg-gradient-to-br from-pco-blue/20 to-pco-cyan/20" />
          <div className="absolute inset-0 grid place-items-center">
            <span className="text-5xl font-extrabold tracking-tight bg-gradient-to-br from-pco-blue to-pco-cyan bg-clip-text text-transparent">
              404
            </span>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-pco-deep">Página não encontrada</h1>
        <p className="mt-2 text-sm text-ink-muted">
          A rota que você acessou não existe no AVA PCO. Talvez ela tenha sido movida ou renomeada.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {!user && (
            <Link to="/login" className="pco-btn-primary">
              <LogIn size={16} strokeWidth={2} />
              Entrar
            </Link>
          )}
          {user && isAdmin && (
            <Link to="/admin/dashboard" className="pco-btn-primary">
              <ShieldCheck size={16} strokeWidth={2} />
              Painel admin
            </Link>
          )}
          {user && !isAdmin && (
            <>
              <Link to="/dashboard" className="pco-btn-primary">
                <Home size={16} strokeWidth={2} />
                Ir ao início
              </Link>
              <Link to="/jornada" className="pco-btn-secondary">
                <Compass size={16} strokeWidth={2} />
                Minha Jornada
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import Logo from '../components/Logo';

export default function Login() {
  const navigate = useNavigate();
  const [showPwd, setShowPwd] = useState(false);
  const [email, setEmail] = useState('aluno@pco.local');
  const [pwd, setPwd] = useState('demo1234');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-surface-off">
      <section className="hidden lg:flex relative overflow-hidden bg-gradient-to-br from-pco-deep via-pco-blue to-pco-cyan p-12 text-white">
        <div className="absolute inset-0 opacity-30 mix-blend-overlay">
          <div className="absolute top-12 -left-12 w-96 h-96 rounded-full bg-pco-cyan-light/40 blur-3xl" />
          <div className="absolute bottom-12 right-0 w-[28rem] h-[28rem] rounded-full bg-pco-orange/30 blur-3xl" />
        </div>
        <div className="relative flex flex-col justify-between w-full max-w-md">
          <Logo />
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur text-xs font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-pco-cyan-light animate-pulse" />
              Ambiente Virtual de Aprendizagem
            </div>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight">
              Sua formação organizada em uma experiência de aprendizagem moderna.
            </h1>
            <p className="text-base text-white/80 max-w-sm">
              Cursos, jornada de estudos, biblioteca, PCO News, PCO POD, Tutor Virtual e
              certificados em um só ambiente.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-white/70">
            <span>© AVA PCO</span>
            <span className="opacity-50">•</span>
            <Link to="/termos" className="hover:text-white">Termos</Link>
            <span className="opacity-50">•</span>
            <Link to="/landing" className="hover:text-white">Sobre o AVA</Link>
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8">
            <Logo />
          </div>
          <h2 className="text-2xl font-bold text-pco-deep">Entrar no AVA</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Bem-vindo de volta. Continue de onde parou.
          </p>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-ink-muted mb-1.5">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pco-input"
                placeholder="seu@email.com"
                required
              />
            </div>
            <div>
              <label htmlFor="pwd" className="block text-xs font-medium text-ink-muted mb-1.5">
                Senha
              </label>
              <div className="relative">
                <input
                  id="pwd"
                  type={showPwd ? 'text' : 'password'}
                  value={pwd}
                  onChange={(e) => setPwd(e.target.value)}
                  className="pco-input pr-11"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 grid place-items-center text-ink-subtle hover:text-pco-blue rounded-lg hover:bg-surface-gray"
                  aria-label="Mostrar senha"
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <label className="inline-flex items-center gap-2 text-ink-muted">
                <input type="checkbox" className="h-4 w-4 rounded text-pco-blue focus:ring-pco-blue" />
                Lembrar de mim
              </label>
              <Link to="/esqueci-senha" className="text-pco-blue hover:underline font-medium">
                Esqueci minha senha
              </Link>
            </div>

            <button type="submit" className="pco-btn-primary w-full">
              Entrar no AVA PCO
              <ArrowRight size={16} strokeWidth={2} />
            </button>
          </form>

          <div className="mt-8 text-center text-xs text-ink-muted">
            Primeiro acesso?{' '}
            <Link to="/onboarding" className="text-pco-blue hover:underline font-medium">
              Iniciar onboarding
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

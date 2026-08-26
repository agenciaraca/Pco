import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ArrowRight, Eye, EyeOff, AlertCircle } from 'lucide-react';
import Logo from '../components/Logo';
import { useAuth } from '../auth/AuthContext';
import { useLoginConfig } from '../data/hooks';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useT } from '../i18n';
import LocaleSwitcher from '../components/LocaleSwitcher';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, completeTotpLogin } = useAuth();
  const { data: cfg } = useLoginConfig();
  const t = useT();
  useDocumentMeta({
    title: `${t('auth.signIn')} — AVA PCO`,
    description: cfg?.subtitle ?? 'Acesse o ambiente virtual de aprendizagem da PCO.',
  });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  // Marcado por padrão: é o comportamento que todo mundo já tinha, e mudá-lo
  // em silêncio deslogaria a base inteira no próximo fechamento de navegador.
  const [lembrar, setLembrar] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totpTicket, setTotpTicket] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');

  useEffect(() => {
    try {
      const reason = sessionStorage.getItem('auth:expired:reason');
      if (reason === 'session-expired') {
        sessionStorage.removeItem('auth:expired:reason');
        setError('Sua sessão expirou. Faça login novamente.');
      }
    } catch {
      // ignora
    }
  }, []);

  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError('Informe um e-mail válido.');
      return;
    }
    if (!password) {
      setError('Informe a senha.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await login(cleanEmail, password, lembrar);
      if ('totpRequired' in result) {
        setTotpTicket(result.ticket);
        setSubmitting(false);
        return;
      }
      const target =
        result.role === 'admin' || result.role === 'superadmin' ? '/admin/dashboard' : from;
      navigate(target, { replace: true });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível entrar. Verifique seus dados.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleTotpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpTicket) return;
    setError(null);
    if (!totpCode.trim()) {
      setError('Digite o código do app autenticador.');
      return;
    }
    setSubmitting(true);
    try {
      const u = await completeTotpLogin(totpTicket, totpCode.trim(), lembrar);
      const target = u.role === 'admin' || u.role === 'superadmin' ? '/admin/dashboard' : from;
      navigate(target, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código inválido.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-surface-off">
      <section
        className="hidden lg:flex relative overflow-hidden p-12 text-white"
        style={{
          backgroundImage: `linear-gradient(to bottom right, ${cfg?.fromColor ?? '#063B49'}, ${cfg?.viaColor ?? '#0097B2'}, ${cfg?.toColor ?? '#0CC0DF'})`,
        }}
      >
        <div className="absolute inset-0 opacity-30 mix-blend-overlay">
          <div className="absolute top-12 -left-12 w-96 h-96 rounded-full bg-pco-cyan-light/40 blur-3xl" />
          <div className="absolute bottom-12 right-0 w-[28rem] h-[28rem] rounded-full bg-pco-orange/30 blur-3xl" />
        </div>
        <div className="relative flex flex-col justify-between w-full max-w-md">
          {cfg?.logoUrl ? (
            <img
              src={cfg.logoUrl}
              alt="Logo"
              className="h-12 w-auto object-contain self-start"
            />
          ) : (
            <Logo variant="dark" className="self-start" />
          )}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur text-xs font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-pco-cyan-light animate-pulse" />
              {cfg?.tag ?? 'Ambiente Virtual de Aprendizagem'}
            </div>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight">
              {cfg?.title ?? 'Sua formação organizada em uma experiência de aprendizagem moderna.'}
            </h1>
            <p className="text-base text-white/80 max-w-sm">
              {cfg?.subtitle ??
                'Cursos, jornada de estudos, biblioteca, PCO News, PCO POD, Tutor Virtual e certificados em um só ambiente.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-white/70">
            <span>© AVA PCO</span>
            <span className="opacity-50">•</span>
            <Link to="/termos" className="hover:text-white">
              Termos
            </Link>
            <span className="opacity-50">•</span>
            <Link to="/landing" className="hover:text-white">
              Sobre o AVA
            </Link>
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8">
            <Logo />
          </div>
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-pco-deep">
              {totpTicket ? 'Verificação em duas etapas' : t('auth.signIn')}
            </h2>
            <LocaleSwitcher variant="inline" />
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            {totpTicket
              ? 'Digite o código de 6 dígitos do seu app autenticador (ou um código de backup).'
              : `${t('auth.welcomeBack')}.`}
          </p>

          {totpTicket ? (
            <form className="mt-8 space-y-4" onSubmit={handleTotpSubmit} noValidate>
              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-status-danger/30 bg-status-danger/5 p-3 flex items-start gap-2 text-xs text-status-danger"
                >
                  <AlertCircle size={14} strokeWidth={1.75} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
              <div>
                <label
                  htmlFor="totp"
                  className="block text-xs font-medium text-ink-muted mb-1.5"
                >
                  Código de verificação
                </label>
                <input
                  id="totp"
                  name="totp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  className="pco-input text-center text-lg tracking-[0.4em]"
                  placeholder="000000"
                  required
                />
                <p className="mt-2 text-[11px] text-ink-subtle">
                  Sem o app? Use um <strong>código de backup</strong> (formato XXXX-XXXX).
                </p>
              </div>
              <button type="submit" disabled={submitting} className="pco-btn-primary w-full">
                {submitting ? 'Verificando...' : 'Verificar e entrar'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTotpTicket(null);
                  setTotpCode('');
                  setError(null);
                }}
                className="pco-btn-ghost w-full text-xs"
              >
                Voltar ao login
              </button>
            </form>
          ) : (
          <form className="mt-8 space-y-4" onSubmit={handleSubmit} noValidate>
            {error && (
              <div
                role="alert"
                className="rounded-xl border border-status-danger/30 bg-status-danger/5 p-3 flex items-start gap-2 text-xs text-status-danger"
              >
                <AlertCircle size={14} strokeWidth={1.75} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-xs font-medium text-ink-muted mb-1.5">
                {t('auth.email')}
              </label>
              <input
                id="email"
                name="email"
                type="text"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="off"
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pco-input"
                placeholder="seu@email.com"
                required
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium text-ink-muted mb-1.5"
              >
                {t('auth.password')}
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pco-input pr-11"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 grid place-items-center text-ink-subtle hover:text-pco-blue rounded-lg hover:bg-surface-gray"
                  aria-label={showPwd ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <label className="inline-flex items-center gap-2 text-ink-muted">
                {/*
                  A caixa não tinha estado nem onChange: marcada ou não, a
                  sessão ia para o localStorage e sobrevivia a fechar o
                  navegador. Quem usa computador compartilhado desmarcava e
                  continuava logado. Agora ela decide de fato onde a sessão
                  mora — ver `writeSession` no AuthContext.
                */}
                <input
                  type="checkbox"
                  checked={lembrar}
                  onChange={(e) => setLembrar(e.target.checked)}
                  className="h-4 w-4 rounded text-pco-blue focus:ring-pco-blue"
                />
                {t('auth.rememberMe')}
              </label>
              <Link to="/esqueci-senha" className="text-pco-blue hover:underline font-medium">
                {t('auth.forgotPassword')}
              </Link>
            </div>

            <button type="submit" disabled={submitting} className="pco-btn-primary w-full">
              {submitting ? `${t('auth.signIn')}...` : t('auth.signIn')}
              {!submitting && <ArrowRight size={16} strokeWidth={2} />}
            </button>
          </form>
          )}

          {!totpTicket && (
            <>
              <div className="mt-6 flex items-center gap-3 text-[11px] uppercase tracking-wider text-ink-subtle">
                <span className="flex-1 h-px bg-surface-gray" />
                ou
                <span className="flex-1 h-px bg-surface-gray" />
              </div>
              <a
                href="/api/auth/oauth/google"
                className="mt-4 inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl border border-surface-gray hover:bg-surface-gray text-sm font-medium text-pco-deep transition-colors"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Entrar com Google
              </a>
              <a
                href="/api/auth/oauth/microsoft"
                className="mt-2 inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl border border-surface-gray hover:bg-surface-gray text-sm font-medium text-pco-deep transition-colors"
              >
                <svg viewBox="0 0 23 23" className="h-4 w-4" aria-hidden="true">
                  <path fill="#F25022" d="M1 1h10v10H1z" />
                  <path fill="#7FBA00" d="M12 1h10v10H12z" />
                  <path fill="#00A4EF" d="M1 12h10v10H1z" />
                  <path fill="#FFB900" d="M12 12h10v10H12z" />
                </svg>
                Entrar com Microsoft
              </a>
            </>
          )}

          <div className="mt-6 text-center text-xs text-ink-muted">
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

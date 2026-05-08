import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { ArrowLeft, Save, Check, AlertCircle } from 'lucide-react';
import Logo from '../components/Logo';
import { resetPassword } from '../data/api';
import { useT } from '../i18n';

export default function ResetPassword() {
  const t = useT();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const tokenFromUrl = params.get('token') ?? '';
  const [token, setToken] = useState(tokenFromUrl);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ email: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!token || token.length < 10) {
      setError('Token inválido.');
      return;
    }
    if (password.length < 8) {
      setError('A nova senha precisa ter pelo menos 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('As senhas não conferem.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await resetPassword(token, password);
      setDone({ email: res.email });
      setTimeout(() => navigate('/login', { replace: true }), 2500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('INVALID_TOKEN') || msg.toLowerCase().includes('token')) {
        setError('Token inválido ou expirado. Solicite um novo link.');
      } else {
        setError('Não foi possível redefinir a senha. Tente novamente.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-surface-off px-6">
      <div className="w-full max-w-sm">
        <Logo className="justify-center mb-8" />
        <div className="pco-card p-8">
          {done ? (
            <div className="text-center">
              <div className="mx-auto h-12 w-12 rounded-2xl bg-status-success/15 grid place-items-center mb-3">
                <Check className="text-status-success" size={22} strokeWidth={2} />
              </div>
              <h1 className="text-xl font-bold text-pco-deep">{t('reset.success').split('.')[0]}</h1>
              <p className="mt-2 text-sm text-ink-muted">
                Senha redefinida para <strong className="text-pco-deep">{done.email}</strong>.
                Redirecionando para o login...
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold text-pco-deep">{t('reset.title')}</h1>
              <p className="mt-1 text-sm text-ink-muted">
                Cole o token recebido e escolha uma nova senha.
              </p>
              <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
                <div>
                  <label className="text-xs text-ink-muted">Token de redefinição</label>
                  <input
                    type="text"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="pco-input mt-1"
                    placeholder="token recebido por e-mail"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="text-xs text-ink-muted">Nova senha</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pco-input mt-1"
                    placeholder="mínimo 8 caracteres"
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label className="text-xs text-ink-muted">Confirmar senha</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="pco-input mt-1"
                    autoComplete="new-password"
                  />
                </div>
                {error && (
                  <div className="flex items-start gap-2 rounded-lg bg-status-danger/10 p-2 text-xs text-status-danger">
                    <AlertCircle size={14} strokeWidth={2} className="mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                <button type="submit" disabled={submitting} className="pco-btn-primary w-full">
                  <Save size={14} strokeWidth={2} />
                  {submitting ? 'Redefinindo...' : 'Redefinir senha'}
                </button>
              </form>
              <Link
                to="/login"
                className="mt-6 inline-flex items-center gap-2 text-xs text-pco-blue hover:underline"
              >
                <ArrowLeft size={12} strokeWidth={2} />
                Voltar ao login
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

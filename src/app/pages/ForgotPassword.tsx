import { Link } from 'react-router-dom';
import { useState } from 'react';
import { ArrowLeft, Send, Check } from 'lucide-react';
import Logo from '../components/Logo';
import { requestPasswordReset } from '../data/api';
import { useT } from '../i18n';

export default function ForgotPassword() {
  const t = useT();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const clean = email.trim();
    if (!clean.includes('@') || !clean.includes('.')) {
      setError('Informe um e-mail válido.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await requestPasswordReset(clean);
      setDevToken(res.devToken ?? null);
      setSent(true);
    } catch {
      setError('Não foi possível enviar agora. Tente novamente em instantes.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-surface-off px-6">
      <div className="w-full max-w-sm">
        <Logo className="justify-center mb-8" />
        <div className="pco-card p-8">
          {sent ? (
            <div className="text-center">
              <div className="mx-auto h-12 w-12 rounded-2xl bg-status-success/15 grid place-items-center mb-3">
                <Check className="text-status-success" size={22} strokeWidth={2} />
              </div>
              <h1 className="text-xl font-bold text-pco-deep">{t('forgot.sent').split('.')[0]}</h1>
              <p className="mt-2 text-sm text-ink-muted">
                Se <strong className="text-pco-deep">{email}</strong> existir em nossa base, um link
                de redefinição foi gerado e expira em 30 minutos.
              </p>
              {devToken && (
                <div className="mt-4 rounded-lg bg-surface-mute p-3 text-left">
                  <p className="text-[11px] uppercase tracking-wide text-ink-muted">
                    Token (modo dev)
                  </p>
                  <code className="block mt-1 break-all text-xs text-pco-deep">{devToken}</code>
                  <Link
                    to={`/redefinir-senha?token=${encodeURIComponent(devToken)}`}
                    className="mt-3 inline-flex pco-btn-primary text-xs"
                  >
                    Redefinir agora
                  </Link>
                </div>
              )}
              <Link to="/login" className="mt-6 inline-flex pco-btn-secondary text-xs">
                <ArrowLeft size={12} strokeWidth={2} />
                {t('forgot.backToLogin')}
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold text-pco-deep">{t('forgot.title')}</h1>
              <p className="mt-1 text-sm text-ink-muted">
                {t('forgot.subtitle')}
              </p>
              <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
                <div>
                  <input
                    type="text"
                    inputMode="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`pco-input ${error ? 'border-status-danger' : ''}`}
                    placeholder="seu@email.com"
                  />
                  {error && <p className="mt-1 text-xs text-status-danger">{error}</p>}
                </div>
                <button type="submit" disabled={submitting} className="pco-btn-primary w-full">
                  <Send size={14} strokeWidth={2} />
                  {submitting ? 'Enviando...' : 'Enviar link de recuperação'}
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

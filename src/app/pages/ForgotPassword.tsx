import { Link } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import Logo from '../components/Logo';

export default function ForgotPassword() {
  return (
    <div className="min-h-screen grid place-items-center bg-surface-off px-6">
      <div className="w-full max-w-sm">
        <Logo className="justify-center mb-8" />
        <div className="pco-card p-8">
          <h1 className="text-xl font-bold text-pco-deep">Recuperar acesso</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Informe seu e-mail e enviaremos um link de redefinição de senha.
          </p>
          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              alert('Link enviado (mock).');
            }}
          >
            <input type="email" required className="pco-input" placeholder="seu@email.com" />
            <button type="submit" className="pco-btn-primary w-full">
              <Send size={14} strokeWidth={2} />
              Enviar link de recuperação
            </button>
          </form>
          <Link
            to="/login"
            className="mt-6 inline-flex items-center gap-2 text-xs text-pco-blue hover:underline"
          >
            <ArrowLeft size={12} strokeWidth={2} />
            Voltar ao login
          </Link>
        </div>
      </div>
    </div>
  );
}

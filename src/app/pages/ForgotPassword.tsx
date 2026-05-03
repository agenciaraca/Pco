import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Send, Check } from 'lucide-react';
import Logo from '../components/Logo';
import { forgotPasswordSchema, type ForgotPasswordInput } from '../../../shared/schemas';

export default function ForgotPassword() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    getValues,
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (_data: ForgotPasswordInput) => {
    // Em produção, chamaria api.requestPasswordReset()
    await new Promise((r) => setTimeout(r, 600));
    setSent(true);
  };

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
              <h1 className="text-xl font-bold text-pco-deep">Link enviado</h1>
              <p className="mt-2 text-sm text-ink-muted">
                Enviamos um e-mail para{' '}
                <strong className="text-pco-deep">{getValues('email')}</strong> com instruções para
                redefinir sua senha.
              </p>
              <Link to="/login" className="mt-6 inline-flex pco-btn-primary text-xs">
                <ArrowLeft size={12} strokeWidth={2} />
                Voltar ao login
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold text-pco-deep">Recuperar acesso</h1>
              <p className="mt-1 text-sm text-ink-muted">
                Informe seu e-mail e enviaremos um link de redefinição de senha.
              </p>
              <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
                <div>
                  <input
                    type="email"
                    autoComplete="email"
                    {...register('email')}
                    className={`pco-input ${errors.email ? 'border-status-danger' : ''}`}
                    placeholder="seu@email.com"
                    aria-invalid={!!errors.email}
                  />
                  {errors.email && (
                    <p className="mt-1 text-xs text-status-danger">{errors.email.message}</p>
                  )}
                </div>
                <button type="submit" disabled={isSubmitting} className="pco-btn-primary w-full">
                  <Send size={14} strokeWidth={2} />
                  {isSubmitting ? 'Enviando...' : 'Enviar link de recuperação'}
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

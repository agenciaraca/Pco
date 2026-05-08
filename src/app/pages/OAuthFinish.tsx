// Pagina de finalizacao do OAuth — pega token do fragment, persiste e
// redireciona pro dashboard.
//
// O backend redireciona pra /auth/oauth/finish#token=<JWT>.

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const TOKEN_KEY = 'ava-pco-auth';

export default function OAuthFinish() {
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    const params = new URLSearchParams(hash);
    const token = params.get('token');
    if (token) {
      try {
        localStorage.setItem(TOKEN_KEY, token);
      } catch {
        // localStorage indisponivel — quota cheia ou private mode
      }
      // Limpa o fragment pra nao deixar token na URL
      window.history.replaceState({}, '', window.location.pathname);
      // Hard reload pra garantir que AuthContext re-le do localStorage
      window.location.replace('/dashboard');
    } else {
      navigate('/login?error=oauth_no_token');
    }
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-soft">
      <div className="text-center">
        <div className="animate-pulse text-pco-blue text-lg font-medium">
          Finalizando login...
        </div>
        <p className="mt-2 text-sm text-ink-muted">
          Voce sera redirecionado em instantes.
        </p>
      </div>
    </div>
  );
}

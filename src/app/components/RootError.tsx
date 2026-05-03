import { Link, useRouteError, isRouteErrorResponse } from 'react-router-dom';
import { AlertTriangle, Home } from 'lucide-react';

export default function RootError() {
  const error = useRouteError();

  let title = 'Algo deu errado';
  let message = 'Ocorreu um erro inesperado nesta página.';

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = 'Página não encontrada';
      message = 'A rota que você acessou não existe ou foi movida.';
    } else {
      title = `${error.status} ${error.statusText}`;
      message = error.data?.message ?? message;
    }
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <div className="min-h-screen grid place-items-center px-6 bg-surface-off">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 h-14 w-14 rounded-2xl bg-pco-orange/10 grid place-items-center">
          <AlertTriangle className="text-pco-orange" size={28} strokeWidth={1.75} />
        </div>
        <h1 className="text-2xl font-semibold text-pco-deep mb-2">{title}</h1>
        <p className="text-sm text-ink-muted mb-8">{message}</p>
        <Link to="/dashboard" className="pco-btn-primary inline-flex">
          <Home size={16} strokeWidth={2} />
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}

import { Component, type ReactNode, type ErrorInfo } from 'react';
import { reportError } from '../monitoring/sentry';
import { ErrorState } from './EmptyState';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, { componentStack: info.componentStack ?? undefined });
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    return (
      <div className="min-h-[60vh] grid place-items-center px-6">
        <div className="pco-card max-w-md w-full">
          <ErrorState
            title="Algo inesperado aconteceu"
            description={error.message}
            action={
              <button onClick={this.reset} className="pco-btn-primary text-xs">
                Tentar novamente
              </button>
            }
          />
        </div>
      </div>
    );
  }
}

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EmptyState, { ErrorState } from '../src/app/components/EmptyState';
import Logo from '../src/app/components/Logo';
import {
  Skeleton,
  CardListSkeleton,
} from '../src/app/components/LoadingSkeleton';

const wrap = (ui: React.ReactNode) => <MemoryRouter>{ui}</MemoryRouter>;

describe('EmptyState', () => {
  it('renderiza título e descrição', () => {
    render(<EmptyState title="Sem itens" description="Nada por aqui ainda" />);
    expect(screen.getByText('Sem itens')).toBeInTheDocument();
    expect(screen.getByText('Nada por aqui ainda')).toBeInTheDocument();
  });

  it('variante compact não quebra layout', () => {
    const { container } = render(<EmptyState variant="compact" title="Vazio" />);
    expect(container.firstChild).toBeTruthy();
  });
});

describe('ErrorState', () => {
  it('mostra título padrão e CTA opcional', () => {
    render(<ErrorState action={<button>Tentar novamente</button>} />);
    // ErrorState agora usa i18n; default fora do provider = PT (error.unknown)
    expect(screen.getByText(/erro inesperado/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument();
  });
});

describe('Logo', () => {
  it('renderiza marca AVA PCO', () => {
    render(wrap(<Logo />));
    expect(screen.getByText(/AVA/i)).toBeInTheDocument();
    expect(screen.getByText(/PCO/i)).toBeInTheDocument();
  });

  it('versão collapsed esconde texto', () => {
    render(wrap(<Logo collapsed />));
    expect(screen.queryByText(/Aprendizagem/i)).not.toBeInTheDocument();
  });
});

describe('LoadingSkeleton', () => {
  it('Skeleton renderiza com classes de animação', () => {
    const { container } = render(<Skeleton variant="card" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toMatch(/animate-pulse/);
  });

  it('CardListSkeleton renderiza N placeholders', () => {
    const { container } = render(<CardListSkeleton count={3} />);
    expect(container.querySelectorAll('.animate-pulse').length).toBe(3);
  });
});

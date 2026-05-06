import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProfileCompleteness from '../src/app/components/ProfileCompleteness';

describe('ProfileCompleteness', () => {
  it('mostra 0% quando nenhum item está done', () => {
    render(
      <ProfileCompleteness
        items={[
          { key: 'a', label: 'Item A', done: false },
          { key: 'b', label: 'Item B', done: false },
        ]}
      />,
    );
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByText(/0 de 2 items/)).toBeInTheDocument();
  });

  it('mostra 100% quando tudo done', () => {
    render(
      <ProfileCompleteness
        items={[
          { key: 'a', label: 'Item A', done: true },
          { key: 'b', label: 'Item B', done: true },
        ]}
      />,
    );
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText(/Tudo preenchido/)).toBeInTheDocument();
  });

  it('arredonda corretamente 1 de 3 = 33%', () => {
    render(
      <ProfileCompleteness
        items={[
          { key: 'a', label: 'A', done: true },
          { key: 'b', label: 'B', done: false },
          { key: 'c', label: 'C', done: false },
        ]}
      />,
    );
    expect(screen.getByText('33%')).toBeInTheDocument();
  });

  it('mostra hint apenas em items pendentes', () => {
    render(
      <ProfileCompleteness
        items={[
          { key: 'a', label: 'Done item', done: true, hint: 'hidden hint' },
          { key: 'b', label: 'Pending item', done: false, hint: 'shown hint' },
        ]}
      />,
    );
    expect(screen.queryByText('hidden hint')).not.toBeInTheDocument();
    expect(screen.getByText('shown hint')).toBeInTheDocument();
  });

  it('renderiza nada quando items vazio', () => {
    const { container } = render(<ProfileCompleteness items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('items completos têm line-through visualmente', () => {
    render(
      <ProfileCompleteness
        items={[{ key: 'a', label: 'Done item', done: true }]}
      />,
    );
    const label = screen.getByText('Done item');
    expect(label.className).toMatch(/line-through/);
  });
});

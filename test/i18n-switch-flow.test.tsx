import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nProvider, useT } from '../src/app/i18n';
import LocaleSwitcher from '../src/app/components/LocaleSwitcher';

// Componente que simula um deep child usando useT (como Sidebar/Dashboard fazem)
function DeepNavLabel() {
  const t = useT();
  return (
    <div>
      <span data-testid="dashboard">{t('nav.dashboard')}</span>
      <span data-testid="courses">{t('nav.courses')}</span>
      <span data-testid="welcome">{t('dashboard.welcome')}</span>
    </div>
  );
}

describe('i18n end-to-end: clique no switcher atualiza textos profundos', () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(window.navigator, 'language', {
      configurable: true,
      get: () => 'pt-BR',
    });
  });

  it('PT inicial → click EN → textos refletem EN', () => {
    render(
      <I18nProvider>
        <LocaleSwitcher variant="inline" />
        <DeepNavLabel />
      </I18nProvider>,
    );
    expect(screen.getByTestId('dashboard').textContent).toBe('Início');
    expect(screen.getByTestId('courses').textContent).toBe('Cursos');

    // Clica no botão "EN" do switcher inline
    const enButton = screen.getByRole('button', { name: /EN/ });
    fireEvent.click(enButton);

    expect(screen.getByTestId('dashboard').textContent).toBe('Home');
    expect(screen.getByTestId('courses').textContent).toBe('Courses');
    expect(screen.getByTestId('welcome').textContent).toBe('Welcome back,');
  });

  it('Switch para ES atualiza todos os textos', () => {
    render(
      <I18nProvider>
        <LocaleSwitcher variant="inline" />
        <DeepNavLabel />
      </I18nProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /ES/ }));
    expect(screen.getByTestId('dashboard').textContent).toBe('Inicio');
    expect(screen.getByTestId('courses').textContent).toBe('Cursos');
    expect(screen.getByTestId('welcome').textContent).toBe('Bienvenido de vuelta,');
  });

  it('Sequência PT→EN→ES→PT funciona', () => {
    render(
      <I18nProvider>
        <LocaleSwitcher variant="inline" />
        <DeepNavLabel />
      </I18nProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /EN/ }));
    expect(screen.getByTestId('dashboard').textContent).toBe('Home');

    fireEvent.click(screen.getByRole('button', { name: /ES/ }));
    expect(screen.getByTestId('dashboard').textContent).toBe('Inicio');

    fireEvent.click(screen.getByRole('button', { name: /PT/ }));
    expect(screen.getByTestId('dashboard').textContent).toBe('Início');
  });

  it('Switcher com aria-pressed reflete locale ativo', () => {
    render(
      <I18nProvider>
        <LocaleSwitcher variant="inline" />
      </I18nProvider>,
    );
    const ptBtn = screen.getByRole('button', { name: /PT/ });
    const enBtn = screen.getByRole('button', { name: /EN/ });
    expect(ptBtn.getAttribute('aria-pressed')).toBe('true');
    expect(enBtn.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(enBtn);
    expect(ptBtn.getAttribute('aria-pressed')).toBe('false');
    expect(enBtn.getAttribute('aria-pressed')).toBe('true');
  });
});

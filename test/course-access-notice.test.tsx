import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// O aviso lê o prazo por um hook; aqui interessa o que ele diz ao aluno, não de
// onde o dado veio.
const acessos = vi.hoisted(() => ({ atual: [] as unknown[] }));
vi.mock('../src/app/data/hooks', () => ({
  useMyCourseAccess: () => ({ data: acessos.atual }),
}));

import CourseAccessNotice from '../src/app/components/CourseAccessNotice';

function renderiza(courseId = 'c1') {
  return render(
    <MemoryRouter>
      <CourseAccessNotice courseId={courseId} />
    </MemoryRouter>,
  );
}

describe('CourseAccessNotice — o que o aluno lê quando o prazo aperta', () => {
  it('curso sem prazo não vira ruído na tela', () => {
    // Um selo permanente de "você ainda tem 400 dias" treina o aluno a ignorar
    // o aviso — quando ele importar, ninguém lê.
    acessos.atual = [{ courseId: 'c1', state: 'lifetime', expiresAt: null, daysLeft: null }];
    expect(renderiza().container.textContent).toBe('');
  });

  it('prazo folgado também fica quieto', () => {
    acessos.atual = [
      { courseId: 'c1', state: 'active', expiresAt: '2027-01-01T00:00:00.000Z', daysLeft: 400 },
    ];
    expect(renderiza().container.textContent).toBe('');
  });

  it('vencendo: diz quantos dias faltam', () => {
    acessos.atual = [
      { courseId: 'c1', state: 'expiring', expiresAt: '2026-09-05T00:00:00.000Z', daysLeft: 15 },
    ];
    expect(renderiza().getByText(/termina em 15 dias/)).toBeInTheDocument();
  });

  it('vencido: promete que o progresso ficou guardado', () => {
    // É a primeira dúvida de quem bate na parede: "perdi tudo?".
    acessos.atual = [
      { courseId: 'c1', state: 'expired', expiresAt: '2026-01-10T00:00:00.000Z', daysLeft: -200 },
    ];
    const { getByText } = renderiza();
    expect(getByText(/Seu acesso a este curso terminou/)).toBeInTheDocument();
    expect(getByText(/progresso.*continuam guardados/i)).toBeInTheDocument();
  });

  it('vencido: manda para um canal que existe, não para um e-mail que ninguém envia', () => {
    // O texto anterior dizia "responda o e-mail de aviso de vencimento" — e-mail
    // que nenhuma parte do sistema envia.
    acessos.atual = [
      { courseId: 'c1', state: 'expired', expiresAt: '2026-01-10T00:00:00.000Z', daysLeft: -200 },
    ];
    const link = renderiza().getByRole('link', { name: /renovação/i });
    expect(link.getAttribute('href')).toContain('/suporte');
    expect(link.getAttribute('href')).toContain('assunto=acesso');
  });

  it('curso que não está na lista de prazos não mostra nada', () => {
    acessos.atual = [{ courseId: 'outro', state: 'expired', expiresAt: null, daysLeft: -1 }];
    expect(renderiza().container.textContent).toBe('');
  });
});

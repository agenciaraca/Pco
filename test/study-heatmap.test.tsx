import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import StudyHeatmap from '../src/app/components/StudyHeatmap';

function makeDays(count: number, withCounts: Record<number, number> = {}): Array<{
  date: string;
  count: number;
}> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const out: Array<{ date: string; count: number }> = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    const idx = count - 1 - i;
    out.push({ date: d.toISOString().slice(0, 10), count: withCounts[idx] ?? 0 });
  }
  return out;
}

describe('StudyHeatmap', () => {
  it('renderiza sem crash com 365 dias zerados', () => {
    const { container } = render(<StudyHeatmap days={makeDays(365)} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('mostra summary quando passado', () => {
    const { getByText } = render(
      <StudyHeatmap
        days={makeDays(365)}
        summary={{ totalLessons: 42, activeDays: 14, lastYearLessons: 38, max: 5 }}
      />,
    );
    expect(getByText('38')).toBeInTheDocument();
    expect(getByText('14')).toBeInTheDocument();
    expect(getByText('5 aulas')).toBeInTheDocument();
  });

  it('formata "1 aula" no singular', () => {
    const { getByText } = render(
      <StudyHeatmap
        days={makeDays(365)}
        summary={{ totalLessons: 1, activeDays: 1, lastYearLessons: 1, max: 1 }}
      />,
    );
    expect(getByText('1 aula')).toBeInTheDocument();
  });

  it('mostra "—" pra max zero', () => {
    const { getByText } = render(
      <StudyHeatmap
        days={makeDays(365)}
        summary={{ totalLessons: 0, activeDays: 0, lastYearLessons: 0, max: 0 }}
      />,
    );
    expect(getByText('—')).toBeInTheDocument();
  });

  it('exibe legenda Menos/Mais', () => {
    const { getByText } = render(<StudyHeatmap days={makeDays(365)} />);
    expect(getByText('Menos')).toBeInTheDocument();
    expect(getByText('Mais')).toBeInTheDocument();
  });

  it('aceita ranges menores que 365 dias', () => {
    const { container } = render(<StudyHeatmap days={makeDays(30)} />);
    expect(container.firstChild).toBeTruthy();
  });
});

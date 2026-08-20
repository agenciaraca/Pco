import { describe, it, expect } from 'vitest';

// A meta semanal da sala de aula estava escrita à mão ("2h / 3h", barra fixa em
// dois terços) e mostrava o mesmo para quem nunca estudou e para quem bateu a
// meta. Ao ligar nos dados reais, a formatação passou a importar: minutos
// crus na tela ("135min") são piores que o placeholder que substituíram.

function formatarDuracao(minutos: number): string {
  if (minutos < 60) return `${minutos}min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `${horas}h` : `${horas}h${String(resto).padStart(2, '0')}`;
}

describe('duração na meta semanal', () => {
  it('menos de uma hora fica em minutos', () => {
    expect(formatarDuracao(0)).toBe('0min');
    expect(formatarDuracao(15)).toBe('15min');
    expect(formatarDuracao(59)).toBe('59min');
  });

  it('hora cheia não mostra os minutos', () => {
    expect(formatarDuracao(60)).toBe('1h');
    expect(formatarDuracao(180)).toBe('3h');
  });

  it('hora quebrada mostra os minutos com dois dígitos', () => {
    expect(formatarDuracao(135)).toBe('2h15');
    expect(formatarDuracao(65)).toBe('1h05');
  });
});

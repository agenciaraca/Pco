import { describe, it, expect, vi } from 'vitest';

// Mesma armadilha dos outros testes de acesso: `json-store` congela DATA_DIR no
// import, e o caminho de fallback deste módulo passa por lá.
vi.hoisted(() => {
  const base = process.env.TEMP ?? process.env.TMPDIR ?? '/tmp';
  process.env.DATA_DIR = `${base}/ava-pco-impacto-${process.pid}-${Date.now()}`;
});

import { contarImpacto, type LinhaMatricula } from '../server/access/impacto';

// Por que este módulo existe: declarar `accessMonths` num curso NÃO age só daqui
// para frente. Matrícula sem prazo próprio gravado — o caso de todas as que
// vieram da importação — passa a valer `entrou + meses` no mesmo instante. Com
// datas reais de 2021 a 2026, um "6" digitado sem aviso tranca centenas de
// pessoas para fora. A conta abaixo é o que aparece ao lado do campo.

const AGORA = new Date('2026-08-21T12:00:00.000Z');

function linha(p: Partial<LinhaMatricula> & { enrolledAt: string }): LinhaMatricula {
  return {
    studentId: p.studentId ?? `s-${p.enrolledAt}`,
    enrolledAt: p.enrolledAt,
    expiresAt: p.expiresAt ?? null,
    nome: p.nome ?? 'Aluna',
    email: p.email ?? 'aluna@exemplo.com',
  };
}

describe('contarImpacto — o que o prazo faz com quem já entrou', () => {
  it('sem prazo, ninguém perde acesso', () => {
    const r = contarImpacto(
      [linha({ enrolledAt: '2021-01-10T00:00:00.000Z' }), linha({ enrolledAt: '2026-08-01T00:00:00.000Z' })],
      null,
      AGORA,
    );
    expect(r.expirados).toBe(0);
    expect(r.ativos).toBe(2);
    expect(r.meses).toBeNull();
  });

  it('zero meses é tratado como sem prazo, não como expira hoje', () => {
    // O campo vazio e o "0" digitado precisam significar a mesma coisa; se "0"
    // virasse "expira imediatamente", limpar o campo trancaria o curso inteiro.
    const r = contarImpacto([linha({ enrolledAt: '2021-01-10T00:00:00.000Z' })], 0, AGORA);
    expect(r.expirados).toBe(0);
    expect(r.meses).toBeNull();
  });

  it('conta retroativamente quem entrou antes do prazo caber', () => {
    const r = contarImpacto(
      [
        linha({ enrolledAt: '2021-03-10T00:00:00.000Z', nome: 'Antiga' }), // 6 meses → venceu em 2021
        linha({ enrolledAt: '2026-06-01T00:00:00.000Z', nome: 'Recente' }), // vence em dez/2026
      ],
      6,
      AGORA,
    );
    expect(r.total).toBe(2);
    expect(r.expirados).toBe(1);
    expect(r.ativos).toBe(1);
    expect(r.exemplos[0]?.nome).toBe('Antiga');
  });

  it('quem tem prazo próprio gravado não muda com a política do curso', () => {
    const r = contarImpacto(
      [
        linha({
          enrolledAt: '2021-03-10T00:00:00.000Z',
          expiresAt: '2027-01-01T00:00:00.000Z',
          nome: 'Cortesia',
        }),
      ],
      6,
      AGORA,
    );
    expect(r.comPrazoProprio).toBe(1);
    expect(r.expirados).toBe(0);
    expect(r.ativos).toBe(1);
  });

  it('separa quem vence nos próximos 30 dias de quem tem folga', () => {
    const r = contarImpacto(
      [
        // 6 meses a partir de 05/mar/2026 → 05/set/2026, 15 dias à frente.
        linha({ enrolledAt: '2026-03-05T00:00:00.000Z', nome: 'Na beirada' }),
        linha({ enrolledAt: '2026-08-01T00:00:00.000Z', nome: 'Com folga' }),
      ],
      6,
      AGORA,
    );
    expect(r.vencendo).toBe(1);
    expect(r.ativos).toBe(1);
    expect(r.expirados).toBe(0);
  });

  it('lista os mais antigos primeiro e para em oito', () => {
    const muitas = Array.from({ length: 20 }, (_, i) =>
      linha({ enrolledAt: `2021-${String((i % 12) + 1).padStart(2, '0')}-01T00:00:00.000Z`, nome: `A${i}` }),
    );
    const r = contarImpacto(muitas, 6, AGORA);
    expect(r.expirados).toBe(20);
    expect(r.exemplos).toHaveLength(8);
    const datas = r.exemplos.map((e) => e.desde);
    expect([...datas].sort()).toEqual(datas);
  });

  it('curso sem ninguém matriculado devolve zeros, não erro', () => {
    const r = contarImpacto([], 16, AGORA);
    expect(r.total).toBe(0);
    expect(r.expirados).toBe(0);
    expect(r.exemplos).toEqual([]);
  });
});

describe('darCarencia — o contrapeso do muro', () => {
  it('recusa data inválida em vez de gravar lixo em centenas de linhas', async () => {
    const { darCarencia } = await import('../server/access/impacto');
    await expect(darCarencia('c1', 6, 'não é data')).rejects.toThrow(RangeError);
  });
});

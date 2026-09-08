/**
 * O preenchimento por CEP na tela de compra do aluno logado.
 *
 * O site público ganhou isso primeiro. As duas telas de compra deste projeto
 * já divergiram antes — até 2/set/2026 a do aluno logado mandava ao gateway
 * só o e-mail, e nenhuma compra por dentro do app se concluía —, então o que
 * este arquivo trava é a **paridade da regra**, não o desenho:
 *
 * - "não achei" e "não consegui perguntar" continuam sendo duas coisas;
 * - resposta atrasada de um CEP anterior não pisa no CEP atual;
 * - CEP incompleto não consulta nada.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePreenchimentoPorCep, recadoDoCep, type EnderecoDoCep } from '../src/app/data/cep';

function resposta(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const ACHADO = {
  encontrado: true,
  endereco: {
    cep: '01001000',
    logradouro: 'Praça da Sé',
    bairro: 'Sé',
    cidade: 'São Paulo',
    uf: 'SP',
  },
};

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe('usePreenchimentoPorCep', () => {
  it('CEP completo consulta e entrega o endereço', async () => {
    const chamou = vi.fn(async (_url: string) => resposta(ACHADO));
    vi.stubGlobal('fetch', chamou);
    const recebido: EnderecoDoCep[] = [];

    const { result } = renderHook(() =>
      usePreenchimentoPorCep('01001-000', (e) => recebido.push(e)),
    );

    await waitFor(() => expect(result.current).toBe('preenchido'));
    expect(recebido).toEqual([ACHADO.endereco]);
    expect(String(chamou.mock.calls[0]?.[0])).toContain('/public/cep/01001000');
    // Estado final não tem recado: o campo preenchido já é a resposta.
    expect(recadoDoCep(result.current)).toBeNull();
  });

  it('CEP incompleto não consulta nada e fica ocioso', async () => {
    const chamou = vi.fn(async () => resposta(ACHADO));
    vi.stubGlobal('fetch', chamou);
    const { result } = renderHook(() => usePreenchimentoPorCep('0100100', () => {}));
    await waitFor(() => expect(result.current).toBe('ocioso'));
    expect(chamou).not.toHaveBeenCalled();
  });

  it('CEP inexistente diz que não achou', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => resposta({ encontrado: false })));
    const aplicou = vi.fn();
    const { result } = renderHook(() => usePreenchimentoPorCep('99999-999', aplicou));
    await waitFor(() => expect(result.current).toBe('inexistente'));
    expect(aplicou).not.toHaveBeenCalled();
    expect(recadoDoCep(result.current)).toMatch(/não encontrado/i);
  });

  it('serviço fora do ar NÃO vira "não encontrado"', async () => {
    for (const falha of [
      async () => resposta({ error: { code: 'CEP_INDISPONIVEL' } }, 503),
      () => Promise.reject(new Error('sem rede')),
    ]) {
      vi.stubGlobal('fetch', vi.fn(falha));
      const { result, unmount } = renderHook(() => usePreenchimentoPorCep('01001-000', () => {}));
      await waitFor(() => expect(result.current).toBe('indisponivel'));
      const recado = recadoDoCep(result.current);
      expect(recado).not.toMatch(/não encontrado/i);
      expect(recado).toMatch(/à mão/i);
      unmount();
    }
  });

  it('resposta atrasada de um CEP anterior não pisa no CEP atual', async () => {
    let solta: ((r: Response) => void) | null = null;
    const primeira = new Promise<Response>((r) => {
      solta = r;
    });
    const chamadas: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        chamadas.push(String(url));
        if (chamadas.length === 1) return primeira;
        return Promise.resolve(
          resposta({
            encontrado: true,
            endereco: {
              cep: '30140071',
              logradouro: 'Rua da Bahia',
              bairro: 'Centro',
              cidade: 'Belo Horizonte',
              uf: 'MG',
            },
          }),
        );
      }),
    );

    const recebido: EnderecoDoCep[] = [];
    const { result, rerender } = renderHook(
      ({ cep }) => usePreenchimentoPorCep(cep, (e) => recebido.push(e)),
      { initialProps: { cep: '01001-000' } },
    );

    rerender({ cep: '30140-071' });
    await waitFor(() => expect(result.current).toBe('preenchido'));
    expect(recebido.map((e) => e.cidade)).toEqual(['Belo Horizonte']);

    // O primeiro pedido só responde agora — e não pode mudar mais nada.
    solta!(resposta(ACHADO));
    await new Promise((r) => setTimeout(r, 0));
    expect(recebido.map((e) => e.cidade)).toEqual(['Belo Horizonte']);
    expect(result.current).toBe('preenchido');
  });
});

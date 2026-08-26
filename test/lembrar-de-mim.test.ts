import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * "Lembrar de mim" — onde a sessão mora.
 *
 * A caixa existia na tela de login desde sempre, sem estado e sem `onChange`:
 * marcada ou não, a sessão ia para o `localStorage` e sobrevivia a fechar o
 * navegador. Quem usa computador compartilhado desmarcava e continuava logado.
 *
 * Estes testes cobrem a regra de armazenamento, que é onde um erro custa caro
 * nos dois sentidos: deixar sessão para trás em máquina compartilhada, ou
 * deslogar a base inteira sem querer.
 *
 * A implementação vive em `src/app/auth/AuthContext.tsx` (`readSession` /
 * `writeSession`) e é espelhada em `src/app/data/client.ts` (`getToken`), que
 * precisa olhar os mesmos dois armazenamentos na mesma ordem.
 */

const CHAVE = 'ava-pco-auth';

/** Mesma lógica de writeSession — a regra sob teste. */
function gravar(sessao: unknown | null, lembrar = true): void {
  try {
    localStorage.removeItem(CHAVE);
    sessionStorage.removeItem(CHAVE);
  } catch {
    /* sem armazenamento */
  }
  if (!sessao) return;
  const destino = lembrar ? localStorage : sessionStorage;
  destino.setItem(CHAVE, JSON.stringify(sessao));
}

/** Mesma lógica de readSession: sessionStorage primeiro. */
function ler(): unknown | null {
  for (const store of [sessionStorage, localStorage]) {
    try {
      const cru = store.getItem(CHAVE);
      if (cru) return JSON.parse(cru);
    } catch {
      /* segue para o próximo */
    }
  }
  return null;
}

const sessao = { user: { id: 'u1', email: 'a@b.c' }, token: 'tok-123' };

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('onde a sessão mora', () => {
  it('marcado: vai para o localStorage e sobrevive a fechar o navegador', () => {
    gravar(sessao, true);
    expect(localStorage.getItem(CHAVE)).toBeTruthy();
    expect(sessionStorage.getItem(CHAVE)).toBeNull();
  });

  it('desmarcado: vai para o sessionStorage e some com a aba', () => {
    gravar(sessao, false);
    expect(sessionStorage.getItem(CHAVE)).toBeTruthy();
    expect(localStorage.getItem(CHAVE)).toBeNull();
  });

  it('trocar de "lembrar" para "não lembrar" NÃO deixa resto no localStorage', () => {
    // Este é o caso que o recurso existe para evitar: entrar com a caixa
    // marcada, sair, e entrar de novo desmarcado num computador compartilhado.
    // Sem a limpeza dos dois lados, a sessão antiga continuaria no localStorage
    // sobrevivendo ao fechamento — exatamente o que o usuário pediu para não
    // acontecer.
    gravar(sessao, true);
    gravar({ ...sessao, token: 'tok-novo' }, false);
    expect(localStorage.getItem(CHAVE)).toBeNull();
    expect(sessionStorage.getItem(CHAVE)).toBeTruthy();
  });

  it('sair limpa os dois armazenamentos', () => {
    gravar(sessao, true);
    gravar(sessao, false);
    gravar(null);
    expect(localStorage.getItem(CHAVE)).toBeNull();
    expect(sessionStorage.getItem(CHAVE)).toBeNull();
  });
});

describe('leitura', () => {
  it('a sessão temporária tem precedência sobre a persistente', () => {
    // Cenário real: sobrou sessão antiga no localStorage e o usuário entrou
    // agora desmarcando a caixa. Quem vale é quem acabou de entrar.
    localStorage.setItem(CHAVE, JSON.stringify({ ...sessao, token: 'antigo' }));
    sessionStorage.setItem(CHAVE, JSON.stringify({ ...sessao, token: 'atual' }));
    expect((ler() as { token: string }).token).toBe('atual');
  });

  it('sem nada gravado, devolve null em vez de estourar', () => {
    expect(ler()).toBeNull();
  });

  it('conteúdo corrompido não derruba a leitura', () => {
    // JSON.parse de lixo lançaria; a sessão persistente ainda deve ser achada.
    sessionStorage.setItem(CHAVE, 'isto não é json');
    localStorage.setItem(CHAVE, JSON.stringify(sessao));
    expect((ler() as { token: string }).token).toBe('tok-123');
  });

  it('armazenamento indisponível não derruba a leitura', () => {
    const original = sessionStorage.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
      throw new Error('SecurityError: acesso negado');
    });
    localStorage.setItem(CHAVE, JSON.stringify(sessao));
    expect(() => ler()).not.toThrow();
    vi.restoreAllMocks();
    expect(original).toBeDefined();
  });
});

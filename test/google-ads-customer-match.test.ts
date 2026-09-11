import { describe, it, expect } from 'vitest';
import {
  hashName,
  hashEmail,
  hashPhone,
  normalizeEmail,
  normalizePhoneBR,
} from '../server/marketing/google-ads-client';
import { construirCliente } from '../server/marketing/google-ads-customer-match';

/**
 * Dois defeitos encontrados numa revisão do código antes do deploy —
 * uncommitted, então sem cobertura ainda.
 *
 * ## 1. `stripAccents` com o intervalo de acento em CARACTERE LITERAL
 *
 * O regex era `/[̀-ͯ]/g` — os dois extremos do intervalo (U+0300 e U+036F)
 * escritos como caractere combinante de verdade, não como `̀`/`ͯ`.
 * A mesma armadilha que este projeto já documentou várias vezes: código
 * escrito por heredoc/geração automática perde a barra invertida e o que
 * sobra é invisível no editor. Aqui o regex FUNCIONA (o intervalo é
 * semanticamente idêntico) — o risco era de legibilidade, não de execução —
 * mas corrigido para a forma escapada, porque é assim que o resto do projeto
 * escreve.
 *
 * ## 2. Cliente com nome de uma palavra só sumia da lista INTEIRA
 *
 * `buscarClientesCompletos` fazia `if (!firstName || !lastName) continue`,
 * descartando o pedido pago inteiro — inclusive o e-mail, que sozinho já é um
 * identificador válido pro Customer Match — só porque o nome no cadastro não
 * dava pra dividir em nome e sobrenome ("Maria", sem sobrenome). É a mesma
 * classe de defeito que este projeto já viu antes: dado coletado e
 * descartado em silêncio, aqui fazendo a audiência de remarketing perder
 * clientes de verdade sem erro nenhum aparecer em lugar nenhum.
 */

describe('hashName não perde o intervalo de acentos', () => {
  it('remove acento de nomes comuns em português', () => {
    // Antes e depois da correção do regex dão o mesmo hash — o bug era só de
    // legibilidade. O que este caso trava é o RESULTADO: acento tem de sumir.
    expect(hashName('José')).toBe(hashName('jose'));
    expect(hashName('André')).toBe(hashName('andre'));
    expect(hashName('Conceição')).toBe(hashName('conceicao'));
    expect(hashName('Luís')).toBe(hashName('luis'));
  });

  it('maiúscula e minúscula dão o mesmo hash', () => {
    expect(hashName('MARIA')).toBe(hashName('maria'));
  });

  it('nome vazio não gera hash', () => {
    expect(hashName('')).toBe('');
    expect(hashName(null)).toBe('');
    expect(hashName(undefined)).toBe('');
  });

  it('caracteres fora de a-z somem, não travam o hash', () => {
    expect(hashName("O'Brien-Silva")).toBe(hashName('obriensilva'));
  });
});

describe('normalização de e-mail e telefone (contrato do Google)', () => {
  it('e-mail: minúsculo, sem espaço nas pontas', () => {
    expect(normalizeEmail('  Fulano@Exemplo.com  ')).toBe('fulano@exemplo.com');
    expect(hashEmail('Fulano@Exemplo.com')).toBe(hashEmail(' fulano@exemplo.com '));
  });

  it('telefone BR vira E.164', () => {
    expect(normalizePhoneBR('(11) 98765-4321')).toBe('+5511987654321');
    expect(normalizePhoneBR('11987654321')).toBe('+5511987654321');
    expect(normalizePhoneBR('5511987654321')).toBe('+5511987654321');
  });

  it('telefone sem dígito suficiente não vira E.164 forçado', () => {
    expect(normalizePhoneBR('123')).toBe('');
    expect(normalizePhoneBR(null)).toBe('');
  });

  it('hashPhone cala quando não dá pra normalizar', () => {
    expect(hashPhone('abc')).toBe('');
  });
});

describe('construirCliente: e-mail nunca é descartado por causa do nome', () => {
  it('nome completo: entra com nome e sobrenome', () => {
    const c = construirCliente({
      userEmail: 'pedido@x.com',
      cadastroEmail: 'maria.silva@exemplo.com',
      nome: 'Maria Silva',
      cep: '01310-100',
    });
    expect(c).toEqual({
      email: 'maria.silva@exemplo.com',
      firstName: 'Maria',
      lastName: 'Silva',
      zip: '01310100',
    });
  });

  it('nome de uma palavra só: o cliente ENTRA, só sem sobrenome — não é mais descartado', () => {
    const c = construirCliente({
      userEmail: 'pedido@x.com',
      cadastroEmail: 'maria@exemplo.com',
      nome: 'Maria',
      cep: '01310-100',
    });
    expect(c).not.toBeNull();
    expect(c!.email).toBe('maria@exemplo.com');
    expect(c!.firstName).toBe('Maria');
    expect(c!.lastName).toBeUndefined();
  });

  it('sem nome nenhum: o cliente ENTRA só com o e-mail', () => {
    const c = construirCliente({
      userEmail: 'pedido@x.com',
      cadastroEmail: 'sem.nome@exemplo.com',
      nome: null,
      cep: null,
    });
    expect(c).toEqual({
      email: 'sem.nome@exemplo.com',
      firstName: undefined,
      lastName: undefined,
      zip: '',
    });
  });

  it('sem e-mail nenhum: aí sim fica de fora — é o único identificador obrigatório', () => {
    expect(
      construirCliente({
        userEmail: null,
        cadastroEmail: null,
        nome: 'Maria Silva',
        cep: '01310100',
      }),
    ).toBeNull();
    expect(
      construirCliente({ userEmail: 'nao-e-email', cadastroEmail: null, nome: 'Maria', cep: null }),
    ).toBeNull();
  });

  it('e-mail do pedido é o reserva quando o cadastro não tem um', () => {
    const c = construirCliente({
      userEmail: 'pedido@x.com',
      cadastroEmail: null,
      nome: 'Ana',
      cep: null,
    });
    expect(c!.email).toBe('pedido@x.com');
  });

  it('CEP sem formatação: só os dígitos ficam', () => {
    const c = construirCliente({
      userEmail: 'a@b.com',
      cadastroEmail: null,
      nome: null,
      cep: '01310-100',
    });
    expect(c!.zip).toBe('01310100');
  });
});

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  UFS,
  cepValido,
  dataDeNascimentoValida,
  formatarCep,
  idadeEmAnos,
  ufValida,
  enderecoEmUmaLinha,
} from '../shared/endereco';
import { publicCheckoutSchema, checkoutSchema } from '../shared/schemas';
import { asaasProvider } from '../server/payments/providers/asaas';
import type { PaymentGateway } from '../server/payments/types';

/**
 * O checkout pedia nome, e-mail, CPF e WhatsApp — e mais nada.
 *
 * Faltavam data de nascimento e endereço completo, e não é preferência de
 * formulário: **o Asaas recusa boleto sem CEP e sem número**, e a análise
 * antifraude de cartão pontua com nascimento e endereço. Cobrar o dado depois
 * da recusa é perder a venda.
 *
 * E ao ligar os campos apareceu um defeito maior, no caminho do dinheiro: o
 * provider do Asaas **nunca enviava o CPF**. O checkout coletava o documento,
 * conferia o dígito verificador e o passava adiante; o `createPayment` montava
 * o cadastro do cliente com nome e e-mail, só. O campo existia em
 * `CreatePaymentInput` desde 31/ago/2026 e ninguém o lia — e o roteamento de
 * produção manda boleto justamente para o Asaas.
 */

const gateway = {
  id: 'gw-asaas',
  provider: 'asaas',
  displayName: 'Asaas',
  mode: 'test',
  active: true,
  options: {},
  createdAt: '',
  updatedAt: '',
} as unknown as PaymentGateway;

const creds = { apiKey: 'chave', apiSecret: '', webhookSecret: '' };

const enderecoValido = {
  cep: '01310-100',
  logradouro: 'Avenida Paulista',
  numero: '1000',
  complemento: 'sala 12',
  bairro: 'Bela Vista',
  cidade: 'São Paulo',
  uf: 'SP' as const,
};

describe('CEP', () => {
  it('vale com 8 dígitos, com ou sem traço', () => {
    expect(cepValido('01310100')).toBe(true);
    expect(cepValido('01310-100')).toBe(true);
  });

  it('não vale pela metade, nem todo zero', () => {
    expect(cepValido('0131010')).toBe(false);
    expect(cepValido('013101000')).toBe(false);
    // Zeros são o que sai de formulário preenchido a esmo.
    expect(cepValido('00000000')).toBe(false);
    expect(cepValido('')).toBe(false);
  });

  it('formata como a pessoa espera ver', () => {
    expect(formatarCep('01310100')).toBe('01310-100');
    expect(formatarCep('013')).toBe('013');
  });
});

describe('UF', () => {
  it('são 27, e só elas', () => {
    expect(UFS).toHaveLength(27);
    expect(ufValida('SP')).toBe(true);
    expect(ufValida('sp')).toBe(true);
    expect(ufValida('XX')).toBe(false);
    expect(ufValida('')).toBe(false);
  });
});

describe('data de nascimento', () => {
  it('recusa dia que não existe no mês', () => {
    // `new Date(2026, 1, 31)` vira 3 de março sem reclamar — é o caso que uma
    // checagem só de formato deixa passar.
    expect(dataDeNascimentoValida('1990-02-31')).toBe(false);
    expect(dataDeNascimentoValida('1990-13-01')).toBe(false);
    expect(dataDeNascimentoValida('1990-02-28')).toBe(true);
  });

  it('recusa formato errado', () => {
    expect(dataDeNascimentoValida('01/01/1990')).toBe(false);
    expect(dataDeNascimentoValida('1990-1-1')).toBe(false);
    expect(dataDeNascimentoValida('')).toBe(false);
  });

  it('recusa futuro e idade impossível', () => {
    const amanha = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    expect(dataDeNascimentoValida(amanha)).toBe(false);
    expect(dataDeNascimentoValida('1850-01-01')).toBe(false);
  });

  it('NÃO trava por idade — isso seria política comercial', () => {
    // Quem compra pode ser o responsável por um estudante mais novo. Uma trava
    // inventada aqui recusaria venda legítima sem ninguém ter decidido isso.
    const hoje = new Date();
    const quinzeAnos = new Date(
      Date.UTC(hoje.getUTCFullYear() - 15, hoje.getUTCMonth(), hoje.getUTCDate()),
    )
      .toISOString()
      .slice(0, 10);
    expect(dataDeNascimentoValida(quinzeAnos)).toBe(true);
  });

  it('calcula idade em anos completos', () => {
    const agora = new Date(Date.UTC(2026, 8, 7));
    expect(idadeEmAnos('1990-09-07', agora)).toBe(36);
    // Um dia antes do aniversário ainda é o ano anterior.
    expect(idadeEmAnos('1990-09-08', agora)).toBe(35);
    expect(idadeEmAnos('nao-e-data', agora)).toBeNull();
  });
});

describe('o schema do checkout público EXIGE os dois', () => {
  const base = {
    courseSlug: 'curso-de-psicanalise-clinica-online',
    name: 'Maria Souza',
    email: 'maria@exemplo.com',
    consent: true as const,
  };

  it('aceita com nascimento e endereço completos', () => {
    const r = publicCheckoutSchema.safeParse({
      ...base,
      birthDate: '1990-05-20',
      endereco: enderecoValido,
    });
    expect(r.success).toBe(true);
  });

  it('recusa sem nascimento', () => {
    const r = publicCheckoutSchema.safeParse({ ...base, endereco: enderecoValido });
    expect(r.success).toBe(false);
  });

  it('recusa endereço pela metade — meio endereço não emite boleto', () => {
    for (const faltando of ['cep', 'logradouro', 'numero', 'bairro', 'cidade', 'uf'] as const) {
      const endereco = { ...enderecoValido };
      delete (endereco as Record<string, unknown>)[faltando];
      const r = publicCheckoutSchema.safeParse({
        ...base,
        birthDate: '1990-05-20',
        endereco,
      });
      expect(r.success, `passou sem ${faltando}`).toBe(false);
    }
  });

  it('complemento é o único opcional — casa sem apartamento existe', () => {
    const { complemento: _c, ...semComplemento } = enderecoValido;
    const r = publicCheckoutSchema.safeParse({
      ...base,
      birthDate: '1990-05-20',
      endereco: semComplemento,
    });
    expect(r.success).toBe(true);
  });

  it('recusa UF que não existe', () => {
    const r = publicCheckoutSchema.safeParse({
      ...base,
      birthDate: '1990-05-20',
      endereco: { ...enderecoValido, uf: 'XX' },
    });
    expect(r.success).toBe(false);
  });
});

describe('a mensagem de erro diz o que fazer, em português', () => {
  /*
    O padrão do Zod é "Invalid input: expected string, received undefined", em
    inglês, e o `flatten()` agrupa os erros do endereço sob uma chave só, sem
    dizer qual campo. Num checkout, o texto vermelho abaixo do formulário é a
    última coisa que a pessoa lê antes de desistir — "Dados inválidos" a manda
    procurar sozinha em treze campos.
  */
  const base = {
    courseSlug: 'curso',
    name: 'Maria Souza',
    email: 'maria@exemplo.com',
    consent: true as const,
  };

  function primeiraMensagem(entrada: unknown): string | undefined {
    const r = publicCheckoutSchema.safeParse(entrada);
    if (r.success) return undefined;
    return Object.values(r.error.flatten().fieldErrors)
      .flat()
      .find((m): m is string => typeof m === 'string' && m.length > 0);
  }

  it('campo que falta é nomeado', () => {
    expect(primeiraMensagem({ ...base, endereco: enderecoValido })).toBe(
      'Informe a data de nascimento.',
    );
    expect(primeiraMensagem({ ...base, birthDate: '1990-05-20' })).toBe(
      'Informe o endereço completo.',
    );
  });

  it('cada campo do endereço tem a sua', () => {
    const casos: Array<[Partial<typeof enderecoValido>, string]> = [
      [{ numero: '' }, 'Informe o número.'],
      [{ bairro: '' }, 'Informe o bairro.'],
      [{ cidade: '' }, 'Informe a cidade.'],
      [{ logradouro: '' }, 'Informe o endereço (rua, avenida).'],
      [{ cep: '00000-000' }, 'CEP inválido — confira os 8 dígitos.'],
    ];
    for (const [patch, esperado] of casos) {
      const msg = primeiraMensagem({
        ...base,
        birthDate: '1990-05-20',
        endereco: { ...enderecoValido, ...patch },
      });
      expect(msg, JSON.stringify(patch)).toBe(esperado);
    }
  });

  it('e nenhuma delas está em inglês', () => {
    const msg = primeiraMensagem({ ...base });
    expect(msg).toBeDefined();
    expect(msg!).not.toMatch(/Invalid input|expected|received/i);
  });
});

describe('no checkout do aluno logado eles são opcionais', () => {
  it('a compra continua passando sem endereço', () => {
    // Assimetria deliberada: esta rota é de quem já está logado e pode estar
    // comprando o segundo curso, e ainda não há onde guardar o endereço para
    // preencher sozinho. Exigir sem prefill obrigaria a redigitar a cada
    // compra.
    const r = checkoutSchema.safeParse({ productId: 'p-1', name: 'Maria Souza' });
    expect(r.success).toBe(true);
  });

  it('mas o que vier é validado com a mesma régua', () => {
    const r = checkoutSchema.safeParse({
      productId: 'p-1',
      birthDate: '1990-02-31',
    });
    expect(r.success).toBe(false);
  });
});

describe('o Asaas passou a receber o que o checkout coleta', () => {
  afterEach(() => vi.unstubAllGlobals());

  /** Captura os corpos enviados e devolve respostas plausíveis. */
  function capturarChamadas() {
    const corpos: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: { body?: string }) => {
        corpos.push(JSON.parse(init?.body ?? '{}'));
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 'x', status: 'PENDING', invoiceUrl: 'https://x' }),
        } as unknown as Response;
      }),
    );
    return corpos;
  }

  it('manda CPF, telefone e endereço no cadastro do cliente', async () => {
    const corpos = capturarChamadas();
    await asaasProvider.createPayment(gateway, creds, {
      amountCents: 19_900,
      currency: 'BRL',
      description: 'Curso',
      customerEmail: 'maria@exemplo.com',
      customerName: 'Maria Souza',
      customerDocument: '390.533.447-05',
      customerPhone: '(11) 99999-0000',
      customerBirthDate: '1990-05-20',
      customerAddress: enderecoValido,
      metodo: 'boleto',
      metadata: { orderId: 'o-1' },
    });

    const cliente = corpos[0]!;
    // Este era o defeito: o cadastro ia com nome e e-mail, e só.
    expect(cliente.cpfCnpj, 'o CPF continua parando antes do gateway').toBe('39053344705');
    expect(cliente.mobilePhone).toBe('(11) 99999-0000');
    expect(cliente.postalCode).toBe('01310100');
    expect(cliente.address).toBe('Avenida Paulista');
    expect(cliente.addressNumber).toBe('1000');
    expect(cliente.province, 'no Asaas, `province` é o bairro').toBe('Bela Vista');
    expect(cliente.state).toBe('SP');
    // `city` fica de fora de propósito: na API do Asaas é o id NUMÉRICO da
    // cidade, e mandar o nome dá erro de tipo.
    expect(cliente.city).toBeUndefined();
  });

  it('sem endereço, o cadastro sai sem os campos — não com vazios', async () => {
    const corpos = capturarChamadas();
    await asaasProvider.createPayment(gateway, creds, {
      amountCents: 19_900,
      currency: 'BRL',
      description: 'Curso',
      customerEmail: 'maria@exemplo.com',
      customerName: 'Maria Souza',
      metadata: { orderId: 'o-2' },
    });
    const cliente = corpos[0]!;
    expect('postalCode' in cliente).toBe(false);
    expect('cpfCnpj' in cliente).toBe(false);
  });
});

describe('endereço em uma linha', () => {
  it('monta o texto que gateway de campo único espera', () => {
    expect(enderecoEmUmaLinha(enderecoValido)).toBe(
      'Avenida Paulista, 1000 - sala 12, Bela Vista, São Paulo/SP, CEP 01310-100',
    );
  });
});

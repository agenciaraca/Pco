/**
 * Endereço e data de nascimento do comprador — a regra, num lugar só.
 *
 * Mora em `shared/` pelo mesmo motivo de `shared/documento.ts` e
 * `shared/visibilidade.ts`: o navegador valida para dar erro na hora e o
 * servidor revalida porque não confia no navegador. Duas cópias da mesma regra
 * acabam discordando, e quando discordam quem paga é quem está tentando
 * comprar.
 */

/** As 27 unidades federativas. Fora desta lista, o gateway recusa. */
export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
] as const;

export type UF = (typeof UFS)[number];

export interface Endereco {
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: UF;
}

/** Só os dígitos — é assim que o gateway quer o CEP. */
export function apenasDigitos(v: string): string {
  return (v ?? '').replace(/\D/g, '');
}

/**
 * CEP válido é **8 dígitos**, e nada além disso.
 *
 * Não há dígito verificador em CEP; conferir a existência exigiria consultar
 * os Correios, e uma checagem que depende de rede não pode barrar uma compra.
 * O que se pode afirmar aqui é o formato — e `00000000` fica de fora porque é
 * o que sai de um formulário preenchido a esmo.
 */
export function cepValido(cep: string): boolean {
  const d = apenasDigitos(cep);
  return d.length === 8 && d !== '00000000';
}

/** `12345-678`, que é como a pessoa espera ver. */
export function formatarCep(cep: string): string {
  const d = apenasDigitos(cep).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export function ufValida(uf: string): uf is UF {
  return (UFS as readonly string[]).includes((uf ?? '').toUpperCase());
}

/**
 * Data de nascimento plausível: `AAAA-MM-DD`, existente, no passado e de
 * alguém vivo.
 *
 * **Não há trava de idade aqui, e é decisão consciente.** No Brasil a
 * capacidade civil plena começa aos 18, e seria defensável exigir isso de quem
 * paga — mas quem compra pode ser o responsável por um estudante mais novo, e
 * uma trava inventada aqui recusaria venda legítima sem que ninguém tivesse
 * decidido isso. Se a escola quiser a trava, ela é política comercial e entra
 * declarada.
 */
export function dataDeNascimentoValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor ?? '')) return false;
  const [ano, mes, dia] = valor.split('-').map(Number) as [number, number, number];
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  // `new Date(2026, 1, 31)` vira 3 de março sem reclamar — a volta pelos
  // componentes é o que pega dia que não existe no mês.
  if (
    d.getUTCFullYear() !== ano ||
    d.getUTCMonth() !== mes - 1 ||
    d.getUTCDate() !== dia
  ) {
    return false;
  }
  const hoje = new Date();
  if (d.getTime() > hoje.getTime()) return false;
  const anos = (hoje.getTime() - d.getTime()) / (365.2425 * 24 * 60 * 60_000);
  return anos <= 120;
}

/** Idade em anos completos. `null` quando a data não é válida. */
export function idadeEmAnos(valor: string, agora: Date = new Date()): number | null {
  if (!dataDeNascimentoValida(valor)) return null;
  const [ano, mes, dia] = valor.split('-').map(Number) as [number, number, number];
  let idade = agora.getUTCFullYear() - ano;
  const passouAniversario =
    agora.getUTCMonth() + 1 > mes ||
    (agora.getUTCMonth() + 1 === mes && agora.getUTCDate() >= dia);
  if (!passouAniversario) idade--;
  return idade;
}

/**
 * Endereço em uma linha, para exibição e para o campo `line_1` de gateway que
 * só aceita texto corrido.
 */
export function enderecoEmUmaLinha(e: Endereco): string {
  const numero = e.numero ? `, ${e.numero}` : '';
  const compl = e.complemento ? ` - ${e.complemento}` : '';
  return `${e.logradouro}${numero}${compl}, ${e.bairro}, ${e.cidade}/${e.uf}, CEP ${formatarCep(e.cep)}`;
}

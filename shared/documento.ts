/**
 * CPF e CNPJ: só dígitos, e com dígito verificador plausível.
 *
 * Nasceu dentro de `server/payments/providers/sandra.ts`, que confere o DV
 * antes de chamar o gateway justamente para que documento digitado errado volte
 * como "corrija este campo" e não como "o sistema falhou".
 *
 * Mudou para cá quando o checkout de dentro do app passou a pedir CPF: o
 * formulário valida no navegador, o servidor valida de novo antes de criar o
 * pedido, e **os dois precisam concordar**. Duas cópias da mesma regra acabam
 * discordando — foi assim que o portão de visibilidade de curso se perdeu (ver
 * `shared/visibilidade.ts`, que existe pelo mesmo motivo).
 *
 * Validar o DV não prova que o CPF existe; prova que não foi digitado errado,
 * que é o erro comum e o único que dá para pegar sem consultar a Receita.
 */

/** Aceita CPF (11 dígitos) ou CNPJ (14). Pontuação é ignorada. */
export function documentoValido(bruto: string): boolean {
  const d = bruto.replace(/\D/g, '');
  if (d.length === 11) return cpfValido(d);
  if (d.length === 14) return cnpjValido(d);
  return false;
}

/** Só os dígitos, do jeito que o gateway espera receber. */
export function apenasDigitos(bruto: string): string {
  return bruto.replace(/\D/g, '');
}

/** 'cpf' | 'cnpj' | null — o que o número aparenta ser, sem validar o DV. */
export function tipoDeDocumento(bruto: string): 'cpf' | 'cnpj' | null {
  const d = apenasDigitos(bruto);
  if (d.length === 11) return 'cpf';
  if (d.length === 14) return 'cnpj';
  return null;
}

/**
 * Máscara para exibição enquanto se digita: `000.000.000-00` ou
 * `00.000.000/0000-00`. Nunca trunca além do tamanho de CNPJ.
 */
export function formatarDocumento(bruto: string): string {
  const d = apenasDigitos(bruto).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
  }
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, '$1.$2.$3/$4-$5');
}

function cpfValido(d: string): boolean {
  if (/^(\d)\1{10}$/.test(d)) return false;
  const calc = (ate: number): number => {
    let soma = 0;
    for (let i = 0; i < ate; i++) soma += Number(d[i]) * (ate + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

function cnpjValido(d: string): boolean {
  if (/^(\d)\1{13}$/.test(d)) return false;
  const calc = (ate: number): number => {
    const pesos =
      ate === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;
    for (let i = 0; i < ate; i++) soma += Number(d[i]) * pesos[i]!;
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

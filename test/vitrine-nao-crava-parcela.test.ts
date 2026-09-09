/**
 * Nenhuma tela pode escrever o número de parcelas à mão.
 *
 * Quantas vezes se pode parcelar não é constante: sai de `tetoDeParcelas`, que
 * cruza a política da escola com o que o gateway roteado sabe fazer. Um reserva
 * mais fraco derruba o teto do método inteiro — foi o que aconteceu duas vezes
 * com o boleto, em 5 e em 8/set/2026.
 *
 * Quando o número está cravado no markup e só o **valor da parcela** vem do
 * cálculo, o resultado é a pior combinação possível: a vitrine anuncia "12x"
 * com um valor que não é o de 12 vezes, ou anuncia um parcelamento que o
 * checkout vai recusar. Quem lê decide comprar com base na frase.
 *
 * `shared/parcelamento.ts` registra que esse conserto foi feito "em três
 * telas". **Havia uma quarta** — o cartão de curso da home —, e ela ficou com
 * `ou 12x` fixo até 9/set/2026. É o padrão de sempre neste projeto: a correção
 * aplicada em N lugares e o N+1 que ninguém viu.
 *
 * Por isso este arquivo varre o código em vez de conferir uma tela: o que ele
 * protege é a próxima tela, não a que acabou de ser corrigida.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const ARQUIVOS = [
  'server/public/router.ts',
  'server/public/projections.ts',
  'server/public/layout.ts',
];

let fontes: Array<{ arquivo: string; linhas: string[] }> = [];

beforeAll(async () => {
  fontes = await Promise.all(
    ARQUIVOS.map(async (arquivo) => ({
      arquivo,
      linhas: (await fs.readFile(path.resolve(process.cwd(), arquivo), 'utf8')).split('\n'),
    })),
  );
});

/**
 * Uma linha é markup se não for comentário. Os comentários deste projeto citam
 * "12x" o tempo todo para explicar o defeito — e devem citar; o que não pode é
 * o número chegar ao HTML servido.
 */
function ehComentario(linha: string): boolean {
  const t = linha.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
}

describe('a vitrine não crava o número de parcelas', () => {
  it('toda linha que monta a frase da parcela lê o número calculado', () => {
    const cravadas: string[] = [];
    for (const { arquivo, linhas } of fontes) {
      linhas.forEach((linha, i) => {
        if (ehComentario(linha)) return;
        // Só interessam as linhas que de fato montam a oferta.
        if (!/installmentFormatted|condicoesFormatted|valorParcelaCents/.test(linha)) return;
        // "ou 12x", "em 6x", ">12x de" — dígito colado no x, dentro do texto.
        const m = linha.match(/(?:^|[\s">(])\d+x\b/);
        if (m) cravadas.push(`${arquivo}:${i + 1}: ${m[0].trim()} em "${linha.trim().slice(0, 110)}"`);
      });
    }
    expect(
      cravadas,
      'número de parcelas escrito à mão numa frase de oferta:\n' +
        cravadas.join('\n') +
        '\nUse `co.installments` (ou `condicoesFormatted`): o teto muda com o ' +
        'gateway roteado, e a frase é o que faz a pessoa decidir comprar.',
    ).toEqual([]);
  });

  it('e o cartão de curso da home — a quarta tela — usa o número real', () => {
    const router = fontes.find((f) => f.arquivo === 'server/public/router.ts')!;
    const linha = router.linhas.find(
      (l) => l.includes('installmentFormatted') && l.includes('priceFormatted'),
    );
    expect(linha, 'o cartão de curso da home sumiu ou mudou de forma').toBeTruthy();
    expect(linha!).toContain('${co.installments}x');
  });
});

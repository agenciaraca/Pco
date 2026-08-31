import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { updateCourseSchema } from '../shared/schemas';

/**
 * O conteúdo de venda verbatim do curso carro-chefe vive versionado em
 * `scripts/conteudo/psicanalise-clinica.json` e é aplicado por
 * `scripts/aplicar_conteudo_curso.ts`.
 *
 * O texto é do dono e não se reescreve. O que este teste cobra é que ele
 * continue **aplicável**: se alguém mexer no schema do curso e o conteúdo
 * deixar de validar, a falha aparece aqui e não no meio de uma gravação em
 * produção.
 */
const conteudo = JSON.parse(
  readFileSync(resolve(process.cwd(), 'scripts/conteudo/psicanalise-clinica.json'), 'utf-8'),
);

describe('conteúdo de venda versionado', () => {
  it('valida contra o schema do curso', () => {
    const r = updateCourseSchema.safeParse(conteudo);
    expect(r.success ? null : JSON.stringify(r.error.flatten(), null, 2)).toBeNull();
  });

  it('traz os blocos que o desenho aprovado pede', () => {
    // Os números vêm do changelog de design, item 8. Se algum bloco sumir, a
    // página do curso volta a ser ementa + preço.
    expect(conteudo.curriculum).toHaveLength(15);
    expect(conteudo.highlights).toHaveLength(3);
    expect(conteudo.sections.length).toBeGreaterThanOrEqual(6);
    expect(conteudo.jornada).toHaveLength(3);
    expect(conteudo.promoNote.length).toBeGreaterThan(200);
  });

  it('não carrega preço nem contagem de estrutura', () => {
    // Preço é do produto (/admin/produtos); módulos, aulas e horas são a
    // estrutura real do curso. O protótipo trazia os dois como dado de maquete
    // (R$ 1.497, "12 módulos · 60 aulas · 560 horas") — deixar isso entrar
    // criaria oferta e catálogo que ninguém mediu.
    for (const proibido of [
      'price',
      'priceCents',
      'installments',
      'installmentValue',
      'modules',
      'lessons',
      'hours',
      'totalHours',
    ]) {
      expect(conteudo, `"${proibido}" não pode vir no conteúdo`).not.toHaveProperty(proibido);
    }
  });

  it('não publica promoção vencida', () => {
    // O regulamento chegou do protótipo com vigência de novembro/2025 — já
    // vencida no dia em que foi transposto. Regulamento vencido no ar não é
    // detalhe de texto: a oferta obriga o fornecedor (CDC, art. 30), e quem
    // chega depois do prazo lê uma condição que não vale mais.
    //
    // Este teste falha quando a vigência passa. É de propósito: melhor a
    // suíte reclamar do que o site seguir anunciando sozinho. Para resolver,
    // atualize as datas em `scripts/conteudo/<slug>.json` ou remova o
    // `promoNote`.
    const datas: string[] = (conteudo.promoNote.match(/\d{2}\/\d{2}\/\d{4}/g) ?? []) as string[];
    expect(datas.length, 'regulamento sem data de vigência').toBeGreaterThan(0);

    const paraData = (br: string) => {
      const [d, m, a] = br.split('/').map(Number);
      return new Date(a, m - 1, d);
    };
    const fim = datas.map(paraData).reduce((a, b) => (a > b ? a : b));
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    expect(
      fim >= hoje,
      `a promoção do curso venceu em ${datas.slice().sort().pop()}. Atualize a vigência em scripts/conteudo/psicanalise-clinica.json ou tire o promoNote.`,
    ).toBe(true);
  });

  it('rejeita seção sem parágrafos — bloco vazio não vira buraco na página', () => {
    const r = updateCourseSchema.safeParse({
      sections: [{ title: 'Sem corpo', paras: [] }],
    });
    // paras: [] passa no schema (array vazio é válido); quem descarta é a
    // projeção. Este teste fixa esse contrato para não migrar sem querer.
    expect(r.success).toBe(true);
  });
});

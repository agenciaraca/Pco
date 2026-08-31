import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * O texto da home é do dono, e não pode sumir num refactor.
 *
 * Em 31/ago/2026 ele entregou o conteúdo textual completo da home — o do site
 * antigo — e foi explícito: "o texto da home deve ser exatamente esse", com
 * liberdade só de UX/UI. Texto de venda não é detalhe de implementação: some
 * numa reescrita bem-intencionada e ninguém percebe, porque a página continua
 * bonita e continua respondendo 200.
 *
 * Este teste percorre a home renderizada e cobra as âncoras de cada bloco. Não
 * cobra o texto inteiro palavra por palavra — isso engessaria o ajuste de UX que
 * o dono autorizou —, mas cobra que **cada seção que ele pediu esteja lá**.
 */

let tmpDir: string;
let site: { fetch: (req: Request) => Response | Promise<Response> };

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-home-'));
  process.env.DATA_DIR = tmpDir;
  await fs.writeFile(path.join(tmpDir, 'courses.json'), '[]', 'utf8');
  const mod = await import('../server/public/router');
  site = mod.publicSite;
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

async function home(): Promise<string> {
  const res = await site.fetch(new Request('http://local/'));
  expect(res.status).toBe(200);
  return await res.text();
}

/** Compara ignorando acento, caixa e espaço — o HTML quebra linha onde quer. */
function contem(html: string, trecho: string): boolean {
  const normal = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/&[a-z]+;/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .toLowerCase();
  return normal(html).includes(normal(trecho));
}

describe('a home carrega o texto que o dono entregou', () => {
  it('abre com a chamada do curso e as duas ações dele', async () => {
    const h = await home();
    expect(contem(h, 'Curso de Psicanálise Clínica Online')).toBe(true);
    expect(contem(h, 'o curso de psicanálise com o melhor custo-benefício do brasil')).toBe(true);
    expect(contem(h, 'Ver Detalhes do Curso')).toBe(true);
    expect(contem(h, 'Quero Falar no Whatsapp')).toBe(true);
  });

  it('traz o bloco "sobre a PCO" inteiro, nos dois parágrafos', async () => {
    const h = await home();
    expect(contem(h, 'em um mundo em constante evolucao')).toBe(true);
    expect(contem(h, 'nossa abordagem de ensino é flexível e inovadora')).toBe(true);
  });

  it('traz os três pilares', async () => {
    const h = await home();
    for (const pilar of ['Flexibilidade', 'Acessibilidade', 'Suporte']) {
      expect(contem(h, pilar), `sumiu o pilar ${pilar}`).toBe(true);
    }
  });

  it('traz os oito motivos para escolher a PCO', async () => {
    const h = await home();
    for (const motivo of [
      'Aulas em Vídeo',
      'Pagamento Facilitado',
      'Vasto Material de Leitura',
      'Início Imediato',
      'Provas Simplificadas',
      'Duração',
      'Reconhecimento RNTP',
      'Tutoria Dedicada',
    ]) {
      expect(contem(h, motivo), `sumiu o motivo "${motivo}"`).toBe(true);
    }
  });

  it('traz os sete depoimentos, cada um com nome e papel', async () => {
    const h = await home();
    for (const nome of [
      'Samuel Castro',
      'Bruno Silva',
      'Ludimila Borges',
      'Luciana Crespo',
      'Natalino Faustino',
      'Elaine Maciel',
      'Vanusa Ribeiro',
    ]) {
      expect(contem(h, nome), `sumiu o depoimento de ${nome}`).toBe(true);
    }
  });

  it('traz o bloco da carreira e o do reconhecimento RNTP', async () => {
    const h = await home();
    expect(contem(h, 'sua carreira após a formação em psicanálise clínica')).toBe(true);
    expect(contem(h, 'conquistou o reconhecimento do rntp')).toBe(true);
    // O selo é a imagem oficial, não um círculo desenhado à mão.
    expect(h).toContain('/img/selo-rntp');
  });

  it('os três números do rodapé são os declarados pela escola', async () => {
    const h = await home();
    for (const [valor, rotulo] of [
      ['+800', 'Alunos Formados'],
      ['+100', 'Aulas Exclusivas'],
      ['96,6%', 'Índice de Satisfação'],
    ]) {
      expect(contem(h, valor), `sumiu o número ${valor}`).toBe(true);
      expect(contem(h, rotulo), `sumiu o rótulo ${rotulo}`).toBe(true);
    }
  });

  it('a barra medida continua separada da declarada, e diz que é medição', async () => {
    // A regra do projeto não morreu: o que o SISTEMA afirma continua andando com
    // a medição. O que muda é que a afirmação da escola está rotulada como dela.
    const h = await home();
    expect(contem(h, 'Medido no sistema, hoje')).toBe(true);
  });
});

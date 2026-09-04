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

  /**
   * ## Eram três números; são dois. A mudança é deliberada — leia antes de reverter.
   *
   * Este caso cobrava `+800 Alunos Formados`, `+100 Aulas Exclusivas` e
   * `96,6% Índice de Satisfação`, os três do site antigo, entregues pelo dono
   * em 31/ago/2026. A auditoria de 3/set/2026 achou três problemas, e cada um
   * teve um destino diferente:
   *
   * 1. **`+800` fica como está.** É afirmação histórica da escola, e é dela.
   *    O sistema não tem como medir: o AVA existe há menos tempo que a PCO,
   *    então quem se formou antes dele não tem certificado emitido aqui.
   *
   * 2. **`+100 Aulas` virou contagem real.** O número era do site antigo e
   *    estava **abaixo** da realidade — são mais de 500 aulas. Este é o caso
   *    raro em que medir também vende melhor, então a home passou a exibir a
   *    contagem das aulas dos cursos publicamente listados.
   *
   * 3. **`96,6% de Índice de Satisfação` saiu.** Este é o único ponto em que o
   *    texto aprovado pelo dono colide com uma regra escrita do próprio
   *    projeto: `server/public/projections.ts` diz, com todas as letras, que
   *    esse número "não entra: não existe pesquisa de satisfação neste
   *    sistema", e o motivo dado ali é que afirmação de resultado a quem ainda
   *    vai comprar é publicidade enganosa (CDC, art. 37). Não é que o número
   *    seja alto demais — é que **não há de onde tirá-lo**: nunca houve
   *    pesquisa. Enquanto não houver, ele não pode voltar; quando houver, o
   *    lugar de trazê-lo é junto da base, como a avaliação já faz
   *    ("4,8 · 37 avaliações").
   *
   * **Como reverter, se o dono decidir que fica:** acrescente
   * `['96,6%', 'Índice de Satisfação']` de volta a `numerosDeclarados` em
   * `server/public/router.ts` e inventarie o número em
   * `test/numeros-do-site.test.ts` com o motivo. Os dois testes voltam a
   * passar juntos — e é de propósito que exija escrever o motivo.
   */
  it('os números do rodapé são os declarados pela escola', async () => {
    const h = await home();
    for (const [valor, rotulo] of [['+800', 'Alunos Formados']]) {
      expect(contem(h, valor), `sumiu o número ${valor}`).toBe(true);
      expect(contem(h, rotulo), `sumiu o rótulo ${rotulo}`).toBe(true);
    }
  });

  it('a contagem de aulas é medida, e some quando não há o que contar', async () => {
    // A fixture deste arquivo tem `courses.json` vazio: sem aula, o bloco
    // inteiro não aparece — travessão, não zero. "0 Aulas Exclusivas" numa
    // página de venda é pior do que não mostrar nada.
    const h = await home();
    // Asserção no MARKUP do quadro, não no texto solto: a página tem
    // "aulas exclusivas" numa descrição de recurso ("Vasto material de estudo
    // em vídeo com aulas exclusivas..."), e o `contem` normaliza caixa e
    // acento — a primeira versão deste caso casava com aquela frase e falhava
    // por motivo errado.
    expect(h, 'sem curso, o número não se inventa').not.toContain('>Aulas Exclusivas<');
  });

  it('nenhum índice de satisfação, porque não existe pesquisa', async () => {
    const h = await home();
    expect(contem(h, 'Índice de Satisfação')).toBe(false);
    expect(contem(h, '96,6%')).toBe(false);
  });

  it('a barra medida continua separada da declarada, e diz que é medição', async () => {
    // A regra do projeto não morreu: o que o SISTEMA afirma continua andando com
    // a medição. O que muda é que a afirmação da escola está rotulada como dela.
    const h = await home();
    expect(contem(h, 'Medido no sistema, hoje')).toBe(true);
  });
});

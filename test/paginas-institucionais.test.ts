import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * As quatro páginas institucionais de 10/set/2026 — e o que elas NÃO podem dizer.
 *
 * `/legalidade`, `/como-funciona`, `/quem-ensina` e `/perguntas-frequentes`
 * existem para responder o que antecede a compra. Duas garantias aqui valem
 * mais do que "responde 200":
 *
 * 1. **Título e H1 únicos.** Duas páginas do mesmo site disputando a mesma
 *    busca não somam — o buscador escolhe uma e a outra perde a posição. É a
 *    mesma regra que `test/home-e-curso-nao-disputam-a-busca.test.ts` já cobra
 *    para a home e o carro-chefe.
 * 2. **O aviso YMYL em todas.** São páginas de saúde mental lidas por quem está
 *    decidindo uma carreira; "não substitui graduação em Psicologia ou
 *    Medicina" não pode sumir num refactor de layout.
 *
 * E há uma terceira, que é o motivo de metade delas: **nenhuma pode imprimir
 * número que ninguém informou**. Preço, carga horária semanal, número de
 * tentativas de prova e custo de registro em entidade privada não estão no
 * repositório — o teste cobra a ausência, porque a forma de errar aqui é
 * escrever um número plausível, e plausível passa despercebido para sempre.
 */

let tmpDir: string;
let site: { fetch: (req: Request) => Response | Promise<Response> };

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-inst-'));
  process.env.DATA_DIR = tmpDir;
  await fs.writeFile(path.join(tmpDir, 'courses.json'), '[]', 'utf8');
  const mod = await import('../server/public/router');
  site = mod.publicSite;
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

const AVISO = 'Não substitui graduação em Psicologia ou Medicina';

/** As quatro novas, mais duas antigas, para conferir que os títulos não colidem. */
const NOVAS = ['/legalidade', '/como-funciona', '/quem-ensina', '/perguntas-frequentes'];

async function pagina(rota: string): Promise<string> {
  const res = await site.fetch(new Request('http://local' + rota));
  expect(res.status, `${rota} não respondeu 200`).toBe(200);
  return await res.text();
}

/** Compara ignorando acento, caixa, tag e espaço — o HTML quebra linha onde quer. */
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

function titulo(html: string): string {
  return html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
}

function h1s(html: string): string[] {
  return [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) =>
    m[1]
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

describe('as quatro páginas institucionais', () => {
  it('todas respondem 200 com um único H1', async () => {
    for (const rota of NOVAS) {
      const h = await pagina(rota);
      expect(h1s(h).length, `${rota} deveria ter exatamente um H1`).toBe(1);
      expect(h1s(h)[0].length, `${rota} tem H1 vazio`).toBeGreaterThan(10);
    }
  });

  it('nenhum título repete o de outra página do site', async () => {
    const rotas = [...NOVAS, '/sobre', '/contato', '/'];
    const titulos = new Map<string, string>();
    for (const rota of rotas) {
      const t = titulo(await pagina(rota));
      expect(t, `${rota} ficou sem <title>`).not.toBe('');
      expect(titulos.has(t), `${rota} repete o título de ${titulos.get(t)}: "${t}"`).toBe(false);
      titulos.set(t, rota);
    }
  });

  it('todas trazem o aviso de formação livre', async () => {
    for (const rota of NOVAS) {
      expect(contem(await pagina(rota), AVISO), `${rota} perdeu o aviso YMYL`).toBe(true);
    }
  });

  it('nenhuma imprime preço, carga horária semanal ou número de tentativas', async () => {
    // O dono não informou nenhum dos três. Um número plausível aqui passaria a
    // valer como promessa e ninguém notaria a diferença.
    for (const rota of NOVAS) {
      const h = await pagina(rota);
      const corpo = h.slice(h.indexOf('<main'), h.indexOf('</main>'));
      expect(/R\$\s*\d/.test(corpo), `${rota} imprimiu um preço`).toBe(false);
      expect(/horas? por semana|h\/semana/i.test(corpo), `${rota} inventou carga semanal`).toBe(
        false,
      );
      expect(
        /\d+\s*tentativas?/i.test(corpo),
        `${rota} inventou número de tentativas de prova`,
      ).toBe(false);
    }
  });
});

describe('/legalidade', () => {
  it('responde a pergunta do H1 logo no topo, e a resposta é "não"', async () => {
    const h = await pagina('/legalidade');
    expect(h1s(h)[0]).toContain('Psicanalista precisa de faculdade?');
    expect(contem(h, 'nao e profissao regulamentada')).toBe(true);
  });

  it('cita as duas fontes pelo nome', async () => {
    const h = await pagina('/legalidade');
    expect(contem(h, '9.394/96'), 'sumiu a LDB').toBe(true);
    expect(contem(h, 'art. 42'), 'sumiu o artigo da LDB').toBe(true);
    expect(contem(h, '2515-50'), 'sumiu o código da CBO').toBe(true);
  });

  it('separa o que a formação livre permite do que ela não permite', async () => {
    const h = await pagina('/legalidade');
    expect(contem(h, 'O que a formação livre permite')).toBe(true);
    expect(contem(h, 'O que a formação livre não permite')).toBe(true);
    // Os dois limites que mais custam caro se forem omitidos.
    expect(contem(h, 'título de psicólogo')).toBe(true);
    expect(contem(h, 'prescrever medicamento')).toBe(true);
  });

  it('diz que registro em entidade privada é voluntário, nunca licença do Estado', async () => {
    const h = await pagina('/legalidade');
    expect(contem(h, 'voluntário')).toBe(true);
    expect(contem(h, 'nunca como licença do Estado')).toBe(true);
  });

  it('não cita número de projeto de lei nenhum', async () => {
    // Só a LDB e a CBO são verificáveis daqui. "PL 3.792/2019" e afins não.
    const h = await pagina('/legalidade');
    const corpo = h.slice(h.indexOf('<main'), h.indexOf('</main>'));
    expect(/\bPL\s*n?º?\s*\d/i.test(corpo), 'apareceu um projeto de lei').toBe(false);
  });
});

describe('/como-funciona', () => {
  it('traz as seis etapas na ordem, porque a ordem é a informação', async () => {
    const h = await pagina('/como-funciona');
    const corpo = h.slice(h.indexOf('<main'), h.indexOf('</main>'));
    const etapas = [
      'Matrícula',
      'Acesso após a confirmação do pagamento',
      'Estudo por módulo',
      'Avaliação',
      'Certificado digital',
      'Registro no RNTP',
    ];
    let cursor = -1;
    for (const etapa of etapas) {
      const i = corpo.indexOf(etapa);
      expect(i, `sumiu a etapa "${etapa}"`).toBeGreaterThan(-1);
      expect(i, `a etapa "${etapa}" saiu da ordem`).toBeGreaterThan(cursor);
      cursor = i;
    }
  });

  it('diz que análise e supervisão não são etapa do percurso', async () => {
    const h = await pagina('/como-funciona');
    expect(contem(h, 'opcionais')).toBe(true);
    expect(contem(h, 'não são requisito para concluir')).toBe(true);
  });

  it('não promete QR no certificado — o que existe é código de validação', async () => {
    // `certificates.ts` grava `qrCodeMockUrl: '#'`. O que é real e verificável
    // é o código, conferido em /verificar/:code.
    const h = await pagina('/como-funciona');
    const corpo = h.slice(h.indexOf('<main'), h.indexOf('</main>'));
    expect(/\bQR\b/.test(corpo), 'prometeu QR, que hoje é mock').toBe(false);
    expect(contem(h, 'código de validação')).toBe(true);
  });
});

describe('/quem-ensina', () => {
  it('mostra o nome e a função de quem assina o conteúdo', async () => {
    const { AUTHOR } = await import('../server/public/config');
    if (AUTHOR === null) return; // sem pessoa nomeada a rota é 404, coberto abaixo
    const h = await pagina('/quem-ensina');
    expect(contem(h, AUTHOR.name)).toBe(true);
    expect(contem(h, AUTHOR.honorific)).toBe(true);
    expect(contem(h, AUTHOR.bio)).toBe(true);
  });

  it('emite o nó Person do schema.org', async () => {
    const { AUTHOR } = await import('../server/public/config');
    if (AUTHOR === null) return;
    const h = await pagina('/quem-ensina');
    expect(h).toContain('"@type":"Person"');
    expect(h).toContain(`"name":"${AUTHOR.name}"`);
  });

  it('não inventa credencial, foto nem link para quem não forneceu', async () => {
    const { AUTHOR } = await import('../server/public/config');
    if (AUTHOR === null) return;
    const h = await pagina('/quem-ensina');
    const corpo = h.slice(h.indexOf('<main'), h.indexOf('</main>'));
    if (AUTHOR.credentials.length === 0) {
      expect(contem(corpo, 'Credenciais'), 'apareceu bloco de credenciais vazio').toBe(false);
      // O erro mais grave possível aqui: atribuir formação a uma pessoa real.
      expect(/especializa|mestrado|doutorado|graduad|CRP\s*\d/i.test(corpo)).toBe(false);
    }
    if (AUTHOR.photo === '') {
      expect(/<img[^>]+alt="[^"]*Rose/i.test(corpo), 'apareceu foto que não existe').toBe(false);
    }
    if (AUTHOR.sameAs.length === 0) {
      expect(/instagram\.com|lattes|orcid/i.test(corpo), 'apareceu link inventado').toBe(false);
    }
  });

  it('404 quando não há pessoa nomeada, como o /autor faz', async () => {
    // A garantia é estrutural: a rota checa `AUTHOR_IS_PLACEHOLDER || autor === null`
    // antes de renderizar qualquer coisa, exatamente como o /autor.
    const src = await fs.readFile(path.resolve(process.cwd(), 'server/public/router.ts'), 'utf-8');
    const i = src.indexOf("publicSite.get('/quem-ensina'");
    expect(i).toBeGreaterThan(-1);
    const trecho = src.slice(i, i + 600);
    expect(trecho).toContain('AUTHOR_IS_PLACEHOLDER');
    expect(trecho).toContain('c.notFound()');
  });
});

describe('/perguntas-frequentes', () => {
  it('agrupa as perguntas nos cinco blocos', async () => {
    const h = await pagina('/perguntas-frequentes');
    for (const grupo of [
      'Antes de decidir',
      'O curso',
      'Certificado e registro',
      'Atuação',
      'Pagamento e suporte',
    ]) {
      expect(contem(h, grupo), `sumiu o grupo "${grupo}"`).toBe(true);
    }
  });

  it('emite FAQPage com uma pergunta por Question', async () => {
    const h = await pagina('/perguntas-frequentes');
    const blocos = [
      ...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g),
    ].map((m) => JSON.parse(m[1].replace(/\\u003c/g, '<')) as Record<string, unknown>);
    const faq = blocos.find((b) => b['@type'] === 'FAQPage');
    expect(faq, 'a página não emitiu FAQPage').toBeTruthy();
    const perguntas = faq!.mainEntity as Array<{ name: string; acceptedAnswer: { text: string } }>;
    expect(perguntas.length).toBeGreaterThanOrEqual(10);
    for (const p of perguntas) {
      expect(p.name.length).toBeGreaterThan(5);
      expect(p.acceptedAnswer.text.length).toBeGreaterThan(20);
      // O schema exige a resposta VISÍVEL na página — sem sanfona que depende
      // de JS, senão o que se marca não é o que se mostra.
      expect(contem(h, p.name), `"${p.name}" está no schema e não no HTML`).toBe(true);
    }
  });

  it('a resposta sobre prazo não crava um número que vive no admin', async () => {
    // Sem curso lido (o tmpDir tem courses.json vazio), a resposta remete à
    // página da formação em vez de repetir "4 a 16 meses" de cabeça.
    const h = await pagina('/perguntas-frequentes');
    expect(contem(h, 'cada curso declara o próprio prazo na página dele')).toBe(true);
  });

  it('remete à legalidade em vez de repetir a base legal pela metade', async () => {
    const h = await pagina('/perguntas-frequentes');
    expect(h).toContain('href="/legalidade"');
    expect(h).toContain('href="/como-funciona"');
  });
});

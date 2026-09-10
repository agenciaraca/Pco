/**
 * O acervo da biblioteca não pode ficar aberto na calçada.
 *
 * `GET /api/library` foi público a vida inteira, e isso era inócuo enquanto a
 * estante tinha meia dúzia de itens de semente. Em 10/set/2026 entraram **108
 * PDFs** vindos do LMS antigo — dissertações e obras de terceiros que a escola
 * distribui para quem estuda aqui — e a mesma rota passou a entregar, sem
 * token nenhum, o acervo inteiro com o **endereço direto de cada arquivo**.
 *
 * Não é vazamento de aula paga: nenhum dos 108 está marcado como obrigatório
 * nem ligado a curso, e o corpo da aula continua atrás de `courseAccessFor`. É
 * o padrão que o CLAUDE.md manda procurar — **escrita com guarda, leitura
 * sem**: `POST/PUT/DELETE /admin/library` sempre exigiu admin.
 *
 * Fechar não custou nada, e é isso que este teste trava: os **três**
 * consumidores da rota (biblioteca do aluno, episódio de podcast, tela do
 * admin) vivem dentro do app logado. Não havia página pública nenhuma lendo
 * dela — se um dia houver, este teste falha, que é o momento de decidir de
 * novo em vez de reabrir por reflexo.
 *
 * **O que isto NÃO resolve, e está escrito para ninguém superestimar:** o
 * arquivo continua servido por `/uploads` sem auth. Quem tiver o endereço
 * baixa. O que se fecha aqui é a **listagem** — deixar de publicar o catálogo
 * é diferente de trancar cada arquivo, e trancar arquivo é mudança de desenho
 * do upload (as capas de curso moram na mesma pasta e são públicas de
 * propósito).
 *
 * Daí a segunda metade: os PDFs saem do índice de busca, por **extensão** e
 * não por pasta. Sem isso, o acervo de uma escola vira uma cópia hospedada no
 * Google de obra de terceiro — que é o que atrai pedido de remoção. As
 * imagens, na mesma pasta, seguem indexáveis: capa de curso aparecendo na
 * busca de imagens ajuda a escola.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let app: { fetch: (req: Request) => Response | Promise<Response> };

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-acervo-'));
  process.env.DATA_DIR = tmpDir;
  const mod = await import('../server/app');
  app = mod.buildApp() as unknown as typeof app;
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('o catálogo da biblioteca exige login', () => {
  it('sem token, não entrega o acervo', async () => {
    const r = await app.fetch(new Request('http://x/api/library'));
    expect(r.status).toBe(401);
  });

  it('e não vaza o endereço dos arquivos no corpo do erro', async () => {
    const r = await app.fetch(new Request('http://x/api/library'));
    const texto = await r.text();
    expect(texto).not.toContain('/uploads');
  });

  it('o filtro por curso também exige login — não há porta lateral', async () => {
    // O defeito clássico é fechar a rota e esquecer que ela aceita query:
    // a mesma rota com `?courseId=` continuaria respondendo se a guarda
    // estivesse no lugar errado.
    const r = await app.fetch(new Request('http://x/api/library?courseId=c1&type=pdf'));
    expect(r.status).toBe(401);
  });

  it('a escrita continua sendo de admin, como sempre foi', async () => {
    const r = await app.fetch(
      new Request('http://x/api/admin/library', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'x', author: 'y', type: 'pdf' }),
      }),
    );
    expect(r.status).toBe(401);
  });
});

describe('o inventário de rotas públicas acompanha', () => {
  it('a biblioteca saiu da lista do que responde sem token', async () => {
    const inv = await fs.readFile(
      path.join(process.cwd(), 'test', 'rotas-publicas-inventario.test.ts'),
      'utf8',
    );
    // Se alguém reabrir a rota, o inventário exige a linha de volta — e é lá
    // que se escreve o motivo. Aqui se cobra que as duas coisas andem juntas.
    expect(inv).not.toContain("'GET /api/library'");
  });
});

describe('os PDFs do acervo saem do índice de busca', () => {
  it('o robots.txt pede para não rastrear PDF de /uploads', async () => {
    const dev = await fs.readFile(path.join(process.cwd(), 'server', 'dev.ts'), 'utf8');
    expect(dev).toContain("'Disallow: /uploads/*.pdf'");
  });

  it('o cabeçalho vale para quem chega por link direto, não só para o rastreador', async () => {
    // robots.txt é pedido; `X-Robots-Tag` é o que tira da busca o que já foi
    // rastreado. Um sem o outro deixa metade do buraco aberto.
    const dev = await fs.readFile(path.join(process.cwd(), 'server', 'dev.ts'), 'utf8');
    expect(dev).toMatch(/X-Robots-Tag/);
    expect(dev).toMatch(/noindex/);
  });

  it('a regra é por EXTENSÃO — a capa de curso na mesma pasta continua indexável', async () => {
    const dev = await fs.readFile(path.join(process.cwd(), 'server', 'dev.ts'), 'utf8');
    // Um `X-Robots-Tag` cravado em todo /uploads tiraria as imagens da vitrine
    // da busca de imagens sem ninguém decidir isso. O `.pdf` é o que separa.
    const trecho = dev.slice(dev.indexOf("root.use('/uploads/*'"));
    expect(trecho.slice(0, 600)).toContain(".pdf");
  });
});

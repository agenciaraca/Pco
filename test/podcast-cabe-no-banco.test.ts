import { describe, it, expect } from 'vitest';
import { getTableColumns } from 'drizzle-orm';
import { schema } from '../server/db/client';
import { createPodcastSchema } from '../shared/schemas';

/**
 * O defeito que não dá erro, agora para podcast.
 *
 * Três vezes o mesmo padrão nas aulas — `content`, `isPreview`, `transcripts`:
 * o campo existia no schema Zod, no formulário do admin e nas telas, e **não
 * tinha coluna na tabela**. O caminho de banco, que é produção, descartava o
 * valor ao gravar e devolvia `undefined` ao ler. O formulário salvava, a API
 * respondia 200, e o dado sumia em silêncio.
 *
 * `test/aula-cabe-no-banco.test.ts` passou a vigiar `lessons` por isso. Este
 * arquivo faz o mesmo por `podcasts`, e nasce junto com a transcrição — o
 * primeiro campo novo do podcast desde então.
 *
 * A comparação é entre o **schema Zod** (que é o contrato do que a tela manda)
 * e as **colunas do Drizzle** (que é o que o banco aceita). Divergir é
 * exatamente o defeito.
 */

/** Campos do Zod que, de propósito, não são colunas. */
const SEM_COLUNA = new Set<string>([
  // Nada, por ora. Se algum campo passar a ser derivado ou guardado em outra
  // tabela, ele entra aqui **com o motivo escrito** — senão a exceção vira o
  // esconderijo do próximo campo esquecido.
]);

describe('todo campo de podcast tem onde ser gravado', () => {
  it('o schema Zod não declara campo que a tabela não tem', () => {
    const colunas = new Set(Object.values(getTableColumns(schema.podcasts)).map((c) => c.name));
    // O Zod usa camelCase; a coluna, snake_case.
    const paraColuna = (k: string) => k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);

    const orfaos = Object.keys(createPodcastSchema.shape)
      .filter((k) => !SEM_COLUNA.has(k))
      .filter((k) => !colunas.has(paraColuna(k)));

    expect(
      orfaos,
      'estes campos são aceitos pela API e NÃO têm coluna — o valor some ao ' +
        'gravar, sem erro nenhum:\n  ' + orfaos.join('\n  '),
    ).toEqual([]);
  });

  it('a transcrição é um dos campos, e é o que motivou o arquivo', () => {
    // Guarda contra o próprio teste: se `shape` vier vazio por qualquer motivo,
    // o caso acima passaria sem ter comparado nada.
    expect(Object.keys(createPodcastSchema.shape)).toContain('transcript');
    const colunas = new Set(Object.values(getTableColumns(schema.podcasts)).map((c) => c.name));
    expect(colunas.has('transcript')).toBe(true);
  });

  it('e o repositório copia a transcrição nos dois sentidos', async () => {
    // Coluna existir não é valor atravessar: o mapeamento do caminho de banco
    // monta o objeto campo a campo, e foi assim que `active` do curso ficou de
    // fora por tanto tempo.
    const { promises: fs } = await import('node:fs');
    const path = await import('node:path');
    const fonte = await fs.readFile(
      path.join(process.cwd(), 'server', 'repositories', 'podcasts.ts'),
      'utf8',
    );
    // leitura (row → objeto)
    expect(fonte).toContain('transcript: r.transcript');
    // criação (objeto → row)
    expect(fonte).toContain('transcript: ep.transcript');
    // atualização parcial
    expect(fonte).toContain('patch.transcript !== undefined');
  });
});

describe('a tela não finge que o áudio basta', () => {
  it('sem transcrição, ela diz isso e aponta um caminho', async () => {
    const { promises: fs } = await import('node:fs');
    const path = await import('node:path');
    const s = await fs.readFile(
      path.join(process.cwd(), 'src', 'app', 'pages', 'PodcastEpisode.tsx'),
      'utf8',
    );
    expect(s).toContain('episode.transcript');
    // Silêncio diria que o áudio é suficiente. Quem depende de texto precisa
    // saber que o pedido é legítimo e para onde levá-lo.
    expect(s).toContain('ainda não tem transcrição');
    expect(s).toContain('/suporte');
  });

  it('a transcrição fica recolhida, em `<details>` nativo', async () => {
    // São milhares de palavras entre o player e o resto da página. E `details`
    // abre sem JavaScript, é anunciado pelo leitor de tela, e o navegador sabe
    // procurar dentro dele.
    const { promises: fs } = await import('node:fs');
    const path = await import('node:path');
    const s = await fs.readFile(
      path.join(process.cwd(), 'src', 'app', 'pages', 'PodcastEpisode.tsx'),
      'utf8',
    );
    expect(s).toContain('<details');
    expect(s).toContain('<summary');
  });
});

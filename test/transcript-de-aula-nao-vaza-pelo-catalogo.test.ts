import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * `semConteudoDeAula` (server/access/conteudo-aula.ts) tira `content` e
 * `videoUrl` das aulas na resposta pública de `/courses` e `/courses/:id`.
 * Ela não tira `transcripts` — a legenda/transcrição completa por idioma,
 * gravada pela migration 0017 e preenchida pelo "painel de três idiomas" do
 * admin (`PUT /admin/lessons/:id`, campo `transcripts`).
 *
 * Para um curso feito de podcasts gravados, a transcrição É o conteúdo da
 * aula em texto — ler a transcrição substitui assistir o vídeo. Ela sai da
 * mesma leitura de banco que `content` e `videoUrl` (loadFromDb, sem
 * `semCorpoDeAula`), mas nunca passou pelo filtro que os dois passam.
 *
 * Achado em auditoria de varredura (11/set/2026), a pedido do dono: "audite
 * também coisas que o aluno não pode ver e que possa estar vazando pra ele".
 * Medido contra produção em 11/set/2026: nenhuma aula tem `transcripts`
 * preenchido hoje, então a exposição real é zero — mas o caminho de código
 * está no ar, e o preenchimento de UMA transcrição a publica para qualquer
 * visitante anônimo, sem matrícula e sem login.
 */

const TRANSCRICAO = 'TRANSCRICAO SECRETA DA AULA PAGA PALAVRA POR PALAVRA';

let tmpDir: string;
let app: { fetch: (req: Request) => Response | Promise<Response> };

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-transcript-leak-'));
  process.env.DATA_DIR = tmpDir;
  process.env.INITIAL_STUDENT_PASSWORD = 'TesteAluno!2026';
  process.env.INITIAL_ADMIN_PASSWORD = 'TesteAdmin!2026';

  await fs.writeFile(
    path.join(tmpDir, 'courses.json'),
    JSON.stringify(
      [
        {
          id: 'c-pub',
          slug: 'c-pub',
          title: 'Curso Publico',
          shortTitle: 'Curso Publico',
          description: 'ementa',
          coverColor: 'x',
          totalHours: 1,
          certificateAvailable: false,
          active: true,
          tags: [],
          modules: [
            {
              id: 'm1',
              courseId: 'c-pub',
              title: 'Mod 1',
              order: 1,
              lessons: [
                {
                  id: 'l1',
                  courseId: 'c-pub',
                  moduleId: 'm1',
                  title: 'Aula 1',
                  description: 'resumo',
                  durationMinutes: 10,
                  order: 1,
                  isMandatory: true,
                  status: 'published',
                  content: '<p>apostila secreta paga</p>',
                  videoUrl: 'https://player.vimeo.com/video/999',
                  transcripts: { pt: TRANSCRICAO },
                },
              ],
            },
          ],
        },
      ],
      null,
      2,
    ),
    'utf8',
  );

  const mod = await import('../server/app');
  app = mod.buildApp();
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

async function pegar(url: string): Promise<string> {
  const res = await app.fetch(new Request(`http://local${url}`));
  return await res.text();
}

describe('transcrição de aula não vaza pelo catálogo público', () => {
  it('GET /courses (anônimo) não traz a transcrição', async () => {
    const body = await pegar('/api/courses');
    expect(body).not.toContain(TRANSCRICAO);
  });

  it('GET /courses/:id (anônimo) não traz a transcrição', async () => {
    const body = await pegar('/api/courses/c-pub');
    expect(body).not.toContain(TRANSCRICAO);
  });

  it('a chave `transcripts` some, em vez de vir presente', async () => {
    const body = await pegar('/api/courses/c-pub');
    const co = JSON.parse(body) as {
      modules: Array<{ lessons: Array<Record<string, unknown>> }>;
    };
    const aula = co.modules[0]!.lessons[0]!;
    expect('transcripts' in aula).toBe(false);
  });
});

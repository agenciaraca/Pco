import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * PRIV2-003 · o export dizia "todos os seus dados" e entregava seis categorias.
 *
 * `GET /me/export` devolvia perfil, progresso, anotações de aula, engajamento
 * de podcast, histórico do tutor e certificados. Seis, de mais de vinte — e a
 * tela do perfil dizia, com todas as letras, "todos os seus dados pessoais".
 *
 * As três que mais faltavam eram exatamente aquelas que o titular **não vê em
 * nenhum outro lugar do produto**:
 *
 * - **risco de evasão** — um score de 0 a 100 com as razões escritas;
 * - **notas da coordenação** sobre ele;
 * - **planos de recuperação** gerados a seu respeito.
 *
 * São juízos sobre a pessoa, feitos sem que ela saiba, e é precisamente esse
 * tipo de dado que o direito de acesso existe para alcançar (LGPD, art. 18,
 * II). Entregar seis categorias dizendo "todos" é pior do que não ter a
 * função: dá ao titular a impressão de que ele já viu tudo, e ele para de
 * procurar.
 *
 * ## O que este arquivo cobra
 *
 * Um **inventário nomeado**, no mesmo molde de
 * `test/rotas-publicas-inventario.test.ts` e de `SEM_COLUNA_POR_DECISAO`.
 * Categoria nova de dado pessoal precisa entrar na rota **e** aqui — ou ser
 * declarada fora do escopo, com o motivo escrito.
 *
 * A comparação é nos **dois sentidos**: chave que sai da rota sem sair daqui
 * também falha. Foi assim que a lista negra de `numeros-do-site` apodreceu.
 */

let tmpDir: string;
let alunoId: string;
let app: { fetch: (req: Request) => Response | Promise<Response> };
let token: string;

/**
 * O que a exportação precisa entregar, e por que cada uma está aqui.
 *
 * Só entram categorias que guardam **dado pessoal do titular**. Configuração da
 * escola, catálogo de cursos e conteúdo de aula não são dele e não entram.
 */
const CATEGORIAS: Record<string, string> = {
  exportedAt: 'Carimbo da exportação — sem ele o titular não sabe de quando é o retrato.',
  user: 'A conta dele: nome, e-mail, papel e datas de criação e último acesso.',
  student: 'A ficha de aluno, com matrículas e a situação de cada uma.',
  progress: 'Quais aulas ele concluiu, em que curso e em que data.',
  lessonNotes: 'As anotações que ele escreveu nas aulas.',
  podcastEngagement: 'Quais episódios ele ouviu, e quanto de cada um.',
  tutorHistory: 'As conversas dele com o tutor de IA.',
  certificates: 'Os certificados emitidos em nome dele, com código de validação.',
  orders: 'O que ele comprou, com valor e situação.',
  sessionBookings: 'As sessões que ele agendou, com profissional, data e valor.',
  supportTickets: 'Os chamados de suporte que ele abriu, com assunto e mensagem.',
  notifications: 'Os avisos que a escola mandou para ele.',
  achievements: 'As conquistas e medalhas que ele acumulou, com a data de cada uma.',
  watchTime: 'Quanto tempo ele assistiu de cada aula.',
  forumAndComments: 'Os comentários que ele escreveu dentro das aulas.',
  forum:
    'As perguntas e respostas dele no fórum dos cursos. É categoria à parte porque é ' +
    'outro store — e foi por `forumAndComments` ter nome de cobrir os dois que o ' +
    'fórum ficou fora daqui e do expurgo até 5/set/2026.',
  courseReviews: 'As avaliações e comentários que ele deixou nos cursos.',
  retentionRisk:
    'O índice de risco de evasão e as razões. **Juízo sobre ele, feito sem que ele saiba** ' +
    'e invisível em qualquer outra tela — é o caso central do direito de acesso.',
  adminNotesAboutMe:
    'O que a coordenação anotou a respeito dele. Mesmo motivo do risco: é sobre a pessoa, ' +
    'e ela não tem outro caminho para ver.',
  recoveryPlans:
    'Os planos de retomada gerados a respeito dele, com diagnóstico e mensagem sugerida.',
};

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-export-'));
  process.env.DATA_DIR = tmpDir;
  process.env.INITIAL_STUDENT_PASSWORD = 'TesteAluno!2026';
  const mod = await import('../server/app');
  app = mod.buildApp();

  const res = await app.fetch(
    new Request('http://local/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'aluno@pco.local', password: 'TesteAluno!2026' }),
    }),
  );
  token = ((await res.json()) as { token: string }).token;
  // O id da conta é o `sub` do próprio token — é ele que a rota usa para
  // procurar as notas, e não há outro caminho para descobri-lo aqui.
  alunoId = JSON.parse(
    Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
  ).sub as string;
});

afterAll(async () => {
  if (!tmpDir) return;
  const { drenarEscritasPendentes } = await import('../server/db/json-store');
  await drenarEscritasPendentes();
  for (let t = 0; t < 5; t++) {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
});

async function exportar(): Promise<Record<string, unknown>> {
  const res = await app.fetch(
    new Request('http://local/api/me/export', {
      headers: { Authorization: `Bearer ${token}` },
    }),
  );
  expect(res.status).toBe(200);
  return (await res.json()) as Record<string, unknown>;
}

describe('a exportação entrega o que a tela promete', () => {
  it('nenhuma categoria do inventário está faltando', async () => {
    const dump = await exportar();
    const faltando = Object.keys(CATEGORIAS).filter((k) => !(k in dump));
    expect(
      faltando,
      'a tela do perfil diz "todos os seus dados pessoais" — estas categorias ' +
        'não estão no arquivo:\n  ' + faltando.join('\n  '),
    ).toEqual([]);
  });

  it('nenhuma categoria sai da rota sem estar no inventário', async () => {
    // Nos dois sentidos, de propósito: chave nova na rota precisa passar por
    // aqui, que é onde alguém escreve por que aquele dado é do titular.
    const dump = await exportar();
    const naoInventariadas = Object.keys(dump).filter((k) => !(k in CATEGORIAS));
    expect(naoInventariadas).toEqual([]);
  });

  it('as três que o titular não vê em outro lugar estão lá', async () => {
    // Nomeadas à parte porque são o motivo do achado, e porque são as
    // primeiras que alguém removeria por parecerem "internas".
    const dump = await exportar();
    for (const chave of ['retentionRisk', 'adminNotesAboutMe', 'recoveryPlans']) {
      expect(dump, `${chave} é juízo sobre a pessoa e precisa estar na exportação`).toHaveProperty(
        chave,
      );
    }
  });

  it('a nota da coordenação sai sem o e-mail de quem escreveu', async () => {
    // PRIV3-702. O conteúdo da nota é sobre o titular e por isso sai. A
    // identidade de quem escreveu é dado pessoal de um terceiro — o
    // funcionário —, e o direito de acesso alcança o que se diz a respeito de
    // alguém, não quem disse. O efeito prático de entregar o e-mail também é
    // conhecido: nota franca sobre inadimplência ou desempenho vira, para quem
    // lê, o nome de um colega para cobrar.
    const notas = await import('../server/admin/notes-store');
    await notas.createNote({
      studentId: alunoId,
      authorId: 'user-coord',
      authorEmail: 'coordenacao@psicanaliseclinica.online',
      body: 'Aluno pediu prazo extra por motivo de saúde.',
    });

    const dump = (await exportar()) as Record<string, unknown>;
    const saiu = dump.adminNotesAboutMe as Array<Record<string, unknown>>;
    expect(saiu.length).toBeGreaterThan(0);
    // O que a pessoa tem direito de ler.
    expect(saiu[0].body).toContain('prazo extra');
    // O que não é dela.
    expect(saiu[0]).not.toHaveProperty('authorEmail');
    expect(saiu[0]).not.toHaveProperty('authorId');
    expect(JSON.stringify(dump)).not.toContain('coordenacao@psicanaliseclinica.online');
  });

  it('todo motivo é uma frase, não um carimbo', () => {
    for (const [chave, motivo] of Object.entries(CATEGORIAS)) {
      expect(motivo.trim().length, `motivo curto demais para "${chave}"`).toBeGreaterThan(25);
    }
  });

  it('o arquivo baixa como anexo, com nome', async () => {
    const res = await app.fetch(
      new Request('http://local/api/me/export', {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    expect(res.headers.get('Content-Disposition')).toContain('attachment');
    expect(res.headers.get('Content-Type')).toContain('application/json');
  });

  it('sem token não exporta nada', async () => {
    const res = await app.fetch(new Request('http://local/api/me/export'));
    expect(res.status).toBe(401);
  });
});

describe('a tela não promete mais do que a rota entrega', () => {
  it('o texto do perfil cita as três categorias sensíveis', async () => {
    // O defeito não era só a rota: era a distância entre o que ela entregava e
    // o que a tela afirmava. Corrigir só um lado deixaria a mentira de pé.
    const tela = await fs.readFile(
      path.resolve(process.cwd(), 'src/app/pages/Profile.tsx'),
      'utf-8',
    );
    expect(tela).toContain('risco de evasão');
    expect(tela).toContain('anotações da coordenação');
    expect(tela).toContain('planos de retomada');
  });
});

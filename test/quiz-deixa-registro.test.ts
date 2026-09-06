import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * O quiz corrigia a prova e não guardava nada.
 *
 * `POST /me/quiz/:courseId/grade` calculava a nota, devolvia `passed` e a
 * conversa acabava ali. Nenhuma tentativa era registrada — para nenhum aluno,
 * em nenhum curso, desde sempre.
 *
 * O que isso significava, e nada disso aparecia como erro:
 *
 * - **A escola não conseguia responder se alguém foi avaliado.** Num LMS.
 * - O aluno que fechasse a aba perdia a nota, e não tinha onde reencontrá-la.
 * - Ninguém podia apoiar o certificado em desempenho nem se quisesse: não havia
 *   dado. O certificado sai de contagem de cliques em aula obrigatória, e esta
 *   lacuna é a razão técnica de aquela regra ser a única possível.
 * - O `/me/export` da LGPD não entregava avaliação nenhuma — corretamente, já
 *   que não havia o que entregar.
 *
 * ## O que este arquivo cobra
 *
 * Que a tentativa fica; que **toda** tentativa fica, inclusive a reprovada e a
 * repetida; e que o texto da dissertativa **não** fica.
 */

const criados: string[] = [];
let attempts: typeof import('../server/repositories/quiz-attempts');

beforeEach(async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-quiz-'));
  criados.push(dir);
  process.env.DATA_DIR = dir;
  vi.resetModules();
  attempts = await import('../server/repositories/quiz-attempts');
});

afterAll(async () => {
  const { drenarEscritasPendentes } = await import('../server/db/json-store');
  await drenarEscritasPendentes();
  for (const d of criados) await fs.rm(d, { recursive: true, force: true }).catch(() => {});
});

async function tentativa(pct: number, moduleId: string | null = 'm-1', userId = 'u-1') {
  return await attempts.registrar({
    userId,
    courseId: 'c-1',
    moduleId,
    pct,
    passingScore: 70,
    passed: pct >= 70,
    total: 10,
    acertos: Math.round(pct / 10),
    pendentes: 0,
    questoes: [{ questionId: 'q-1', correct: pct >= 70 }],
  });
}

describe('a tentativa fica registrada', () => {
  it('e a escola consegue dizer quem foi avaliado', async () => {
    await tentativa(80);
    const doAluno = await attempts.listForUser('u-1');
    expect(doAluno).toHaveLength(1);
    expect(doAluno[0]!.passed).toBe(true);
    expect(doAluno[0]!.passingScore, 'a nota de corte da época tem de ficar').toBe(70);

    const doCurso = await attempts.listForCourse('c-1');
    expect(doCurso).toHaveLength(1);
  });

  it('toda tentativa fica — inclusive a reprovada e a repetida', async () => {
    // Guardar só a melhor apagaria o histórico de esforço, que é justamente o
    // que mostra à coordenação quem está travado.
    await tentativa(30);
    await tentativa(50);
    await tentativa(90);
    const todas = await attempts.listForUser('u-1');
    expect(todas).toHaveLength(3);
    expect(todas.filter((a) => a.passed)).toHaveLength(1);
  });

  it('a melhor é calculada na hora, e "nunca tentou" não é zero', async () => {
    // Reprovar quem não fez é outra decisão, e tem de ser tomada por quem a
    // escreve — não herdada de um zero inventado aqui.
    expect(attempts.melhorDe([], 'm-1')).toBeNull();

    await tentativa(30);
    await tentativa(90);
    const lista = await attempts.listForUser('u-1');
    expect(attempts.melhorDe(lista, 'm-1')?.pct).toBe(90);
    expect(attempts.melhorDe(lista, 'm-outro')).toBeNull();
  });

  it('a nota de corte é a da época, não a de hoje', async () => {
    // O admin pode mudar a nota de corte depois. Recalcular aprovação com a
    // regra nova reescreveria o resultado de uma prova já feita.
    const a = await attempts.registrar({
      userId: 'u-1',
      courseId: 'c-1',
      moduleId: 'm-1',
      pct: 65,
      passingScore: 60,
      passed: true,
      total: 10,
      acertos: 6,
      pendentes: 0,
      questoes: [],
    });
    expect(a.passed).toBe(true);
    expect(a.passingScore).toBe(60);
  });

  it('cada aluno só vê o que é dele', async () => {
    await tentativa(80, 'm-1', 'u-1');
    await tentativa(40, 'm-1', 'u-2');
    expect(await attempts.listForUser('u-1')).toHaveLength(1);
    expect((await attempts.listForUser('u-1'))[0]!.pct).toBe(80);
  });

  it('o expurgo apaga as dele, e só as dele', async () => {
    await tentativa(80, 'm-1', 'u-1');
    await tentativa(40, 'm-1', 'u-2');
    expect(await attempts.clearForUser('u-1')).toBe(1);
    expect(await attempts.listForUser('u-1')).toHaveLength(0);
    expect(await attempts.listForUser('u-2')).toHaveLength(1);
  });
});

describe('o que NÃO é guardado, e é decisão', () => {
  it('o texto da resposta dissertativa não entra no registro', async () => {
    // O registro existe para provar que houve avaliação e com que desempenho.
    // Arquivar a redação aumentaria a superfície de dado pessoal sem servir a
    // essa finalidade — e seria uma decisão nova, com retenção declarada.
    const fonte = await fs.readFile(
      path.join(process.cwd(), 'server', 'repositories', 'quiz-attempts.ts'),
      'utf8',
    );
    expect(fonte).not.toMatch(/textAnswer|texto.*resposta.*:\s*string/);
    const a = await tentativa(80);
    expect(JSON.stringify(a)).not.toContain('textAnswer');
  });

  it('`correct: null` sobrevive — é "não deu para corrigir", não "errou"', async () => {
    // Achatar em `false` diria ao aluno que ele não sabe por causa de uma
    // configuração que falta do lado da escola.
    const a = await attempts.registrar({
      userId: 'u-1',
      courseId: 'c-1',
      moduleId: 'm-1',
      pct: 100,
      passingScore: 70,
      passed: true,
      total: 1,
      acertos: 1,
      pendentes: 1,
      questoes: [
        { questionId: 'q-1', correct: true },
        { questionId: 'q-2', correct: null },
      ],
    });
    expect(a.questoes.find((q) => q.questionId === 'q-2')?.correct).toBeNull();
    expect(a.pendentes).toBe(1);
  });
});

describe('a rota grava, e falhar ao gravar não derruba a correção', () => {
  it('o handler registra a tentativa', async () => {
    const app = await fs.readFile(path.join(process.cwd(), 'server', 'app.ts'), 'utf8');
    const i = app.indexOf("app.post('/me/quiz/:courseId/grade'");
    expect(i).toBeGreaterThan(0);
    const bloco = app.slice(i, app.indexOf('// ---------- Banco de questões', i));
    expect(bloco).toContain('quizAttempts');
    expect(bloco).toContain('.registrar({');
  });

  it('e o erro do registro não vira erro da prova', async () => {
    // O aluno já respondeu. Perder a nota dele por causa da gravação seria
    // trocar um problema por um pior.
    const app = await fs.readFile(path.join(process.cwd(), 'server', 'app.ts'), 'utf8');
    const i = app.indexOf('.registrar({');
    const bloco = app.slice(i, i + 1200);
    expect(bloco).toMatch(/\.catch\(/);
    expect(bloco).toContain('[quiz]');
  });

  it('o aluno tem onde reencontrar a nota, e o admin tem onde olhar', async () => {
    const app = await fs.readFile(path.join(process.cwd(), 'server', 'app.ts'), 'utf8');
    expect(app).toContain("'/me/quiz/:courseId/attempts'");
    expect(app).toContain("'/admin/courses/:id/quiz-attempts'");
  });
});

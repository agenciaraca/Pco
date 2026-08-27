import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * Escrever guardado, ler aberto — e uma exclusão sem dono.
 *
 * `DELETE /forum/replies/:id` não verificava nada até 27/ago/2026: qualquer
 * aluno autenticado apagava a resposta de qualquer pessoa, em qualquer curso.
 * As duas rotas vizinhas — excluir thread e marcar resolvido — sempre checaram
 * autor ou admin. Foi a inconsistência entre vizinhas que deixou passar.
 *
 * `GET /lessons/:id/comments` tinha o outro formato do mesmo problema: o POST
 * ao lado verificava matrícula e prazo; o GET não verificava nada, e
 * comentário de aula carrega nome de aluno e discussão de curso pago.
 */

let tmpDir: string;
let app: { fetch: (req: Request) => Response | Promise<Response> };
let forum: typeof import('../server/forum/store');
let tokenAluno: string;
let alunoId: string;

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-forum-'));
  process.env.DATA_DIR = tmpDir;
  process.env.INITIAL_STUDENT_PASSWORD = 'TesteAluno!2026';

  const mod = await import('../server/app');
  app = mod.buildApp();
  forum = await import('../server/forum/store');

  const login = await app.fetch(
    new Request('http://local/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'aluno@pco.local', password: 'TesteAluno!2026' }),
    }),
  );
  tokenAluno = ((await login.json()) as { token: string }).token;
  const eu = (await (
    await app.fetch(
      new Request('http://local/api/auth/me', {
        headers: { Authorization: `Bearer ${tokenAluno}` },
      }),
    )
  ).json()) as { id?: string; sub?: string };
  alunoId = eu.id ?? eu.sub!;
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('excluir resposta do fórum', () => {
  it('a resposta de outra pessoa não é apagada por um aluno comum', async () => {
    const thread = await forum.createThread({
      courseId: 'c-psi',
      authorId: 'outra-pessoa',
      authorName: 'Outra Pessoa',
      kind: 'pergunta' as const,
      title: 'Dúvida sobre transferência',
      body: 'Alguém pode explicar?',
    });
    const reply = await forum.createReply({
      threadId: thread.id,
      authorId: 'outra-pessoa',
      authorName: 'Outra Pessoa',
      body: 'Resposta que não é minha para apagar.',
    });
    // `createReply` devolve null quando a thread não existe; sem esta linha o
    // teste morreria no acesso a `.id` em vez de dizer o que faltou.
    expect(reply, 'a resposta precisa ter sido criada').not.toBeNull();

    const res = await app.fetch(
      new Request(`http://local/api/forum/replies/${reply!.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenAluno}` },
      }),
    );
    expect(res.status).toBe(403);

    // E continua existindo — 403 que apaga não é 403.
    expect(await forum.getReply(reply!.id)).not.toBeNull();
  });

  it('a própria resposta é apagada', async () => {
    const thread = await forum.createThread({
      courseId: 'c-psi',
      authorId: alunoId,
      authorName: 'Aluno Demo',
      kind: 'pergunta' as const,
      title: 'Minha thread',
      body: 'Texto',
    });
    const minha = await forum.createReply({
      threadId: thread.id,
      authorId: alunoId,
      authorName: 'Aluno Demo',
      body: 'Resposta minha.',
    });
    expect(minha, 'a resposta precisa ter sido criada').not.toBeNull();

    const res = await app.fetch(
      new Request(`http://local/api/forum/replies/${minha!.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenAluno}` },
      }),
    );
    expect(res.status).toBe(200);
    expect(await forum.getReply(minha!.id)).toBeNull();
  });

  it('sem token não apaga nada', async () => {
    const thread = await forum.createThread({
      courseId: 'c-psi',
      authorId: 'outra-pessoa',
      authorName: 'Outra Pessoa',
      kind: 'pergunta' as const,
      title: 'Outra',
      body: 'Texto',
    });
    const reply = await forum.createReply({
      threadId: thread.id,
      authorId: 'outra-pessoa',
      authorName: 'Outra Pessoa',
      body: 'Resposta.',
    });
    expect(reply, 'a resposta precisa ter sido criada').not.toBeNull();

    const res = await app.fetch(
      new Request(`http://local/api/forum/replies/${reply!.id}`, { method: 'DELETE' }),
    );
    expect(res.status).toBe(401);
    expect(await forum.getReply(reply!.id)).not.toBeNull();
  });
});

describe('ler o fórum e os comentários exige o mesmo que escrever', () => {
  it('as threads do curso não são lidas sem token', async () => {
    const res = await app.fetch(new Request('http://local/api/courses/c-psi/forum/threads'));
    expect(res.status).toBe(401);
  });

  it('comentários da aula exigem matrícula, como o comentar já exigia', async () => {
    // O aluno-semente não está matriculado em nada neste ambiente.
    const res = await app.fetch(
      new Request('http://local/api/lessons/l-psi-1/comments', {
        headers: { Authorization: `Bearer ${tokenAluno}` },
      }),
    );
    expect([403, 404]).toContain(res.status);
  });

  it('aula que não existe falha fechada, não aberta', async () => {
    const res = await app.fetch(
      new Request('http://local/api/lessons/aula-inexistente/comments', {
        headers: { Authorization: `Bearer ${tokenAluno}` },
      }),
    );
    expect(res.status).toBe(404);
  });
});

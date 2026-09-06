import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * O expurgo rodava sobre um titular que não existia.
 *
 * `test/expurgo-cobre-o-que-exporta.test.ts` chama `expurgarTitular` com
 * `'u-inexistente'`. Isso cobre bem o que se propõe a cobrir — que toda
 * categoria tem rotina, que ensaio não trata nada, que retido não é apagado —
 * e **não prova que alguma coisa é apagada**: com titular inexistente,
 * `encontrados` é 0 em tudo, e uma rotina que não fizesse nada passaria igual.
 *
 * Aqui há uma pessoa com dado real em cada canto, e as asserções são sobre o
 * que **sobrou** depois. Três achados de auditoria moram neste arquivo:
 *
 * 1. **O CPF sobrevivia.** A anonimização chamava `updateUser`, e o
 *    `UpdateInput` dele nem declara `document` — passar o campo não compilaria.
 *    Depois de a escola registrar a exclusão como concluída, uma busca por CPF
 *    ainda achava a conta, exibindo "Titular removido" **ao lado do CPF real**.
 *    CPF reidentifica um brasileiro sozinho.
 * 2. **O agendamento não tinha caminho de banco.** Era a única função do
 *    `bookings-repo` sem `bancoSeTabelaExiste`, e em produção há banco: a linha
 *    de `session_bookings` seguia com o e-mail do titular em texto puro, ligado
 *    ao horário, ao profissional e ao valor.
 * 3. **O fórum não estava em lugar nenhum** — nem na exportação nem no expurgo.
 *    A categoria `forumAndComments` lia só os comentários de aula.
 */

let tmpDir: string;
let expurgo: typeof import('../server/privacy/expurgo');
let usersStore: typeof import('../server/auth/users-store');
let forum: typeof import('../server/forum/store');
let notes: typeof import('../server/repositories/lesson-notes');
let emailLogs: typeof import('../server/notifications/log-store');

let userId: string;
const CPF = '39053344705'; // válido no dígito verificador, e de teste

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-expurgo-real-'));
  process.env.DATA_DIR = tmpDir;
  delete process.env.AUTH_STORE;

  usersStore = await import('../server/auth/users-store');
  expurgo = await import('../server/privacy/expurgo');
  forum = await import('../server/forum/store');
  notes = await import('../server/repositories/lesson-notes');
  emailLogs = await import('../server/notifications/log-store');

  const u = await usersStore.createUser({
    email: 'titular@exemplo.test',
    name: 'Maria Titular',
    role: 'student',
    password: 'senha-de-teste-1234',
    document: CPF,
  });
  userId = u.id;

  await notes.upsertNote(userId, 'l-1', 'anotação minha');

  // Um e-mail enviado para ela, e outro para terceiro — o segundo tem de
  // sobreviver.
  await emailLogs.pushLog({
    configId: 'c1',
    provider: 'mock',
    to: 'titular@exemplo.test',
    subject: 'Sua matrícula foi confirmada',
    status: 'sent',
  });
  await emailLogs.pushLog({
    configId: 'c1',
    provider: 'mock',
    to: 'outra@exemplo.test',
    subject: 'Nada a ver',
    status: 'sent',
  });

  await forum.createThread({
    courseId: 'c-1',
    authorId: userId,
    authorName: 'Maria Titular',
    title: 'Dúvida sobre a aula 3',
    body: 'não entendi a parte final',
    kind: 'pergunta',
  });
  // E uma curtida em conteúdo de outra pessoa: é dado do titular guardado numa
  // linha que não é dele, e é o que se esquece de limpar.
  const deOutro = await forum.createThread({
    courseId: 'c-1',
    authorId: 'u-outro',
    authorName: 'Outro Aluno',
    title: 'Tópico de terceiro',
    body: 'texto',
    kind: 'pergunta',
  });
  await forum.likeThread(deOutro.id, userId);
});

afterAll(async () => {
  const { drenarEscritasPendentes } = await import('../server/db/json-store');
  await drenarEscritasPendentes();
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
});

describe('o ensaio encontra o que existe — e não é zero', () => {
  it('conta os registros reais do titular sem tocar em nada', async () => {
    const r = await expurgo.expurgarTitular(userId);
    expect(r.executou).toBe(false);

    const por = new Map(r.itens.map((i) => [i.categoria, i]));
    expect(por.get('user')?.encontrados, 'a conta não foi encontrada').toBe(1);
    expect(por.get('lessonNotes')?.encontrados).toBe(1);
    expect(por.get('forum')?.encontrados, 'o fórum ficou de fora do expurgo').toBe(1);

    // O ensaio não pode ter apagado nada.
    expect((await usersStore.findUserByDocument(CPF))?.id).toBe(userId);
    expect((await forum.listForUser(userId)).threads).toHaveLength(1);
  });
});

describe('depois do commit, o que reidentifica a pessoa não está mais lá', () => {
  beforeAll(async () => {
    const r = await expurgo.expurgarTitular(userId, { commit: true });
    expect(r.executou).toBe(true);
    const falhas = r.itens.filter((i) => i.erro);
    expect(r.completo, 'categoria com erro: ' + JSON.stringify(falhas)).toBe(true);
  });

  it('o CPF não acha mais a conta', async () => {
    // O achado central: a busca por documento é indexada e normaliza; enquanto
    // o CPF ficasse gravado, "Titular removido" aparecia ao lado dele.
    expect(await usersStore.findUserByDocument(CPF)).toBeNull();
    const bruto = await usersStore.findRawById(userId);
    expect(bruto?.document ?? null).toBeNull();
  });

  it('a credencial vai junto: hash de senha e material de 2FA', async () => {
    // `active: false` fecha o portão no middleware — e fechar acesso não é
    // apagar dado. Hash de senha é derivado de um segredo que a pessoa
    // costuma reusar; a semente TOTP é material do aparelho dela.
    const bruto = await usersStore.findRawById(userId);
    expect(bruto?.passwordHash).toBe('');
    expect(bruto?.totpSecretEncrypted ?? null).toBeNull();
    expect(bruto?.active).toBe(false);
    expect(bruto?.name).toBe('Titular removido');
  });

  it('o pseudônimo não é um pedaço do id que ele deveria dissociar', async () => {
    const bruto = await usersStore.findRawById(userId);
    expect(bruto?.email).toMatch(/^removido-[0-9a-f]{10}@invalido\.local$/);
    expect(bruto?.email).not.toContain(userId.slice(-6));
  });

  it('a anotação de aula foi apagada, não anonimizada', async () => {
    expect(await notes.listForUser(userId)).toHaveLength(0);
  });

  it('o fórum perdeu a autoria e a curtida em tópico de terceiro', async () => {
    const meus = await forum.listForUser(userId);
    expect(meus.threads, 'o tópico ainda está ligado ao titular').toHaveLength(0);

    const todos = await forum.listThreads('c-1');
    // Os tópicos continuam de pé: apagar arrancaria também a resposta de quem
    // respondeu. O que sai é o vínculo.
    expect(todos).toHaveLength(2);
    for (const t of todos) {
      expect(t.authorId).not.toBe(userId);
      expect(t.reactions.likedBy).not.toContain(userId);
      // A contagem acompanha a lista, senão fica um a mais para sempre.
      expect(t.reactions.likes).toBe(t.reactions.likedBy.length);
    }
  });

  it('o agendamento tem caminho de banco, e não só de JSON', async () => {
    // Era a única função do arquivo sem `bancoSeTabelaExiste` — e produção tem
    // banco. Sem o ramo, o `user_email` do titular sobrevivia à exclusão.
    const fonte = await fs.readFile(
      path.join(process.cwd(), 'server', 'sessions', 'bookings-repo.ts'),
      'utf8',
    );
    const i = fonte.indexOf('export async function anonimizarParaUsuario');
    expect(i).toBeGreaterThan(0);
    const bloco = fonte.slice(i);
    expect(bloco).toContain("bancoSeTabelaExiste('session_bookings')");
    expect(bloco).toContain('userEmail');
    // E o `studentName` que estava sendo gravado não existe no tipo nem na
    // coluna: era campo fantasma.
    expect(bloco).not.toContain('studentName');
  });

  it('a fila de e-mails perde os dele, e só os dele', async () => {
    /*
      **A ordem importa, e é o defeito que este caso trava.**

      A fila é chaveada pelo endereço, não pelo `userId` — quem escreve nela é o
      remetente, que só conhece o e-mail. E a categoria `user` **troca** esse
      endereço pela marca anônima. Se o expurgo lesse o e-mail depois de
      anonimizar a conta, procuraria por `removido-...@invalido.local` e não
      acharia nada: o relatório diria "0 encontrados" sobre uma fila cheia, e
      ninguém teria como desconfiar.
    */
    expect(await emailLogs.listForEmail('titular@exemplo.test')).toHaveLength(0);
    expect(await emailLogs.listForEmail('outra@exemplo.test')).toHaveLength(1);
  });

  it('o log de auditoria é retido, e com o motivo escrito', async () => {
    // Apagá-lo destruiria a prova de que a exclusão foi executada — que é
    // justamente o documento que o titular pode vir a cobrar.
    const { DECISOES } = await import('../server/privacy/expurgo');
    const d = DECISOES.find((x) => x.categoria === 'auditLog');
    expect(d?.destino).toBe('reter');
    expect(d?.motivo ?? '').toMatch(/segurança|LGPD/i);
  });

  it('rodar de novo é inofensivo, e dá o mesmo pseudônimo', async () => {
    const antes = (await usersStore.findRawById(userId))?.email;
    const r = await expurgo.expurgarTitular(userId, { commit: true });
    expect(r.completo).toBe(true);
    expect((await usersStore.findRawById(userId))?.email).toBe(antes);
  });
});

describe('erro numa categoria não pode sair como "nada encontrado"', () => {
  it('`contar` propaga a falha em vez de devolver lista vazia', async () => {
    // Com `catch { return [] }`, store fora do ar produzia `encontrados: 0`
    // **sem** `erro`, e `completo` dizia `true`. No ensaio, "não consegui
    // olhar" era impresso igual a "não havia nada" — e é sobre o ensaio que
    // alguém decide autorizar a execução.
    const fonte = await fs.readFile(
      path.join(process.cwd(), 'server', 'privacy', 'expurgo.ts'),
      'utf8',
    );
    const i = fonte.indexOf('async function contar');
    const bloco = fonte.slice(i, i + 260);
    expect(bloco).not.toMatch(/catch\s*\{\s*return \[\];/);
  });

  it('categoria que falha derruba `completo`', async () => {
    const r = await expurgo.expurgarTitular(userId);
    // Nenhuma falha agora — mas a regra tem de ser esta, e é o que `completo`
    // significa.
    expect(r.completo).toBe(r.itens.every((i) => !i.erro));
  });
});

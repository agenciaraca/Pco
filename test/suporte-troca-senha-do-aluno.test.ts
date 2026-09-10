/**
 * O suporte troca a senha pela ficha do aluno — não pela tela de contas.
 *
 * A capacidade existia em `PUT /admin/users/:id/password` e continua lá. O que
 * faltava era ela estar **onde o suporte trabalha**: quem atende abre a ficha
 * do aluno, e mandá-lo procurar a conta noutra tela pelo e-mail é fricção que
 * custa atendimento. O público desta escola é 50+, e o "esqueci minha senha" é
 * justamente o passo em que muita gente desiste e liga.
 *
 * **A ficha e a conta são coisas diferentes, e é aqui que isto pode morder.**
 * Produção tem 418 contas com login e sem ficha; o contrário também existe —
 * ficha importada de titular que nunca teve conta. Por isso a busca tem dois
 * caminhos (e-mail primeiro, id depois) e o "não achei" **não é um erro
 * genérico**: é a informação de que aquele aluno não tem por onde entrar, que
 * é o que o atendente precisa para saber o que dizer à pessoa.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let app: { fetch: (req: Request) => Response | Promise<Response> };

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-senha-'));
  process.env.DATA_DIR = tmpDir;
  const mod = await import('../server/app');
  app = mod.buildApp() as unknown as typeof app;
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

const ler = (p: string) => fs.readFile(path.join(process.cwd(), p), 'utf8');

describe('a rota existe e é de administração', () => {
  it('sem token não troca senha de ninguém', async () => {
    const r = await app.fetch(
      new Request('http://x/api/admin/students/qualquer/password', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: 'senhanova123' }),
      }),
    );
    expect(r.status).toBe(401);
  });

  it('e o inventário de rotas públicas não a lista', async () => {
    const inv = await ler('test/rotas-publicas-inventario.test.ts');
    expect(inv).not.toContain('students/:id/password');
  });
});

describe('as regras que a rota tem de respeitar', () => {
  it('resolve a conta pelo e-mail E pelo id — a ficha nem sempre é a conta', async () => {
    const src = await ler('server/app.ts');
    const i = src.indexOf(`'/admin/students/:id/password'`);
    expect(i, 'a rota não existe').toBeGreaterThan(0);
    const rota = src.slice(i, i + 3000);
    expect(rota).toContain('findUserByEmail');
    expect(rota).toContain('findRawById');
  });

  it('aluno sem conta recebe um motivo, não um 404 mudo', async () => {
    const src = await ler('server/app.ts');
    const i = src.indexOf(`'/admin/students/:id/password'`);
    const rota = src.slice(i, i + 3000);
    expect(rota).toContain('SEM_CONTA_DE_ACESSO');
    // A frase tem de dizer o que fazer em seguida.
    expect(rota).toMatch(/não tem conta de acesso/i);
  });

  it('a troca passa pelo store, que invalida as sessões abertas', async () => {
    // `changePassword` incrementa o `tokenVersion`, e é isso que derruba quem
    // estiver logado. Trocar sem derrubar deixaria o acesso antigo de pé.
    const src = await ler('server/app.ts');
    const i = src.indexOf(`'/admin/students/:id/password'`);
    const rota = src.slice(i, i + 3000);
    expect(rota).toContain('usersStore.changePassword');

    const store = await ler('server/auth/users-store.ts');
    const j = store.indexOf('export async function changePassword');
    expect(store.slice(j, j + 600)).toContain('tokenVersion');
  });

  it('não vale durante personificação', async () => {
    // Trocar a senha de alguém "como se fosse" outra pessoa apaga a autoria do
    // que foi feito — a mesma razão do bloqueio na rota de contas.
    const src = await ler('server/app.ts');
    const i = src.indexOf(`'/admin/students/:id/password'`);
    const rota = src.slice(i, i + 3000);
    expect(rota).toContain('blockDuringImpersonation');
  });

  it('devolve o e-mail da conta trocada — contra homônimo', async () => {
    const src = await ler('server/app.ts');
    const i = src.indexOf(`'/admin/students/:id/password'`);
    const rota = src.slice(i, i + 3000);
    expect(rota).toMatch(/email:\s*conta\.email/);
  });
});

describe('a tela do aluno oferece a ação', () => {
  it('a ficha tem o botão e a caixa', async () => {
    const tela = await ler('src/app/pages/admin/AdminUserDetail.tsx');
    expect(tela).toContain('Trocar senha');
    expect(tela).toContain('useChangeStudentPassword');
  });

  it('a caixa avisa que a pessoa será desconectada', async () => {
    const tela = await ler('src/app/pages/admin/AdminUserDetail.tsx');
    expect(tela).toMatch(/desconectada de todos os aparelhos/i);
  });

  it('o campo mostra a senha em claro, porque quem digita vai ditá-la', async () => {
    // Esconder o que o atendente acabou de inventar faz ele digitar errado e
    // ditar outra coisa. Quem lê a tela aqui é o suporte, não o aluno.
    const tela = await ler('src/app/pages/admin/AdminUserDetail.tsx');
    const i = tela.indexOf('id="senha-nova"');
    expect(i).toBeGreaterThan(0);
    expect(tela.slice(i - 200, i + 200)).toContain('type="text"');
  });

  it('o erro do servidor vai para a tela, não vira "falhou"', async () => {
    const tela = await ler('src/app/pages/admin/AdminUserDetail.tsx');
    expect(tela).toContain('setErroSenha');
  });
});

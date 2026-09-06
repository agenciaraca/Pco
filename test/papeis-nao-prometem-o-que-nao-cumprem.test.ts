import { describe, it, expect } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * SEC3-706 · o painel de papéis implica um controle que não existe.
 *
 * `/admin/roles` deixa o operador criar um papel "atendente", marcar três
 * permissões e salvar. As permissões são gravadas, listadas de volta e
 * mostradas na tela — e **nenhuma rota do servidor as consulta**. Quem decide o
 * acesso é o campo `role` da conta (`student` / `admin` / `superadmin`), lido do
 * token por `requireAuth`. Conta marcada como admin alcança todo `/admin/*`,
 * qualquer que seja o papel atribuído a ela.
 *
 * A auditoria da passada 003 levantou isso como "papel custom provavelmente
 * satisfaz a checagem de admin". Medido, o quadro é diferente e num aspecto
 * pior: **não há mapeamento nenhum**. O `tier` do papel também é gravado e
 * nunca lido, e nem chega a ser gravável — nem `POST` nem `PUT /admin/roles`
 * repassam o campo do corpo, então todo papel custom nasce e permanece
 * `student`. A ausência de escalonamento é real, e é acidental.
 *
 * ## O que este arquivo trava, e por quê são duas metades
 *
 * 1. **Que ninguém escale por aqui.** Se alguém "completar" os handlers
 *    repassando todos os campos do corpo, um admin comum passa a poder criar
 *    papel `tier: 'superadmin'`. Hoje o que impede é a omissão de duas linhas.
 * 2. **Que a tela continue dizendo a verdade.** Enquanto a autorização por
 *    permissão não existir, o aviso tem de estar lá. E no dia em que existir,
 *    este teste falha — que é o momento certo de tirar o aviso.
 *
 * Não é um teste sobre código bonito: quem marca três caixinhas e sai achando
 * que limitou o acesso de alguém tomou uma decisão de segurança com base numa
 * informação falsa.
 */

async function ler(...partes: string[]): Promise<string> {
  return await fs.readFile(path.join(process.cwd(), ...partes), 'utf8');
}

describe('as permissões não são verificadas — e isso está dito', () => {
  it('nenhuma rota do servidor consulta `permissions` para autorizar', async () => {
    const app = await ler('server', 'app.ts');
    // As únicas menções legítimas são o CRUD do próprio catálogo. Qualquer
    // leitura para decidir acesso apareceria como uma checagem.
    expect(app).not.toMatch(/hasPermission\s*\(/);
    expect(app).not.toMatch(/permissions\.includes\s*\(/);
    expect(app).not.toMatch(/requirePermission\s*\(/);
  });

  it('e o middleware autoriza pelo `role` do token, não pelo papel', async () => {
    const mw = await ler('server', 'auth', 'middleware.ts');
    expect(mw).toContain('roles.includes(user.role)');
    expect(mw).not.toContain('permission');
  });

  it('a tela avisa que as permissões são descritivas', async () => {
    // Sem esta frase, a tela promete um controle que o servidor não aplica.
    const s = await ler('src', 'app', 'pages', 'admin', 'AdminRoles.tsx');
    expect(s).toContain('descritivas, não restritivas');
    expect(s).toContain('não são verificadas pelo servidor');
  });
});

describe('e ninguém escala de papel por esta porta', () => {
  it('criar papel não aceita `tier` do corpo da requisição', async () => {
    /*
      Hoje o `tier` de todo papel custom é `'student'` porque o handler
      simplesmente não repassa o campo. É proteção por omissão, e omissão é o
      que alguém "conserta" ao padronizar handlers. Se este caso falhar, a
      pergunta a fazer é: **um admin comum pode criar um papel de superadmin?**
    */
    const app = await ler('server', 'app.ts');
    const i = app.indexOf('rolesStore.createRole({');
    expect(i, 'não achei o handler de criação de papel').toBeGreaterThan(0);
    // Do começo da chamada até o fecho do objeto de entrada.
    const bloco = app.slice(i, app.indexOf('});', i));
    expect(bloco, 'o handler passou a repassar `tier` do corpo').not.toMatch(/tier:\s*/);
  });

  it('editar papel também não', async () => {
    const app = await ler('server', 'app.ts');
    const i = app.indexOf('rolesStore.updateRole(');
    expect(i, 'não achei o handler de edição de papel').toBeGreaterThan(0);
    const bloco = app.slice(i, app.indexOf('});', i));
    expect(bloco, 'o handler passou a repassar `tier` do corpo').not.toMatch(/tier:\s*/);
  });

  it('e mudar o `role` de uma conta continua sendo só do superadmin', async () => {
    // É este campo — e não o papel — que governa o acesso. Se ele deixar de ser
    // exclusivo do superadmin, um admin comum promove a si mesmo.
    const app = await ler('server', 'app.ts');
    expect(app).toContain("Apenas superadmin pode alterar role.");
    expect(app).toMatch(/v\.data\.role && acting\?\.role !== 'superadmin'/);
  });
});

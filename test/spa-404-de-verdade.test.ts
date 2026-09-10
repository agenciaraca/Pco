/**
 * Endereço que não existe tem de responder 404 — e endereço do aluno, nunca.
 *
 * ## O defeito
 *
 * O servidor terminava com `root.get('*', serveStatic({ path: 'index.html' }))`,
 * o fallback que todo SPA precisa. O efeito colateral é que **qualquer**
 * endereço respondia **HTTP 200** com o `index.html`. Medido em produção em
 * 9/set/2026: `/pagina-que-nao-existe` e `/xyz123` devolviam 200.
 *
 * Para quem digitou errado, é uma tela do aplicativo em vez de um aviso. Para o
 * robô de busca é pior: cada endereço inventado — e eles chegam às centenas, de
 * links quebrados e de varredura — vira uma página válida a indexar, todas com
 * o mesmo conteúdo.
 *
 * ## Por que este arquivo existe, e não só o conserto
 *
 * O conserto é uma lista de prefixos escrita à mão, porque o servidor não
 * enxerga as rotas do React — elas vivem dentro do bundle. Lista à mão
 * envelhece, e o estrago do envelhecimento é **maior** do que o defeito que se
 * está corrigindo: uma rota nova do aplicativo que não chegue à lista passa a
 * responder 404 para quem já é aluno e pagou.
 *
 * O primeiro caso abaixo lê `src/app/routes.tsx` e falha quando as duas
 * divergem. **É ele que torna o conserto seguro**; o resto é consequência.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ehRotaDoApp, pareceArquivo, PREFIXOS_DO_APP } from '../server/rotas-do-app';

let routesTsx = '';

beforeAll(async () => {
  routesTsx = await fs.readFile(
    path.resolve(process.cwd(), 'src/app/routes.tsx'),
    'utf8',
  );
});

/** Os primeiros segmentos de todas as rotas de primeiro nível do aplicativo. */
function prefixosDeclaradosNoApp(): string[] {
  const achados = new Set<string>();
  for (const m of routesTsx.matchAll(/path:\s*'([^']*)'/g)) {
    const p = m[1]!;
    // Só rotas absolutas: as relativas são filhas de `/admin`, que já entra
    // pelo pai. E `*` é o catch-all do próprio roteador do React.
    if (!p.startsWith('/') || p === '/') continue;
    const primeiro = p.replace(/^\/+/, '').split('/')[0]!;
    if (primeiro && !primeiro.startsWith(':')) achados.add(primeiro);
  }
  return [...achados].sort();
}

describe('a lista de prefixos acompanha o aplicativo', () => {
  it('toda rota de primeiro nível do React está declarada no servidor', () => {
    const noApp = prefixosDeclaradosNoApp();
    const faltando = noApp.filter((p) => !PREFIXOS_DO_APP.includes(p));
    expect(
      faltando,
      'rota do aplicativo que o servidor não conhece:\n' +
        faltando.map((p) => `  /${p}`).join('\n') +
        '\nSem isso ela passa a responder 404 para quem já é aluno. ' +
        'Acrescente em `server/rotas-do-app.ts`.',
    ).toEqual([]);
  });

  it('e a lista não inventa prefixo que o aplicativo não tem', () => {
    // O outro lado: prefixo a mais devolve 200 para endereço inexistente, que
    // é o defeito original voltando pela porta dos fundos.
    const noApp = new Set(prefixosDeclaradosNoApp());
    const sobrando = PREFIXOS_DO_APP.filter((p) => !noApp.has(p));
    expect(
      sobrando,
      'prefixo declarado no servidor e ausente do aplicativo:\n' +
        sobrando.map((p) => `  /${p}`).join('\n'),
    ).toEqual([]);
  });
});

describe('quem é do aplicativo e quem não é', () => {
  it('rotas reais do aluno continuam servidas pelo SPA', () => {
    // Uma amostra do que um aluno acessa todo dia. Se qualquer uma virar
    // false, é acesso perdido — não é detalhe de SEO.
    for (const rota of [
      '/dashboard',
      '/cursos',
      '/curso/abc123',
      '/curso/abc123/aula/xyz',
      '/certificados',
      '/perfil',
      '/login',
      '/admin',
      '/admin/alunos/42',
      '/verificar/CODIGO-1234',
      '/checkout/mock',
      '/podcasts/7',
    ]) {
      expect(ehRotaDoApp(rota), `${rota} deixou de ser servida pelo aplicativo`).toBe(true);
    }
  });

  it('endereço inventado não é do aplicativo', () => {
    for (const rota of [
      '/pagina-que-nao-existe',
      '/xyz123',
      '/painel',
      '/sobre-nos',
      // Endereço antigo do site anterior: continua chegando por link salvo e
      // por resultado de busca, e não existe mais aqui.
      '/curso-de-psicanalise-clinica-online',
    ]) {
      expect(ehRotaDoApp(rota), `${rota} continua respondendo como se existisse`).toBe(false);
    }
  });

  it('a raiz nunca vira 404', () => {
    // Ela é servida pelo site público bem antes de chegar aqui. Responder 404
    // na home por um engano de ordem de rotas seria o pior estrago possível.
    expect(ehRotaDoApp('/')).toBe(true);
    expect(ehRotaDoApp('')).toBe(true);
  });

  it('arquivo que falta recebe texto, não a página de marca em HTML', () => {
    // As duas respostas são 404; o que muda é o formato. Devolver HTML no
    // lugar de um manifesto ou de um `.js` faz o navegador recusar por
    // `Content-Type` e `nosniff`, e o erro que chega ao console não se parece
    // nada com "o arquivo não existe" — foi por isso que `/assets/*` já tinha
    // 404 próprio antes desta mudança.
    for (const arquivo of [
      '/favicon.ico',
      '/robots.txt',
      '/sitemap.xml',
      '/manifest.webmanifest',
      '/llms.txt',
      '/algo.js',
      '/imagem.png',
      // Varredura automatizada pede arquivo o tempo todo, com extensão que
      // este projeto nunca usou. O ponto não é a tecnologia do nome: é que
      // caminho com extensão pede ARQUIVO, e arquivo ausente responde texto.
      '/config.php',
      '/dump.sql',
      '/backup.zip',
    ]) {
      expect(pareceArquivo(arquivo), `${arquivo} receberia HTML`).toBe(true);
      expect(ehRotaDoApp(arquivo), `${arquivo} seria servido como tela`).toBe(false);
    }
  });

  it('tela não é confundida com arquivo', () => {
    for (const rota of ['/pagina-que-nao-existe', '/xyz123', '/sobre-nos', '/dashboard']) {
      expect(pareceArquivo(rota), `${rota} foi tomado por arquivo`).toBe(false);
    }
  });

  it('query e âncora não confundem a decisão', () => {
    expect(ehRotaDoApp('/dashboard?tab=1')).toBe(true);
    expect(ehRotaDoApp('/xyz123?utm_source=x')).toBe(false);
  });
});

describe('a página de não encontrado', () => {
  it('sai com a marca, sem link interno e pedindo para não indexar', async () => {
    const { htmlDeNaoEncontrada } = await import('../server/public/nao-encontrada');
    const h = await htmlDeNaoEncontrada('/nao-existe');
    expect(h).toContain('noindex');
    expect(h).toContain('Esta página não existe');
    // Os caminhos de volta são públicos: esta página é servida a quem não está
    // logado, e a robô. Link para tela de aluno ou de administração aqui seria
    // publicar endereço interno no lugar mais varrido que existe.
    expect(h).toContain('href="/"');
    expect(h).toContain('/formacoes');
    expect(h).not.toMatch(/href="\/admin/);
    expect(h).not.toMatch(/href="\/dashboard/);
  });
});

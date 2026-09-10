/**
 * Quais caminhos pertencem ao aplicativo React — e, por consequência, quais
 * **não** existem em lugar nenhum.
 *
 * ## O defeito que isto fecha
 *
 * O servidor terminava com `root.get('*', serveStatic({ path: 'index.html' }))`
 * — o fallback que todo SPA precisa, porque as rotas do aplicativo só existem
 * depois que o JavaScript roda. O efeito colateral é que **qualquer** endereço
 * respondia **HTTP 200** com o `index.html`. Medido em produção em 9/set/2026:
 * `/pagina-que-nao-existe`, `/xyz123` e qualquer coisa digitada errada devolvem
 * 200.
 *
 * Para quem digitou errado, é uma tela do aplicativo em vez de um aviso. Para o
 * robô de busca, é pior: cada endereço inventado — e eles chegam às centenas,
 * vindos de links quebrados e de varredura — é uma página **válida** a indexar,
 * todas com o mesmo conteúdo. É o inverso exato do cuidado que este projeto já
 * teve com o 503 da vitrine: lá, o problema era afirmar "não existe" sem saber;
 * aqui, é afirmar "existe" sobre o que não existe.
 *
 * ## Por que uma lista, e por que ela é conferida por teste
 *
 * O servidor não enxerga as rotas do React — elas vivem dentro do bundle. A
 * lista abaixo é a ponte, e ponte escrita à mão é ponte que envelhece: uma
 * rota nova no aplicativo que não chegasse aqui passaria a responder 404 para
 * quem já é aluno, que é um estrago bem maior do que o que se está
 * consertando.
 *
 * Por isso `test/spa-404-de-verdade.test.ts` lê `src/app/routes.tsx` e falha
 * quando as duas divergem. **O teste é a metade que importa desta correção.**
 */

/**
 * Primeiro segmento de cada rota de primeiro nível do aplicativo.
 *
 * Só o primeiro segmento: `/curso/:courseId/aula/:lessonId` entra como
 * `curso`. O que se decide aqui é "este endereço pertence ao aplicativo?", e
 * validar o resto é trabalho do roteador dele — que já sabe mostrar a própria
 * tela de não encontrado para `/curso/id-que-nao-existe`.
 */
export const PREFIXOS_DO_APP: readonly string[] = [
  'admin',
  'analise-supervisao',
  'anotacoes',
  'aula-preview',
  'auth',
  'ava-pco',
  'biblioteca',
  'catalogo',
  'certificados',
  'checkout',
  'comparar',
  'curso',
  'curso-preview',
  'cursos',
  'dashboard',
  'esqueci-senha',
  'eventos',
  'jornada',
  'landing',
  'login',
  'news',
  'notificacoes',
  'onboarding',
  'pacotes',
  'pedidos',
  'perfil',
  'podcasts',
  'privacidade',
  'redefinir-senha',
  'suporte',
  'termos',
  'tutor',
  'verificar',
];

/** O primeiro segmento do caminho, sem query nem âncora. */
function primeiroSegmento(caminho: string): string {
  const limpo = caminho.split('?')[0]!.split('#')[0]!;
  return limpo.replace(/^\/+/, '').split('/')[0]!;
}

/**
 * O caminho pertence ao aplicativo?
 *
 * A raiz (`/`) devolve `true` por segurança: ela é servida pelo site público
 * bem antes de chegar aqui, e responder 404 nela seria o pior estrago possível
 * por causa de um engano de ordem de rotas.
 */
export function ehRotaDoApp(caminho: string): boolean {
  const primeiro = primeiroSegmento(caminho);
  if (primeiro === '') return true;
  return PREFIXOS_DO_APP.includes(primeiro);
}

/**
 * O caminho pede um ARQUIVO, e não uma tela?
 *
 * Serve para escolher o formato da resposta, não o status: os dois casos são
 * 404. Arquivo que falta recebe texto puro, como `/assets/*` já fazia — e o
 * motivo está escrito lá: devolver HTML no lugar de um `.js` ou de um
 * manifesto faz o navegador recusar por `Content-Type` e `nosniff`, e o
 * sintoma que chega ao console ("error loading dynamically imported module")
 * não se parece nada com "o arquivo não existe".
 *
 * **A regra não pode viver dentro de `ehRotaDoApp`.** Estava lá na primeira
 * versão, devolvendo `true`, e o efeito era servir o `index.html` com 200 para
 * qualquer caminho com ponto no nome — `/config.php`, `/dump.sql`. Era o
 * defeito original de volta justamente pela varredura automatizada, que passa
 * o dia pedindo arquivos assim.
 */
export function pareceArquivo(caminho: string): boolean {
  // Até 12 caracteres de extensão: `webmanifest` tem 11, e um teto curto
  // demais faria o manifesto do site receber HTML.
  return /\.[a-z0-9]{2,12}$/i.test(primeiroSegmento(caminho) || caminho);
}

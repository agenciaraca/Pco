/**
 * A página de "não encontrado" do site, com a marca e um caminho de volta.
 *
 * Existe porque o servidor respondia **200** para qualquer endereço
 * inexistente — o fallback do SPA devolvia o `index.html` a tudo que não
 * casasse. Ver `server/rotas-do-app.ts` para o defeito inteiro.
 *
 * Duas decisões que um retoque desfaz sem perceber:
 *
 * - **`noindex`**, além do 404. O status já basta para o robô que o respeita,
 *   e a marca no `<meta>` fecha para o que não respeita. Não custa nada e
 *   evita que uma varredura antiga insista numa página que não existe.
 * - **Os links de volta são públicos.** Esta página é servida a quem não está
 *   logado — e a quem nem é gente. Apontar para tela de aluno ou de
 *   administração aqui seria pôr um endereço interno no lugar mais visitado
 *   por robô que existe.
 */
import { html } from 'hono/html';
import { renderPage, type Html } from './layout';
import { ORG } from './config';

export function paginaNaoEncontrada(caminho: string): Html {
  const corpo = html`<section class="section" style="text-align:center">
    <div class="wrap">
      <p class="eyebrow">Erro 404</p>
      <h1 style="margin:12px 0 14px">Esta página não existe</h1>
      <p class="lead" style="margin:0 auto 26px;max-width:52ch">
        O endereço pode ter mudado, ou o link que trouxe você até aqui está
        incompleto.
      </p>
      <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center">
        <a class="btn btn-primary" href="/">Ir para a página inicial</a>
        <a class="btn btn-outline" href="/formacoes">Ver as formações</a>
      </div>
    </div>
  </section>`;

  return renderPage({
    title: `Página não encontrada — ${ORG.shortName}`,
    description: 'O endereço não existe neste site.',
    path: caminho,
    noindex: true,
    bodyHtml: corpo,
  });
}

/**
 * O HTML pronto, para quem só precisa do texto (o servidor).
 *
 * `renderPage` pode devolver uma promessa — o layout lê as tags de marketing,
 * que vêm de um store. Resolver aqui evita que o servidor mande um
 * `[object Promise]` para quem digitou o endereço errado.
 */
export async function htmlDeNaoEncontrada(caminho: string): Promise<string> {
  return String(await paginaNaoEncontrada(caminho));
}

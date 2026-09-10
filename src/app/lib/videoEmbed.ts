/**
 * Converte uma URL de vídeo para a forma EMBUTÍVEL.
 *
 * ## O caso
 *
 * O acervo de podcasts que veio do LMS antigo guardou `videoUrl` como
 * `https://vimeo.com/1116765460` — a URL da PÁGINA de assistir, não a do
 * player. Num `<iframe src>` isso não toca por dois motivos somados:
 *
 * 1. `vimeo.com/<id>` é a página do site da Vimeo, e ela recusa ser embutida
 *    (`X-Frame-Options`). Nenhum referer conserta isso.
 * 2. A nossa CSP libera `frame-src` só para `player.vimeo.com` — `vimeo.com`
 *    nem chega a carregar.
 *
 * As aulas escaparam porque o HTML de embed do LearnDash já trazia
 * `player.vimeo.com/video/<id>`. Os podcasts vieram da API `ldlms/v2/topicos`,
 * que devolve a URL crua.
 *
 * ## Por que aqui, e não só nos dados
 *
 * `VideoAula` é o ponto único por onde todo vídeo passa (aula, podcast,
 * preview). Normalizar aqui conserta o acervo inteiro sem tocar no banco e
 * protege qualquer cadastro futuro em que alguém cole a URL da barra de
 * endereço. Uma migração dos dados é limpeza, não o conserto.
 *
 * ## Regras
 *
 * - **Idempotente:** `player.vimeo.com/video/<id>` entra e sai igual.
 * - **Preserva o hash de vídeo não listado:** `vimeo.com/<id>/<hash>` →
 *   `player.vimeo.com/video/<id>?h=<hash>`. É o token que libera o embed de um
 *   vídeo "oculto do Vimeo".
 * - **Não inventa:** o que não reconhece volta como veio. Arquivo solto
 *   (`.mp4`) não é URL de página — `VideoAula` já o trata à parte.
 */

const RE_PLAYER_VIMEO = /^https?:\/\/player\.vimeo\.com\/video\/\d+/i;
const RE_VIMEO_ID =
  /vimeo\.com\/(?:channels\/[^/]+\/|groups\/[^/]+\/videos\/|album\/\d+\/video\/)?(\d+)(?:\/([0-9a-z]+))?/i;
const RE_YT_WATCH =
  /(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/i;
const RE_YT_EMBED = /^https?:\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/embed\//i;

export function urlDeEmbed(bruta: string): string {
  const url = (bruta ?? '').trim();
  if (!url) return url;

  // Já é player embutível — não mexe.
  if (RE_PLAYER_VIMEO.test(url) || RE_YT_EMBED.test(url)) return url;

  const vimeo = RE_VIMEO_ID.exec(url);
  if (vimeo) {
    const id = vimeo[1];
    const hash = vimeo[2];
    return hash
      ? `https://player.vimeo.com/video/${id}?h=${hash}`
      : `https://player.vimeo.com/video/${id}`;
  }

  const yt = RE_YT_WATCH.exec(url);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;

  return url;
}

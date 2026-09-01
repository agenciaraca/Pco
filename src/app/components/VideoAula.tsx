/**
 * O player de aula — num lugar só, porque as duas telas discordavam.
 *
 * A aula do aluno usava `<iframe>`; a preview pública usava `<video>`. A
 * segunda nunca teve como funcionar: `player.vimeo.com/video/<id>` devolve uma
 * PÁGINA, não um arquivo de mídia, e `<video>` não sabe o que fazer com HTML.
 *
 * `referrerPolicy` é o detalhe que faz a Vimeo tocar. Ela autoriza embed por
 * domínio e decide pelo cabeçalho `Referer`: sem referer, devolve 403 e o
 * player mostra "este conteúdo está bloqueado — entre em contato com o
 * proprietário do site", que se lê como problema de conta e é problema de
 * cabeçalho. O site responde com dois `Referrer-Policy` (o nosso,
 * `strict-origin-when-cross-origin`, e um `same-origin` posto por um proxy à
 * frente), e o `same-origin` zera o referer para terceiros. A política por
 * elemento vence a do documento — é exatamente o que o embed oficial da Vimeo
 * traz, e por isso está aqui.
 *
 * Do lado do servidor, o par disto é o `frame-src` de `server/public/csp.ts`.
 * Sem ele o iframe nem chega a carregar.
 */

/** Extensões que o navegador toca direto. O resto é embed. */
const ARQUIVO_DE_MIDIA = /\.(mp4|webm|ogg|ogv|m4v|mov)(\?|#|$)/i;

export function ehArquivoDeMidia(url: string): boolean {
  return ARQUIVO_DE_MIDIA.test(url.trim());
}

interface Props {
  url: string;
  titulo: string;
}

export default function VideoAula({ url, titulo }: Props) {
  // Arquivo solto (um mp4 no `/uploads`, por exemplo) toca no player nativo;
  // qualquer outra coisa é página de embed e precisa de iframe.
  if (ehArquivoDeMidia(url)) {
    return (
      <video src={url} controls className="w-full h-full" preload="metadata">
        Seu navegador não suporta o player de vídeo.
      </video>
    );
  }

  return (
    <iframe
      src={url}
      title={titulo}
      className="w-full h-full"
      frameBorder={0}
      referrerPolicy="strict-origin-when-cross-origin"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
    />
  );
}

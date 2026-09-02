/**
 * Desfaz entidades HTML na URL de vídeo das aulas.
 *
 * A URL foi extraída de dentro de um atributo HTML (`<iframe src="...">`), e
 * ali `&` vem escapado como `&amp;`. Gravada assim, ela chega ao player como
 * `?color&amp;autopause=0&amp;dnt=true`: a query string vira os parâmetros
 * `amp;autopause`, `amp;dnt` e companhia, que o Vimeo ignora sem reclamar. O
 * vídeo toca e a configuração simplesmente não vale — inclusive o `dnt=true`,
 * que é o "não rastreie este espectador".
 *
 * Três aulas em produção estavam assim, medidas em 2/set/2026. A causa já foi
 * corrigida na entrada (`extract_video_url` em
 * `server/imports/pipeline/transforms.ts`); este script cuida do gravado.
 *
 * Só mexe em `videoUrl`. URL é texto, como título — descrição e conteúdo são
 * HTML de verdade e desescapar ali mudaria o texto. Ver
 * `scripts/corrigir_entidades_titulos.ts`, que é o mesmo caso.
 *
 * Uso:
 *   npx tsx scripts/corrigir_entidades_video.ts            # ensaio
 *   npx tsx scripts/corrigir_entidades_video.ts --aplicar  # grava
 */

import 'dotenv/config';
import { getDb, schema } from '../server/db/client';
import { decodificarEntidades } from '../shared/entidades-html';
import { eq } from 'drizzle-orm';

async function main() {
  const aplicar = process.argv.includes('--aplicar');
  const db = getDb();
  if (!db) {
    console.error('sem DATABASE_URL — nada feito.');
    process.exit(1);
  }

  const linhas = await db
    .select({
      id: schema.lessons.id,
      title: schema.lessons.title,
      videoUrl: schema.lessons.videoUrl,
    })
    .from(schema.lessons);

  const mudam = linhas
    .filter((l) => typeof l.videoUrl === 'string' && l.videoUrl.length > 0)
    .map((l) => ({
      id: l.id,
      title: l.title,
      de: l.videoUrl as string,
      para: decodificarEntidades(l.videoUrl as string),
    }))
    .filter((l) => l.de !== l.para);

  const comVideo = linhas.filter((l) => l.videoUrl && l.videoUrl.length > 0).length;
  console.log(`aulas: ${linhas.length} · com vídeo: ${comVideo} · a corrigir: ${mudam.length}`);
  for (const m of mudam) {
    console.log(`\n  ${m.id} — ${m.title}`);
    console.log(`    de:   ${m.de}`);
    console.log(`    para: ${m.para}`);
  }

  if (aplicar) {
    for (const m of mudam) {
      await db.update(schema.lessons).set({ videoUrl: m.para }).where(eq(schema.lessons.id, m.id));
    }
  }

  console.log(
    aplicar
      ? `\naplicadas: ${mudam.length}`
      : '\nensaio. nada gravado. rode com --aplicar para gravar.',
  );
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);

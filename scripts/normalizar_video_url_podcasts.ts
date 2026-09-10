// Limpa `podcasts.video_url` no banco: `vimeo.com/<id>` → `player.vimeo.com/video/<id>`.
//
// O RENDER já resolve isso (ver `src/app/lib/videoEmbed.ts`, usado por
// `VideoAula`), então rodar isto não é o conserto — é higiene: deixa o dado
// gravado do jeito que ele deveria ter chegado do import, para quem olhar o
// banco direto não se confundir, e para qualquer caminho futuro que leia
// `videoUrl` sem passar por `VideoAula`.
//
// Ensaio por padrão. `--commit` para gravar.
import 'dotenv/config';
import { getDb, schema } from '../server/db/client';
import { eq } from 'drizzle-orm';
import { urlDeEmbed } from '../src/app/lib/videoEmbed';

async function main() {
  const commit = process.argv.includes('--commit');
  const db = getDb();
  if (!db) {
    console.error('Sem DATABASE_URL — nada a normalizar (modo JSON não tem esta tabela).');
    process.exit(1);
  }

  const rows = await db.select().from(schema.podcasts);
  const mudancas: Array<{ id: string; title: string; de: string; para: string }> = [];

  for (const r of rows) {
    if (!r.videoUrl) continue;
    const normalizada = urlDeEmbed(r.videoUrl);
    if (normalizada !== r.videoUrl) {
      mudancas.push({ id: r.id, title: r.title, de: r.videoUrl, para: normalizada });
    }
  }

  console.log(`${rows.length} podcasts, ${mudancas.length} com videoUrl para normalizar.`);
  for (const m of mudancas) {
    console.log(`  ${m.id}  ${m.title.slice(0, 50)}\n    ${m.de} -> ${m.para}`);
  }

  if (!commit) {
    console.log('\nEnsaio — nada gravado. Rode com --commit para aplicar.');
    process.exit(0);
  }

  for (const m of mudancas) {
    await db.update(schema.podcasts).set({ videoUrl: m.para }).where(eq(schema.podcasts.id, m.id));
  }
  console.log(`\n${mudancas.length} linha(s) gravada(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

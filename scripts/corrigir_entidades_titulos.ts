/**
 * Desfaz entidades HTML nos títulos que vieram da importação.
 *
 * O WordPress entrega o título já renderizado — escapado para HTML — e a
 * importação gravou assim. O React escapa de novo na exibição, e faz certo:
 * quem lê `&#8220;` na tela é o aluno. Cinco aulas em produção estavam assim,
 * inclusive na lista lateral do curso, à vista de qualquer um.
 *
 * A causa já foi corrigida na entrada (`unwrap()` em
 * `server/imports/connectors/ld.ts`); este script cuida do que já está gravado.
 *
 * Só mexe em título. Descrição e conteúdo são HTML de verdade e vão ser
 * renderizados como HTML — desescapar ali mudaria o significado do texto.
 *
 * Uso:
 *   npx tsx scripts/corrigir_entidades_titulos.ts            # ensaio
 *   npx tsx scripts/corrigir_entidades_titulos.ts --aplicar  # grava
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

  const tabelas = [
    { nome: 'aulas', t: schema.lessons },
    { nome: 'módulos', t: schema.modules },
    { nome: 'cursos', t: schema.courses },
  ] as const;

  let total = 0;
  for (const { nome, t } of tabelas) {
    const linhas = await db.select({ id: t.id, title: t.title }).from(t);
    const mudam = linhas
      .map((l) => ({ id: l.id, de: l.title ?? '', para: decodificarEntidades(l.title ?? '') }))
      .filter((l) => l.de !== l.para);

    console.log(`\n${nome}: ${mudam.length} de ${linhas.length} mudariam`);
    for (const m of mudam.slice(0, 20)) console.log(`  ${m.de}\n    → ${m.para}`);
    if (mudam.length > 20) console.log(`  ... e mais ${mudam.length - 20}`);
    total += mudam.length;

    if (aplicar) {
      for (const m of mudam) {
        await db.update(t).set({ title: m.para }).where(eq(t.id, m.id));
      }
    }
  }

  console.log(
    aplicar ? `\naplicadas: ${total}` : '\nensaio. nada gravado. rode com --aplicar para gravar.',
  );
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);

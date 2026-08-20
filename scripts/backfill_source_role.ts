/**
 * Recupera, a partir do dump da migração, o papel que cada aluno tinha no
 * WordPress de origem.
 *
 * A carga jogou todo mundo em `status='ativo'` e perdeu a distinção entre quem
 * estava estudando, quem desistiu, quem parou de pagar e quem foi reembolsado —
 * exatamente o que decide quem deve receber convite para o ambiente novo. O
 * dump de julho ainda tem essa informação em `wp_roles`.
 *
 * Casa por e-mail: os ids do dump não são os ids de produção.
 *
 * Uso (no VPS, dentro de ~/ava-pco):
 *   DATABASE_URL=... npx tsx scripts/backfill_source_role.ts --from-raw=data/migration/<ts>
 *   DATABASE_URL=... npx tsx scripts/backfill_source_role.ts --from-raw=... --apply
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const APPLY = process.argv.includes('--apply');
const fromArg = process.argv.find((a) => a.startsWith('--from-raw='));
const log = (m: string) => console.log(`[papel-origem] ${m}`);

if (!fromArg) {
  console.error('ERRO: informe --from-raw=data/migration/<timestamp>');
  process.exit(1);
}
const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error('ERRO: defina DATABASE_URL no ambiente.');
  process.exit(1);
}

const RAW_DIR = path.resolve(process.cwd(), fromArg.slice('--from-raw='.length), 'raw');
const mapArg = process.argv.find((a) => a.startsWith('--from-map='));

function stripSslParams(url: string): string {
  return url
    .replace(/([?&])(sslmode|channel_binding)=[^&]*/gi, '$1')
    .replace(/[?&]$/, '')
    .replace(/\?&/, '?');
}

/**
 * O WordPress guarda vários papéis por pessoa (`aluno|bbp_participant`). O que
 * interessa é o primeiro que diz algo sobre a relação comercial; os papéis de
 * fórum não dizem nada.
 */
const RUIDO = new Set(['bbp_participant', 'bbp_spectator', 'bbp_keymaster', 'contributor']);
function papelPrincipal(wpRoles: string): string {
  const partes = String(wpRoles || '')
    .split(/[|,]/)
    .map((p) => p.trim())
    .filter((p) => p && !RUIDO.has(p));
  return partes[0] || 'desconhecido';
}

async function main(): Promise<void> {
  log(`modo: ${APPLY ? '*** APPLY (grava) ***' : 'DRY-RUN (rollback ao final)'}`);

  const papelPorEmail = new Map<string, string>();

  // O dump bruto pesa alguns megabytes e é gitignored — no servidor ele não
  // existe. `--from-map` aceita o mapa e-mail→papel já extraído, que é o que
  // interessa aqui e cabe em poucos kilobytes.
  if (mapArg) {
    const caminho = path.resolve(process.cwd(), mapArg.slice('--from-map='.length));
    const bruto = JSON.parse(await fs.readFile(caminho, 'utf8')) as Record<string, string>;
    for (const [email, papel] of Object.entries(bruto)) {
      papelPorEmail.set(email.toLowerCase(), papel);
    }
    log(`mapa lido de ${path.basename(caminho)}`);
  }

  for (const arquivo of mapArg ? [] : ['portal.json', 'psi.json']) {
    try {
      const dump = JSON.parse(await fs.readFile(path.join(RAW_DIR, arquivo), 'utf8')) as {
        rowsByEntity: Record<string, Array<Record<string, unknown>>>;
      };
      for (const s of dump.rowsByEntity.student ?? []) {
        const email = String(s.email ?? '').toLowerCase();
        if (!email) continue;
        const papel = papelPrincipal(String(s.wp_roles ?? ''));
        // O portal é lido primeiro e tem a palavra final: é lá que existe a
        // relação de curso. Na loja todo mundo é "customer", o que não
        // distingue quem estuda de quem comprou um e-book.
        if (!papelPorEmail.has(email)) papelPorEmail.set(email, papel);
      }
    } catch {
      log(`aviso: ${arquivo} não encontrado em ${RAW_DIR}`);
    }
  }
  log(`papéis lidos do dump: ${papelPorEmail.size} e-mail(s)`);

  const client = new pg.Client({
    connectionString: stripSslParams(DB_URL!),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    const alunos = (
      await client.query(
        "select s.id, lower(u.email) as email from students s join users u on u.id = s.id",
      )
    ).rows as Array<{ id: string; email: string }>;

    await client.query('BEGIN');

    const contagem = new Map<string, number>();
    let semPapel = 0;
    let atualizados = 0;
    for (const a of alunos) {
      const papel = papelPorEmail.get(a.email);
      if (!papel) {
        semPapel++;
        continue;
      }
      contagem.set(papel, (contagem.get(papel) ?? 0) + 1);
      await client.query('update students set source_role = $1 where id = $2', [papel, a.id]);
      atualizados++;
    }

    log(`alunos com ficha em produção: ${alunos.length}`);
    log(`papel recuperado: ${atualizados} · sem correspondência no dump: ${semPapel}`);
    for (const [p, n] of [...contagem].sort((a, b) => b[1] - a[1])) {
      log(`  ${String(n).padStart(4)} ${p}`);
    }

    if (APPLY) {
      await client.query('COMMIT');
      log('*** COMMIT feito. ***');
    } else {
      await client.query('ROLLBACK');
      log('DRY-RUN → ROLLBACK (nada gravado).');
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[papel-origem] ERRO — rollback feito:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

void main();

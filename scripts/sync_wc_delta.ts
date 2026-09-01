/**
 * Traz para o AVA as compras feitas na loja WooCommerce depois da última carga.
 *
 * Motivo: a loja continuou vendendo enquanto o AVA ficava parado. Quem comprou
 * nesse intervalo pagou e não existe aqui — não tem conta, não tem matrícula, e
 * a recarga completa do portal não resolve, porque essas vendas vivem na loja,
 * não no LearnDash.
 *
 * O que faz, por pedido pago:
 *   1. Garante a conta (por e-mail; nunca duplica quem já existe)
 *   2. Garante a ficha de aluno
 *   3. Matricula no curso do item comprado, com `enrolled_at` = data do pagamento
 *      e `expires_at` calculado pelo prazo do curso
 *
 * O que NÃO faz, de propósito:
 *   - Extensão de acesso: a loja vende "Extensão 6 meses" sem dizer de qual
 *     curso. Aplicar no curso errado tira acesso de quem pagou; então esses
 *     pedidos são listados para o admin resolver na ficha do aluno.
 *   - Certificado impresso: é item físico, não dá acesso a nada.
 *
 * Uso:
 *   DATABASE_URL=... npx tsx scripts/sync_wc_delta.ts                      # DRY-RUN
 *   DATABASE_URL=... npx tsx scripts/sync_wc_delta.ts --commit
 *   DATABASE_URL=... npx tsx scripts/sync_wc_delta.ts --after=2026-07-06 --commit
 *
 * Credenciais da loja em `.env.import` (gitignored).
 */

import 'dotenv/config';
import { promises as fs } from 'node:fs';
import pg from 'pg';
import { addMonths } from '../server/access/course-access';

const COMMIT = process.argv.includes('--commit');
const afterArg = process.argv.find((a) => a.startsWith('--after='));
const AFTER = afterArg ? afterArg.slice('--after='.length) : '2026-07-06';
const log = (m: string) => console.log(`[wc-delta] ${m}`);

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error('ERRO: defina DATABASE_URL no ambiente.');
  process.exit(1);
}

/**
 * SKU da loja → curso no AVA.
 *
 * Deliberadamente escrito à mão. O campo `linked_course_external_id` do
 * WooCommerce não serve: aponta o curso 8495 tanto para Psicanálise quanto para
 * Terapia Familiar, e 8495 é um curso vazio, sem matrícula nenhuma. Estes
 * valores vêm de `data/payment-products.json`, onde o mapeamento foi conferido.
 */
const CURSO_POR_SKU: Record<string, string> = {
  'PCO-Psicanalise': '14839',
  'PCO-Hipnose': '8748',
  'PCO-terapia-familiar': '12245',
};

/** Itens que não concedem acesso — listados no relatório, não aplicados. */
const SEM_ACESSO = /extens[ãa]o|certificado/i;

interface WcOrder {
  id: number;
  status: string;
  date_paid: string | null;
  date_created: string;
  billing?: { email?: string; first_name?: string; last_name?: string };
  line_items?: Array<{ sku?: string; name?: string }>;
}

function stripSslParams(url: string): string {
  return url
    .replace(/([?&])sslmode=[^&]*/gi, '$1')
    .replace(/([?&])channel_binding=[^&]*/gi, '$1')
    .replace(/[?&]$/, '')
    .replace(/\?&/, '?');
}

async function lerEnvImport(): Promise<Record<string, string>> {
  const txt = await fs.readFile('.env.import', 'utf8');
  const env: Record<string, string> = {};
  for (const linha of txt.split(/\r?\n/)) {
    const m = linha.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

async function buscarPedidos(): Promise<WcOrder[]> {
  const env = await lerEnvImport();
  const base = env.PSICANALISE_URL;
  const auth =
    'Basic ' +
    Buffer.from(`${env.PSICANALISE_USER}:${env.PSICANALISE_APP_PASSWORD}`).toString('base64');
  const out: WcOrder[] = [];
  for (let page = 1; page <= 20; page++) {
    const url = `${base}/wp-json/wc/v3/orders?per_page=100&page=${page}&after=${AFTER}T00:00:00&status=completed,processing`;
    const r = await fetch(url, { headers: { Authorization: auth, Accept: 'application/json' } });
    if (!r.ok) throw new Error(`loja respondeu ${r.status} ao listar pedidos`);
    const arr = (await r.json()) as WcOrder[];
    if (!Array.isArray(arr) || arr.length === 0) break;
    out.push(...arr);
    const tp = Number(r.headers.get('x-wp-totalpages') ?? '1');
    if (page >= tp) break;
  }
  return out;
}

function idDeterministico(email: string): string {
  // Sem aleatório: rodar o script duas vezes não pode criar duas contas para a
  // mesma pessoa se o e-mail ainda não estiver no banco.
  const base = email.replace(/[^a-z0-9]/gi, '').slice(0, 18).toLowerCase();
  return `wc-${base}-${email.length}`;
}

async function main(): Promise<void> {
  log(`modo: ${COMMIT ? '*** COMMIT (grava) ***' : 'DRY-RUN (rollback ao final)'}`);
  log(`pedidos pagos a partir de ${AFTER}`);

  const pedidos = await buscarPedidos();
  log(`loja → ${pedidos.length} pedido(s) pago(s) no período`);

  const client = new pg.Client({
    connectionString: stripSslParams(DB_URL!),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    const cursos = (
      await client.query("select id, (meta->>'accessMonths') as access_months from courses")
    ).rows as Array<{ id: string; access_months: string | null }>;
    const existeCurso = new Set(cursos.map((c) => String(c.id)));
    const mesesPorCurso = new Map<string, number>();
    for (const c of cursos) {
      const m = Number(c.access_months);
      if (Number.isFinite(m) && m > 0) mesesPorCurso.set(String(c.id), m);
    }

    await client.query('BEGIN');

    let contasNovas = 0;
    let matriculasNovas = 0;
    let jaTinham = 0;
    const semMapa: string[] = [];
    const paraOAdmin: string[] = [];

    for (const o of pedidos) {
      const email = (o.billing?.email ?? '').toLowerCase().trim();
      if (!email) continue;
      const pagoEm = o.date_paid ?? o.date_created;
      const nome =
        `${o.billing?.first_name ?? ''} ${o.billing?.last_name ?? ''}`.trim() || email;

      const cursosDoPedido: string[] = [];
      for (const item of o.line_items ?? []) {
        const rotulo = item.sku || item.name || '';
        if (SEM_ACESSO.test(rotulo)) {
          paraOAdmin.push(`  pedido ${o.id} · ${email} · "${rotulo}" em ${pagoEm.slice(0, 10)}`);
          continue;
        }
        const cursoId = item.sku ? CURSO_POR_SKU[item.sku] : undefined;
        if (!cursoId) {
          semMapa.push(`  pedido ${o.id} · item sem mapa: "${rotulo}"`);
          continue;
        }
        if (!existeCurso.has(cursoId)) {
          semMapa.push(`  pedido ${o.id} · curso ${cursoId} não existe em produção`);
          continue;
        }
        cursosDoPedido.push(cursoId);
      }
      if (cursosDoPedido.length === 0) continue;

      // Conta — por e-mail, sempre.
      const achado = (
        await client.query('select id from users where lower(email) = $1', [email])
      ).rows[0] as { id: string } | undefined;
      let userId = achado?.id;
      if (!userId) {
        userId = idDeterministico(email);
        await client.query(
          `insert into users (id, email, name, role, created_at, updated_at)
           values ($1, $2, $3, 'student', $4, $4)
           on conflict (email) do nothing`,
          [userId, email, nome, new Date(pagoEm)],
        );
        contasNovas++;
      }

      await client.query(
        `insert into students (id, user_id, weekly_goal_minutes, total_study_minutes, risk_score, status, created_at)
         values ($1, $1, 180, 0, 0, 'ativo', $2)
         on conflict (id) do nothing`,
        [userId, new Date(pagoEm)],
      );

      for (const cursoId of cursosDoPedido) {
        const meses = mesesPorCurso.get(cursoId);
        const expira = meses ? new Date(addMonths(new Date(pagoEm).toISOString(), meses)) : null;
        const r = await client.query(
          `insert into enrollments (id, student_id, course_id, progress, enrolled_at, expires_at)
           values ($1, $2, $3, 0, $4, $5)
           on conflict (student_id, course_id) do nothing`,
          [`enr-${userId}-${cursoId}`, userId, cursoId, new Date(pagoEm), expira],
        );
        if ((r.rowCount ?? 0) > 0) matriculasNovas++;
        else jaTinham++;
      }
    }

    log(`contas   → ${contasNovas} criada(s)`);
    log(`matrícula → ${matriculasNovas} nova(s) · ${jaTinham} já existia(m)`);
    if (semMapa.length) {
      log(`itens sem mapa de curso (${semMapa.length}):`);
      for (const l of semMapa.slice(0, 20)) console.log(l);
    }
    if (paraOAdmin.length) {
      log(`itens que exigem decisão do admin (${paraOAdmin.length}) — extensão/certificado:`);
      for (const l of paraOAdmin.slice(0, 20)) console.log(l);
    }

    if (COMMIT) {
      await client.query('COMMIT');
      log('*** COMMIT feito. ***');
      if (contasNovas > 0) {
        // Produção usa AUTH_STORE=db desde 19/ago/2026: a credencial mora nas
        // colunas de `users`, não mais em `data/users.json`. Conta criada aqui
        // nasce com `password_hash` nulo — e isso é o estado certo, não um
        // defeito: `bcrypt.compare` contra vazio falha, então ninguém entra sem
        // definir senha, e o "esqueci minha senha" encontra a conta.
        //
        // Nem `provision_missing_logins.ts` (que só escreve o JSON) nem restart
        // são necessários: `recarregarSeAusente()` em auth/users-store relê a
        // lista quando o e-mail procurado não está na memória do processo.
        log('');
        log(`As ${contasNovas} conta(s) criadas nascem SEM senha, de propósito.`);
        log('  Elas entram pelo "esqueci minha senha" — nada a rodar no VPS.');
        log('  (Só se AUTH_STORE=db estiver desligado é que a credencial voltaria');
        log('   a viver em data/users.json e o provisionamento seria preciso.)');
      }
    } else {
      await client.query('ROLLBACK');
      log('DRY-RUN → ROLLBACK (nada gravado). Rode com --commit para aplicar.');
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[wc-delta] ERRO — rollback feito:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

void main();

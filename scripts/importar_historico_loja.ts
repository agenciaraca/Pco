/**
 * Traz para o AVA o histórico inteiro da loja WooCommerce: pedidos e a situação
 * de matrícula que cada um implica.
 *
 * Motivo: até 1/set/2026 o AVA não tinha um único pedido. A receita de cinco
 * anos — R$ 1,38 milhão em 1.143 pedidos pagos — vivia só na loja, e o admin
 * mostrava um aluno matriculado sem nunca poder dizer *por que*. Sem o pedido,
 * "matriculado" é afirmação sem lastro.
 *
 * ## A regra, que é do dono
 *
 *   pedido concluído (completed/processing) ....... matrícula ATIVA
 *   estorno (refunded/reembolsado) ................ matrícula CANCELADA
 *   desistência (desistente) ...................... matrícula CANCELADA
 *   em atraso (on-hold/em-atraso/pending) ......... matrícula SUSPENSA
 *   cancelado antes de pagar (cancelled/failed) ... sem matrícula
 *
 * O prazo do curso continua valendo por cima disso: matrícula ativa de 2021
 * nasce vencida, porque `accessMonths` conta da data do pedido. Situação e
 * prazo são perguntas diferentes — ver `server/access/guard.ts`.
 *
 * ## O que este script nunca faz
 *
 * - **Não apaga matrícula.** Estorno vira `cancelada`, não DELETE: o histórico
 *   do aluno é o produto aqui.
 * - **Não rebaixa quem veio do portal.** Matrícula que existe sem pedido
 *   correspondente (acesso concedido pela escola no LearnDash) fica como está.
 *   Só mexe onde há pedido dizendo o contrário.
 * - **Não inventa curso.** Item da loja que não casa com curso do AVA entra
 *   como pedido e não gera matrícula nenhuma.
 *
 * Fonte: `exportacoes/loja-dump-pedidos.json`, extraído do dump SQL da loja.
 *
 * Uso:
 *   npx tsx scripts/importar_historico_loja.ts             # DRY-RUN
 *   npx tsx scripts/importar_historico_loja.ts --commit
 */

import 'dotenv/config';
import { promises as fs } from 'node:fs';
import pg from 'pg';
import {
  DA_LOJA,
  situacaoMaisForte,
  type SituacaoMatricula,
  type StatusPedidoAva,
} from '../server/access/situacao-matricula';

const COMMIT = process.argv.includes('--commit');
const ARQUIVO = 'exportacoes/loja-dump-pedidos.json';
const log = (m: string) => console.log(`[loja-historico] ${m}`);

interface ItemLoja {
  nome: string | null;
  produto_wp: string | null;
  qtd: string | null;
  total: string | null;
}
interface PedidoLoja {
  id: string;
  status: string;
  criado_em: string;
  email: string;
  nome: string;
  telefone: string;
  documento: string;
  total: number;
  moeda: string;
  forma_pagamento: string;
  pago_em: string;
  itens: ItemLoja[];
}

/**
 * A regra de "que status implica que situação" vive em
 * `server/access/situacao-matricula.ts`, não aqui: script não é lugar de regra
 * de negócio que ninguém testa. Ver o comentário de lá.
 */
type Situacao = SituacaoMatricula;
type StatusAva = StatusPedidoAva;
const MAPA = DA_LOJA;

/** Item da loja que não dá acesso a curso nenhum. */
const SEM_ACESSO = /extens[ãa]o|certificado|sess[ãa]o|taxa|frete|material/i;

/** produto da loja → curso no AVA. Conferido contra data/payment-products.json. */
const CURSO_POR_PRODUTO: Record<string, string> = {
  '8034': '14839',
  '13464': '12245',
};

function cursoDoItem(it: ItemLoja): string | null {
  if (it.produto_wp && CURSO_POR_PRODUTO[it.produto_wp]) return CURSO_POR_PRODUTO[it.produto_wp];
  const n = (it.nome ?? '').toLowerCase();
  if (!n || SEM_ACESSO.test(n)) return null;
  if (/hipno/.test(n)) return '8748';
  if (/terapia familiar/.test(n)) return '12245';
  if (/super aluno/.test(n)) return '8887';
  if (/psican[áa]lise/.test(n)) return '14839';
  return null;
}

function quando(p: PedidoLoja): Date {
  const s = p.pago_em || p.criado_em;
  const d = new Date(String(s).replace(' ', 'T') + (String(s).endsWith('Z') ? '' : 'Z'));
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function idDeterministico(email: string): string {
  const base = email.replace(/[^a-z0-9]/gi, '').slice(0, 18).toLowerCase();
  return `wc-${base}-${email.length}`;
}

function stripSsl(url: string): string {
  return url.replace(/([?&])sslmode=[^&]*/gi, '$1').replace(/[?&]$/, '');
}

async function main(): Promise<void> {
  log(`modo: ${COMMIT ? '*** COMMIT (grava) ***' : 'DRY-RUN (nada é gravado)'}`);
  const pedidos = JSON.parse(await fs.readFile(ARQUIVO, 'utf8')) as PedidoLoja[];
  log(`${pedidos.length} pedido(s) no dump da loja`);

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('ERRO: DATABASE_URL ausente.');
    process.exit(1);
  }
  const c = new pg.Client({ connectionString: stripSsl(url), ssl: { rejectUnauthorized: false } });
  await c.connect();

  const cursos = new Set(
    (await c.query('select id from courses')).rows.map((r: { id: string }) => r.id),
  );
  const contaPorEmail = new Map<string, string>();
  for (const r of (await c.query('select id, lower(email) e from users')).rows as Array<{ id: string; e: string }>) {
    contaPorEmail.set(r.e, r.id);
  }
  const jaTemPedido = new Set(
    (await c.query("select id from payment_orders where id like 'loja-wp-%'")).rows.map(
      (r: { id: string }) => r.id,
    ),
  );
  const matricula = new Map<string, { id: string; status: string; enrolledAt: Date }>();
  for (const r of (
    await c.query(
      `select en.id, lower(u.email) e, en.course_id, en.status, en.enrolled_at
       from enrollments en join users u on u.id = en.student_id`,
    )
  ).rows as Array<{ id: string; e: string; course_id: string; status: string; enrolled_at: Date }>) {
    matricula.set(`${r.e}|${r.course_id}`, { id: r.id, status: r.status, enrolledAt: r.enrolled_at });
  }

  // ---------- 1. pedidos ----------
  const paraGravar: Array<{ id: string; p: PedidoLoja; ava: StatusAva; curso: string | null }> = [];
  const semMapa = new Map<string, number>();
  let semEmail = 0, statusDesconhecido = 0;

  // ---------- 2. situação por (email, curso) ----------
  const desejado = new Map<string, { situacao: Situacao; desde: Date; nome: string; email: string; curso: string }>();

  for (const p of pedidos) {
    const m = MAPA[p.status];
    if (!m) { statusDesconhecido++; continue; }
    if (!p.email) { semEmail++; continue; }
    const cursoDoPedido = p.itens.map(cursoDoItem).find(Boolean) ?? null;
    for (const it of p.itens) {
      if (!cursoDoItem(it) && it.nome && !SEM_ACESSO.test(it.nome)) {
        semMapa.set(it.nome, (semMapa.get(it.nome) ?? 0) + 1);
      }
    }
    paraGravar.push({ id: `loja-wp-${p.id}`, p, ava: m.ava, curso: cursoDoPedido });

    for (const it of p.itens) {
      const curso = cursoDoItem(it);
      if (!curso || !cursos.has(curso) || m.situacao === 'nenhuma') continue;
      const k = `${p.email}|${curso}`;
      const atual = desejado.get(k);
      const d = quando(p);
      if (!atual) {
        desejado.set(k, { situacao: m.situacao, desde: d, nome: p.nome, email: p.email, curso });
        continue;
      }
      const vence = situacaoMaisForte(atual.situacao, m.situacao);
      if (vence !== atual.situacao) {
        desejado.set(k, { situacao: m.situacao, desde: d, nome: p.nome, email: p.email, curso });
      } else if (vence === m.situacao && d < atual.desde) {
        // Mesma força: a data mais antiga é a que vale como início do acesso.
        atual.desde = d;
      }
    }
  }

  const novos = paraGravar.filter((x) => !jaTemPedido.has(x.id));
  log(`pedidos a gravar: ${novos.length} (${jaTemPedido.size} já estavam) · sem e-mail: ${semEmail} · status fora do mapa: ${statusDesconhecido}`);

  // ---------- 3. o que muda nas matrículas ----------
  let criar = 0, suspender = 0, cancelar = 0, reativar = 0, semMudanca = 0, semConta = 0;
  const acoes: Array<{ k: string; alvo: Situacao; d: (typeof desejado extends Map<string, infer V> ? V : never) }> = [];
  for (const [k, d] of desejado) {
    const atual = matricula.get(k);
    if (!atual) {
      criar++;
      if (!contaPorEmail.has(d.email)) semConta++;
      acoes.push({ k, alvo: d.situacao, d });
      continue;
    }
    if (atual.status === d.situacao) { semMudanca++; continue; }
    if (d.situacao === 'suspensa') suspender++;
    else if (d.situacao === 'cancelada') cancelar++;
    else reativar++;
    acoes.push({ k, alvo: d.situacao, d });
  }

  log('');
  log('=== o que a regra implica ===');
  log(`  matrículas a criar ................ ${criar}  (${semConta} sem conta no AVA)`);
  log(`  a suspender (pagamento pendurado) . ${suspender}`);
  log(`  a cancelar (estorno/desistência) .. ${cancelar}`);
  log(`  a reativar ........................ ${reativar}`);
  log(`  já corretas ....................... ${semMudanca}`);
  const porSituacao = new Map<Situacao, number>();
  for (const d of desejado.values()) porSituacao.set(d.situacao, (porSituacao.get(d.situacao) ?? 0) + 1);
  log(`  situação-alvo: ${[...porSituacao].map(([s, n]) => `${s} ${n}`).join(' · ')}`);

  // Conta nova é o que mais pesa nesta operação: cada uma é uma pessoa que
  // passa a existir no AVA. Vale saber de que tipo de pedido ela vem antes de
  // gravar — conta criada por pedido cancelado seria ruído, não histórico.
  const novasPorSituacao = new Map<Situacao, number>();
  const emailsNovos = new Set<string>();
  for (const { alvo, d } of acoes) {
    if (contaPorEmail.has(d.email) || emailsNovos.has(d.email)) continue;
    emailsNovos.add(d.email);
    novasPorSituacao.set(alvo, (novasPorSituacao.get(alvo) ?? 0) + 1);
  }
  log(`  contas novas (${emailsNovos.size} pessoas): ${[...novasPorSituacao].map(([s, n]) => `${s} ${n}`).join(' · ')}`);
  if (semMapa.size) {
    log('');
    log('itens da loja sem curso correspondente (entram como pedido, sem matrícula):');
    for (const [n, q] of [...semMapa].sort((a, b) => b[1] - a[1]).slice(0, 10)) log(`   ${String(q).padStart(4)}  ${n.slice(0, 58)}`);
  }

  if (!COMMIT) {
    log('');
    log('DRY-RUN — nada gravado. Rode com --commit para aplicar.');
    await c.end();
    return;
  }

  await c.query('BEGIN');
  try {
    // pedidos
    for (const { id, p, ava, curso } of novos) {
      const item = p.itens[0];
      await c.query(
        `insert into payment_orders
           (id, user_id, user_email, product_id, product_snapshot, gateway_id, gateway_provider,
            external_id, status, amount_cents, currency, events, created_at, updated_at, paid_at)
         values ($1,$2,$3,$4,$5,$6,'legado-wp',$7,$8,$9,$10,$11,$12,$12,$13)
         on conflict (id) do nothing`,
        [
          id,
          contaPorEmail.get(p.email) ?? '',
          p.email,
          `loja-wp-${item?.produto_wp ?? 'sem-produto'}`,
          JSON.stringify({
            name: item?.nome ?? 'Pedido da loja',
            priceCents: Math.round(p.total * 100),
            currency: p.moeda || 'BRL',
            kind: curso ? 'course' : 'outro',
            refId: curso,
          }),
          'loja-wp-legado',
          String(p.id),
          ava,
          Math.round(p.total * 100),
          p.moeda || 'BRL',
          JSON.stringify([
            {
              ts: quando(p).toISOString(),
              status: ava,
              // O status original é o que explica o caso. `desistente` e
              // `em-atraso` não existem no AVA e se perderiam aqui.
              note: `importado da loja · status na origem: ${p.status} · ${p.forma_pagamento || 'forma não registrada'}`,
            },
          ]),
          quando(p),
          p.pago_em ? quando(p) : null,
        ],
      );
    }

    // matrículas
    let feitas = 0, contasNovas = 0;
    for (const { alvo, d } of acoes) {
      let uid = contaPorEmail.get(d.email);
      if (!uid) {
        uid = idDeterministico(d.email);
        await c.query(
          `insert into users (id, email, name, role, active, created_at, updated_at, token_version)
           values ($1,$2,$3,'student',true,$4,now(),0) on conflict (id) do nothing`,
          [uid, d.email, d.nome || d.email, d.desde],
        );
        contaPorEmail.set(d.email, uid);
        contasNovas++;
      }
      await c.query(
        `insert into students (id, user_id, status, created_at) values ($1,$1,'ativo',$2)
         on conflict (id) do nothing`,
        [uid, d.desde],
      );
      const existente = matricula.get(`${d.email}|${d.curso}`);
      if (existente) {
        await c.query('update enrollments set status = $2 where id = $1', [existente.id, alvo]);
      } else {
        await c.query(
          `insert into enrollments (id, student_id, course_id, progress, enrolled_at, status)
           values ($1,$2,$3,0,$4,$5) on conflict (id) do nothing`,
          [`wc-${uid}-${d.curso}`.slice(0, 60), uid, d.curso, d.desde, alvo],
        );
      }
      feitas++;
    }
    await c.query('COMMIT');
    log('');
    log(`*** COMMIT feito. ${novos.length} pedido(s) · ${feitas} matrícula(s) · ${contasNovas} conta(s) nova(s) ***`);
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error('FALHOU:', e.message);
  process.exit(1);
});

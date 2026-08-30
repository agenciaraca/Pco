/**
 * Quantas pessoas perdem o acesso se a entrada passar a exigir pedido pago?
 *
 * Só lê. Existe porque a regra "ninguém entra sem pedido pago" tem um efeito
 * que não dá para estimar de cabeça: os alunos vindos da migração pagaram no
 * WooCommerce/LearnDash, e esse pagamento **não existe** como pedido no AVA.
 * Para eles, "sem pedido pago" não quer dizer "não pagou" — quer dizer "pagou
 * noutro sistema".
 *
 * A conta que interessa é a última: matriculado, portanto alguém que estudava,
 * e sem nenhum pedido pago aqui. É essa gente que a regra tranca.
 *
 * Uso:
 *   DATABASE_URL=... npx tsx scripts/medir_impacto_portao.ts
 *
 * DivZ usa cert self-signed → ssl.rejectUnauthorized=false, como os demais.
 */

import pg from 'pg';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error('ERRO: defina DATABASE_URL no ambiente.');
  process.exit(1);
}

// Mesma razão de server/db/client.ts: o pg-connection-string moderno trata
// `sslmode=require` como `verify-full` e rejeita o cert self-signed do DivZ.
function stripSslParams(url: string): string {
  return url.replace(/([?&])sslmode=[^&]*/gi, '$1').replace(/[?&]$/, '');
}

async function main(): Promise<void> {
  const client = new pg.Client({
    connectionString: stripSslParams(DB_URL as string),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const um = async (sql: string): Promise<number> => {
    const r = await client.query(sql);
    return Number(r.rows[0]?.n ?? 0);
  };

  const existeTabela = async (nome: string): Promise<boolean> => {
    const r = await client.query(
      "select 1 from information_schema.tables where table_name = $1 limit 1",
      [nome],
    );
    return r.rowCount === 1;
  };

  const alunos = await um("select count(*)::int n from users where role = 'student'");
  const comFicha = await um('select count(*)::int n from students');
  const comMatricula = await um(
    'select count(distinct student_id)::int n from enrollments',
  );

  const temPedidos = await existeTabela('payment_orders');
  if (!temPedidos) {
    console.log('\n=== IMPACTO DO PORTÃO ===');
    console.log(`alunos (users.role=student) ......... ${alunos}`);
    console.log(`com ficha de aluno .................. ${comFicha}`);
    console.log(`com ao menos uma matrícula .......... ${comMatricula}`);
    console.log('\nNÃO EXISTE a tabela payment_orders neste banco.');
    console.log('Ou seja: ZERO pessoas têm pedido pago registrado aqui.');
    console.log(`Exigir pedido pago trancaria TODOS os ${comMatricula} matriculados.`);
    await client.end();
    return;
  }

  const comPedidoPago = await um(
    "select count(distinct user_id)::int n from payment_orders where status = 'paid'",
  );
  const pedidosPagos = await um(
    "select count(*)::int n from payment_orders where status = 'paid'",
  );
  // O número que decide: quem estudava e seria trancado.
  const matriculadoSemPedido = await um(`
    select count(*)::int n from (
      select distinct e.student_id as id from enrollments e
      except
      select distinct o.user_id from payment_orders o where o.status = 'paid'
    ) t
  `);

  console.log('\n=== IMPACTO DO PORTÃO "só entra com pedido pago" ===');
  console.log(`alunos (users.role=student) ......... ${alunos}`);
  console.log(`com ficha de aluno .................. ${comFicha}`);
  console.log(`com ao menos uma matrícula .......... ${comMatricula}`);
  console.log(`pedidos pagos (total) ............... ${pedidosPagos}`);
  console.log(`pessoas com pedido pago ............. ${comPedidoPago}`);
  console.log('');
  console.log(`>> MATRICULADOS SEM PEDIDO PAGO ..... ${matriculadoSemPedido}`);
  const pct = comMatricula > 0 ? ((matriculadoSemPedido / comMatricula) * 100).toFixed(1) : '0';
  console.log(`   (${pct}% de quem tem matrícula perderia o acesso)`);
  console.log('');
  console.log('Esses são, em boa parte, alunos da migração: pagaram no sistema');
  console.log('antigo, e o pagamento não veio como pedido para cá.');

  await client.end();
}

main().catch((err) => {
  console.error('[impacto-portao] FALHOU:', err);
  process.exit(1);
});

/**
 * Exporta a base de alunos no formato de importação do AraraSend.
 *
 * Uso:
 *   DATABASE_URL=<owner ou app> npx tsx scripts/exportar_contatos_email.ts \
 *     --saida "C:/Users/Usuario/Downloads/contatos.csv"
 *
 * ## O formato é do provedor, não nosso
 *
 * Separador `;`, UTF-8 **com BOM**, quebra de linha LF — copiado do modelo que
 * o AraraSend distribui. O BOM não é enfeite: sem ele o Excel abre o arquivo em
 * ANSI e todo nome acentuado chega torto ao provedor.
 *
 * ## O que NÃO entra, e por quê
 *
 * - **Equipe.** Só `role = 'student'`. Mandar campanha de captação para o
 *   próprio administrador polui métrica de abertura e não vende nada.
 * - **Quem pediu para não receber.** A lista sai de `data/notification-prefs.json`
 *   (o store de preferências) e de `data/deletion-requests.json`. Consentimento
 *   revogado não volta por importação de planilha — e este projeto já teve o
 *   caso: o arquivo de preferências esteve versionado como `[]` e cada deploy
 *   ressuscitava a lista. Ver a seção "Versionar arquivo em `data/`" no
 *   CLAUDE.md.
 *
 * ## `status`: o campo que protege o domínio da escola
 *
 * - `unsubscribed` — pediu para sair. Nunca mais recebe.
 * - `subscribed` — **tem relação com a escola**: já pagou um pedido, ou entrou
 *   alguma vez, ou tem matrícula em algum curso. Aluno matriculado em 2021 que
 *   nunca entrou no AVA novo continua sendo aluno: o endereço é antigo, não é
 *   frio.
 * - `unconfirmed` — nunca pagou, nunca entrou e **não tem matrícula nenhuma**.
 *   É o cadastro que a loja do WordPress acumulou (`subscriber`, `customer`) e
 *   que nunca virou aluno.
 *
 * Nome envenenado por robô **não** rebaixa ninguém: quem pagou tem endereço
 * provado, porque recebeu recibo por ele. O nome sujo vira a etiqueta
 * `nome-suspeito`, para alguém limpar — não motivo para não falar com a pessoa.
 *
 * Essa separação existe porque disparar para milhares de endereços que nunca
 * confirmaram nada é como se queima a reputação de um domínio — e o domínio é
 * o mesmo por onde saem boleto, certificado e recuperação de senha.
 */

import 'dotenv/config';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

interface Linha {
  email: string;
  nome: string;
  sobrenome: string;
  telefone: string;
  empresa: string;
  status: 'subscribed' | 'unconfirmed' | 'unsubscribed';
  tags: string[];
  cargo: string;
  cidade: string;
  estado: string;
  origem: string;
  aniversario: string;
}

const COLUNAS = [
  'email',
  'nome',
  'sobrenome',
  'telefone',
  'empresa',
  'status',
  'tags',
  'cargo',
  'cidade',
  'estado',
  'origem',
  'aniversario',
] as const;

/** Campo com `;`, aspas ou quebra de linha precisa ser citado. */
function campo(v: string): string {
  if (/[;"\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

/**
 * Nome que não serve para cumprimentar ninguém.
 *
 * A importação do WordPress trouxe `display_name` envenenado por robôs de SEO
 * — endereços de e-mail e URLs no lugar do nome. `filterSpam()` limpou 436 na
 * entrada e sobrou resíduo. Mandar "Olá, www.vk.com" é pior do que mandar
 * "Olá" sem nome, então o campo vai vazio e a linha leva a etiqueta
 * `nome-suspeito` para alguém arrumar depois.
 */
function nomeUsavel(nome: string): boolean {
  const n = nome.trim();
  if (n.length < 2) return false;
  if (n.includes('@')) return false;
  return !/(https?:\/\/|www\.|\.com|\.ru|vk\.com)/i.test(n);
}

const STATUS_PEDIDO: Record<string, string> = {
  paid: 'pago',
  pending: 'pendente',
  processing: 'processando',
  canceled: 'cancelado',
  refunded: 'estornado',
  failed: 'falhou',
};

function faixaDeProgresso(p: number): string {
  if (p >= 100) return 'concluido';
  if (p >= 50) return '50-99';
  if (p > 0) return '1-49';
  return 'zero';
}

async function lerOptOuts(dataDir: string): Promise<Set<string>> {
  const fora = new Set<string>();
  for (const arquivo of ['notification-prefs.json', 'deletion-requests.json']) {
    try {
      const bruto = await fs.readFile(path.join(dataDir, arquivo), 'utf8');
      const lista = JSON.parse(bruto) as Array<Record<string, unknown>>;
      for (const item of lista) {
        // Formatos diferentes por store; o que importa é achar o endereço e
        // saber se a pessoa recusou. Na dúvida sobre o formato, **exclui**.
        const email = String(item.email ?? item.userEmail ?? '').toLowerCase();
        if (!email) continue;
        const recusou =
          item.unsubscribed === true ||
          item.optOut === true ||
          item.marketing === false ||
          item.status === 'completed' ||
          item.status === 'pending';
        if (recusou) fora.add(email);
      }
    } catch {
      // Arquivo ausente é o caso normal em base nova: ninguém se descadastrou
      // ainda. Não é o mesmo que "ninguém quer sair" — é "ninguém pediu por
      // aqui" —, e por isso o relatório final imprime a contagem.
    }
  }
  return fora;
}

async function main() {
  const args = process.argv.slice(2);
  const saida =
    args[args.indexOf('--saida') + 1] && args.includes('--saida')
      ? args[args.indexOf('--saida') + 1]!
      : 'contatos-email.csv';
  const dataDir = process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data');

  const url = (process.env.DATABASE_URL ?? '')
    .replace(/([?&])sslmode=[^&]*/gi, '$1')
    .replace(/([?&])channel_binding=[^&]*/gi, '$1')
    .replace(/[?&]$/, '');
  if (!url) {
    console.error('[export] DATABASE_URL ausente.');
    process.exit(1);
  }
  const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

  const [usuarios, fichas, matriculas, pedidos] = await Promise.all([
    pool.query(`select id, email, name, role, active, password_hash, last_login_at, created_at
                  from users where role = 'student' order by created_at`),
    pool.query(`select user_id, id, source_role, status, last_access_at from students`),
    pool.query(`select e.student_id, e.status, e.progress, e.expires_at,
                       coalesce(c.slug, e.course_id) slug
                  from enrollments e left join courses c on c.id = e.course_id`),
    pool.query(`select user_id, status, paid_at, created_at, attribution
                  from payment_orders order by created_at`),
  ]);

  const fichaPorUser = new Map<string, (typeof fichas.rows)[number]>();
  const fichaPorId = new Map<string, string>();
  for (const f of fichas.rows) {
    fichaPorUser.set(String(f.user_id), f);
    fichaPorId.set(String(f.id), String(f.user_id));
  }
  const matriculasPorUser = new Map<string, Array<(typeof matriculas.rows)[number]>>();
  for (const m of matriculas.rows) {
    const userId = fichaPorId.get(String(m.student_id));
    if (!userId) continue;
    const lista = matriculasPorUser.get(userId) ?? [];
    lista.push(m);
    matriculasPorUser.set(userId, lista);
  }
  const pedidosPorUser = new Map<string, Array<(typeof pedidos.rows)[number]>>();
  for (const p of pedidos.rows) {
    const lista = pedidosPorUser.get(String(p.user_id)) ?? [];
    lista.push(p);
    pedidosPorUser.set(String(p.user_id), lista);
  }

  const optOuts = await lerOptOuts(dataDir);
  const linhas: Linha[] = [];
  const resumo = {
    total: 0,
    subscribed: 0,
    unconfirmed: 0,
    unsubscribed: 0,
    comCompraPaga: 0,
    semFicha: 0,
    nomeSuspeito: 0,
  };

  for (const u of usuarios.rows) {
    const email = String(u.email).trim().toLowerCase();
    const ficha = fichaPorUser.get(String(u.id));
    const minhasMatriculas = matriculasPorUser.get(String(u.id)) ?? [];
    const meusPedidos = pedidosPorUser.get(String(u.id)) ?? [];
    const tags: string[] = [];

    // ---- pedido ----
    const pago = meusPedidos.some((p) => p.status === 'paid');
    const ultimo = meusPedidos[meusPedidos.length - 1];
    tags.push(
      `pedido:${ultimo ? (STATUS_PEDIDO[String(ultimo.status)] ?? String(ultimo.status)) : 'nenhum'}`,
    );
    if (pago) tags.push('ja-comprou');

    // ---- matrícula ----
    if (minhasMatriculas.length === 0) {
      tags.push('matricula:nenhuma');
    } else {
      const situacoes = new Set(minhasMatriculas.map((m) => String(m.status)));
      const principal = situacoes.has('ativa')
        ? 'ativa'
        : situacoes.has('suspensa')
          ? 'suspensa'
          : 'cancelada';
      tags.push(`matricula:${principal}`);
      for (const m of minhasMatriculas) tags.push(`curso:${String(m.slug)}`);
      const melhor = Math.max(...minhasMatriculas.map((m) => Number(m.progress) || 0));
      tags.push(`progresso:${faixaDeProgresso(melhor)}`);
      if (melhor >= 100) tags.push('concluiu-curso');
      const agora = Date.now();
      if (minhasMatriculas.some((m) => m.expires_at && new Date(m.expires_at).getTime() < agora)) {
        tags.push('acesso-vencido');
      }
    }

    // ---- origem e engajamento ----
    if (ficha?.source_role) tags.push(`origem:${String(ficha.source_role)}`);
    if (!ficha) {
      tags.push('sem-ficha');
      resumo.semFicha += 1;
    }
    if (!u.last_login_at) tags.push('nunca-entrou');
    if (!u.password_hash) tags.push('sem-senha');

    // ---- nome ----
    const bruto = String(u.name ?? '').trim();
    const usavel = nomeUsavel(bruto);
    if (!usavel) {
      tags.push('nome-suspeito');
      resumo.nomeSuspeito += 1;
    }

    // ---- status de inscrição ----
    // Nome sujo **não** rebaixa quem tem relação com a escola. Quem pagou e
    // concluiu curso tem endereço provado — recebeu recibo por ele. O que o
    // `display_name` envenenado pelo robô estraga é o cumprimento do e-mail,
    // não a validade do contato; por isso ele vira etiqueta, e não status.
    const temRelacao = pago || Boolean(u.last_login_at) || minhasMatriculas.length > 0;
    let status: Linha['status'];
    if (optOuts.has(email)) status = 'unsubscribed';
    else if (!temRelacao) status = 'unconfirmed';
    else status = 'subscribed';
    const partes = usavel ? bruto.split(/\s+/) : [];
    const nome = partes[0] ?? '';
    const sobrenome = partes.slice(1).join(' ');

    // ---- de onde veio ----
    const atribuido = [...meusPedidos]
      .reverse()
      .find((p) => p.attribution && (p.attribution as Record<string, unknown>).origem);
    // De onde a pessoa veio. `desconhecida` é resposta: a atribuição só passou
    // a ser gravada em 2/set/2026, e inventar "cadastro-ava" para quem veio da
    // migração seria escrever um fato que ninguém mediu.
    const origem = atribuido
      ? String((atribuido.attribution as Record<string, unknown>).origem)
      : ficha?.source_role
        ? 'importacao-wp'
        : 'desconhecida';

    linhas.push({
      email,
      nome,
      sobrenome,
      // Não há telefone em coluna nenhuma: a importação do WordPress descarta
      // `phone`, e o WhatsApp do checkout vai para o gateway sem ficar aqui.
      telefone: '',
      empresa: '',
      status,
      tags,
      cargo: '',
      cidade: '',
      estado: '',
      origem,
      aniversario: '',
    });

    resumo.total += 1;
    resumo[status] += 1;
    if (pago) resumo.comCompraPaga += 1;
  }

  const csv = [
    COLUNAS.join(';'),
    ...linhas.map((l) =>
      [
        l.email,
        l.nome,
        l.sobrenome,
        l.telefone,
        l.empresa,
        l.status,
        l.tags.join(','),
        l.cargo,
        l.cidade,
        l.estado,
        l.origem,
        l.aniversario,
      ]
        .map(campo)
        .join(';'),
    ),
  ].join('\n');

  // BOM: sem ele o Excel abre em ANSI e nome acentuado chega torto.
  await fs.writeFile(saida, '\ufeff' + csv + '\n', 'utf8');

  console.log(`[export] ${resumo.total} contatos -> ${saida}`);
  console.log(
    `[export] subscribed=${resumo.subscribed}  unconfirmed=${resumo.unconfirmed}  unsubscribed=${resumo.unsubscribed}`,
  );
  console.log(
    `[export] já compraram=${resumo.comCompraPaga}  sem ficha=${resumo.semFicha}  nome suspeito=${resumo.nomeSuspeito}  opt-outs conhecidos=${optOuts.size}`,
  );
  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('[export] falhou:', err instanceof Error ? err.message : err);
  process.exit(1);
});

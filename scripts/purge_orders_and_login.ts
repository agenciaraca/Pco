/**
 * Remove pedidos e a conta de login criada por eles.
 *
 * Serve para limpar tentativas de compra que falharam e deixaram rastro: o
 * checkout cria a conta antes de saber se o pagamento passa, então cinco
 * tentativas do mesmo cartão recusado viram cinco pedidos e uma conta órfã.
 *
 * Usa os mesmos stores da aplicação em vez de editar o JSON na mão. Editar o
 * arquivo com o app no ar não adianta: `users-store` mantém a lista em memória
 * e reescreve o arquivo inteiro na próxima gravação, desfazendo a edição. Ainda
 * assim, **pare o app antes** — o store que já está carregado não sabe destas
 * remoções:
 *
 *   pm2 stop ava-pco
 *   DATA_DIR=... npx tsx scripts/purge_orders_and_login.ts --orders=a,b --email=x --apply
 *   pm2 start ava-pco
 *
 * Não toca no Postgres. Se a mesma pessoa também existir lá (vinda da migração,
 * por exemplo), o script avisa e não decide por você — apagar aluno com
 * matrícula é outra conversa.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

const APPLY = process.argv.includes('--apply');
const log = (m: string) => console.log(`[purga] ${m}`);

const arg = (nome: string): string | null => {
  const a = process.argv.find((x) => x.startsWith(`--${nome}=`));
  return a ? a.slice(nome.length + 3) : null;
};

const ORDERS = (arg('orders') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const EMAIL = (arg('email') ?? '').toLowerCase().trim();

if (ORDERS.length === 0 && !EMAIL) {
  console.error('ERRO: informe --orders=id1,id2 e/ou --email=alguem@exemplo.com');
  process.exit(1);
}

const DATA_DIR = process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data');

interface Ordem {
  id: string;
  status?: string;
  userId?: string;
  productSnapshot?: { name?: string };
}
interface LoginUser {
  id: string;
  email: string;
  name?: string;
  role?: string;
  createdAt?: string;
}

async function carregar<T>(arquivo: string): Promise<{ caminho: string; itens: T[] } | null> {
  const caminho = path.join(DATA_DIR, arquivo);
  try {
    const j = JSON.parse(await fs.readFile(caminho, 'utf8'));
    return { caminho, itens: Array.isArray(j) ? (j as T[]) : [] };
  } catch {
    return null;
  }
}

async function gravar<T>(caminho: string, itens: T[]): Promise<void> {
  await fs.copyFile(caminho, `${caminho}.bak-${Date.now()}`);
  await fs.writeFile(caminho, JSON.stringify(itens, null, 2));
}

async function main(): Promise<void> {
  log(`modo: ${APPLY ? '*** APPLY (grava) ***' : 'DRY-RUN (não grava)'}`);
  log(`dados: ${DATA_DIR}`);

  const pedidos = await carregar<Ordem>('payment-orders.json');
  const logins = await carregar<LoginUser>('users.json');

  // Pedidos
  let idsDoDono: string[] = [];
  if (pedidos) {
    const alvo = pedidos.itens.filter((o) => ORDERS.includes(o.id));
    idsDoDono = [...new Set(alvo.map((o) => o.userId).filter(Boolean) as string[])];
    log(`pedidos: ${pedidos.itens.length} no arquivo · ${alvo.length} a remover`);
    for (const o of alvo) {
      console.log(`  ${o.id} · ${o.status ?? '?'} · dono=${o.userId ?? '-'} · ${o.productSnapshot?.name ?? ''}`);
    }
    const naoAchados = ORDERS.filter((id) => !pedidos.itens.some((o) => o.id === id));
    if (naoAchados.length) log(`AVISO: não encontrados: ${naoAchados.join(', ')}`);

    if (APPLY && alvo.length > 0) {
      await gravar(
        pedidos.caminho,
        pedidos.itens.filter((o) => !ORDERS.includes(o.id)),
      );
      log(`pedidos gravados: ${pedidos.itens.length - alvo.length} restantes (backup ao lado)`);
    }
  } else {
    log('payment-orders.json não encontrado');
  }

  // Conta de login
  if (logins) {
    const alvo = logins.itens.filter(
      (u) =>
        (EMAIL && u.email.toLowerCase() === EMAIL) || (u.id && idsDoDono.includes(u.id)),
    );
    log(`logins: ${logins.itens.length} no arquivo · ${alvo.length} a remover`);
    for (const u of alvo) {
      console.log(`  ${u.id} · ${u.email} · papel=${u.role ?? '?'} · criado=${(u.createdAt ?? '').slice(0, 10)}`);
    }
    if (APPLY && alvo.length > 0) {
      const remover = new Set(alvo.map((u) => u.id));
      await gravar(
        logins.caminho,
        logins.itens.filter((u) => !remover.has(u.id)),
      );
      log(`logins gravados: ${logins.itens.length - alvo.length} restantes (backup ao lado)`);
    }
  }

  if (!APPLY) {
    log('DRY-RUN: nada gravado. Rode com --apply (com o app parado).');
  } else {
    log('pronto. Suba o app: pm2 start ava-pco');
  }
}

void main();

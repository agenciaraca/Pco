/**
 * Remove produtos de pagamento duplicados.
 *
 * O import de produtos rodou mais de uma vez sem checar o que já existia, e cada
 * produto ficou com uma cópia por execução — em produção, três de cada, todas
 * ativas. O estrago é silencioso: a página de venda escolhe uma das cópias para
 * mostrar o preço, o checkout escolhe outra, e no dia em que alguém corrigir o
 * preço em apenas uma delas as duas passam a divergir sem ninguém notar.
 *
 * Regra de desempate, por grupo de (nome + curso vinculado):
 *   1. Vence a cópia que tem pedidos. Ela é a que o histórico referencia.
 *   2. Sem pedidos em nenhuma, vence a mais recente (o id carrega o timestamp).
 *   3. Perdedora COM pedidos é desativada, nunca apagada — apagar deixaria
 *      pedidos apontando para produto inexistente.
 *   4. Perdedora sem pedidos é removida.
 *
 * Uso (rode onde estão os JSONs — no VPS, dentro de ~/ava-pco):
 *   npx tsx scripts/dedupe_payment_products.ts
 *   npx tsx scripts/dedupe_payment_products.ts --apply
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

const APPLY = process.argv.includes('--apply');
const log = (m: string) => console.log(`[dedupe-produtos] ${m}`);

const DATA_DIR = process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data');
const PRODUTOS = path.join(DATA_DIR, 'payment-products.json');
const PEDIDOS = path.join(DATA_DIR, 'payment-orders.json');

interface Produto {
  id: string;
  name: string;
  kind?: string;
  refId?: string | null;
  priceCents?: number;
  active?: boolean;
}
interface Pedido {
  productId?: string;
  productSnapshot?: { id?: string };
}

async function lerJson<T>(p: string): Promise<T[]> {
  try {
    const j = JSON.parse(await fs.readFile(p, 'utf8'));
    return Array.isArray(j) ? (j as T[]) : [];
  } catch {
    return [];
  }
}

async function main(): Promise<void> {
  log(`modo: ${APPLY ? '*** APPLY (grava) ***' : 'DRY-RUN (não grava)'}`);
  log(`dados: ${DATA_DIR}`);

  const produtos = await lerJson<Produto>(PRODUTOS);
  const pedidos = await lerJson<Pedido>(PEDIDOS);
  if (produtos.length === 0) {
    log('nenhum produto encontrado — nada a fazer');
    return;
  }

  const usoPorProduto = new Map<string, number>();
  for (const o of pedidos) {
    const id = o.productId ?? o.productSnapshot?.id;
    if (id) usoPorProduto.set(id, (usoPorProduto.get(id) ?? 0) + 1);
  }

  // Sem pedidos, o desempate cai no id mais recente — e é exatamente aí que dá
  // para apagar o produto errado. O ambiente local não tem os pedidos que
  // produção tem: rodar isto na máquina de desenvolvimento removeria a cópia
  // que lá está ligada a 5 pedidos. Só grava onde os pedidos estão.
  if (pedidos.length === 0) {
    log('AVISO: nenhum pedido encontrado neste DATA_DIR.');
    log('  Se você esperava pedidos aqui, está no lugar errado — rode dentro de ~/ava-pco no VPS.');
    if (APPLY) {
      log('ABORTADO: gravar sem conhecer os pedidos pode apagar o produto que a produção referencia.');
      log('  Use FORCAR_SEM_PEDIDOS=1 se o ambiente realmente não tem pedidos.');
      if (!process.env.FORCAR_SEM_PEDIDOS) {
        process.exitCode = 2;
        return;
      }
    }
  }

  const grupos = new Map<string, Produto[]>();
  for (const p of produtos) {
    const chave = `${p.name}||${p.refId ?? ''}`;
    grupos.set(chave, [...(grupos.get(chave) ?? []), p]);
  }

  const manter: Produto[] = [];
  const desativar: Produto[] = [];
  const remover: Produto[] = [];

  for (const [chave, lista] of grupos) {
    if (lista.length === 1) {
      manter.push(lista[0]);
      continue;
    }
    const ordenada = [...lista].sort((a, b) => {
      const ua = usoPorProduto.get(a.id) ?? 0;
      const ub = usoPorProduto.get(b.id) ?? 0;
      if (ua !== ub) return ub - ua; // quem tem pedido primeiro
      return b.id.localeCompare(a.id); // depois o id mais recente
    });
    const [vencedor, ...perdedores] = ordenada;
    manter.push(vencedor);
    log(
      `grupo "${chave.split('||')[0]}": ${lista.length} cópias → fica ${vencedor.id} (${usoPorProduto.get(vencedor.id) ?? 0} pedido(s))`,
    );
    for (const p of perdedores) {
      if ((usoPorProduto.get(p.id) ?? 0) > 0) desativar.push({ ...p, active: false });
      else remover.push(p);
    }
  }

  log(`resultado: ${manter.length} mantido(s) · ${desativar.length} desativado(s) · ${remover.length} removido(s)`);
  for (const p of remover) console.log(`  remove ${p.id} · ${p.name}`);
  for (const p of desativar) console.log(`  desativa ${p.id} · ${p.name} (tem pedidos)`);

  if (!APPLY) {
    log('DRY-RUN: nada gravado. Rode com --apply para aplicar.');
    return;
  }

  const final = [...manter, ...desativar];
  const backup = `${PRODUTOS}.bak-${Date.now()}`;
  await fs.copyFile(PRODUTOS, backup);
  await fs.writeFile(PRODUTOS, JSON.stringify(final, null, 2));
  log(`gravado: ${final.length} produto(s). backup em ${path.basename(backup)}`);
}

void main();

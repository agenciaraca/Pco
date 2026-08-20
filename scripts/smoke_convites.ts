/**
 * Smoke dos endpoints de convite, pela porta da frente e com token de verdade.
 *
 * Confere o que a tela do admin consome: o panorama de quem recebe, a lista de
 * excluídos por motivo, e a simulação de envio — que precisa devolver
 * destinatários sem mandar e-mail nenhum.
 *
 * Simular é a única operação que este script executa de verdade; envio real não
 * acontece aqui de propósito, porque um smoke que dispara 25 e-mails para
 * clientes não é um smoke.
 *
 * Uso (no VPS, dentro de ~/ava-pco):
 *   DATABASE_URL=... AUTH_STORE=db JWT_SECRET=... npx tsx scripts/smoke_convites.ts
 */

import { signToken } from '../server/auth/jwt';
import * as store from '../server/auth/users-store';

const BASE = process.env.BASE ?? 'http://127.0.0.1:3035';
const log = (m: string) => console.log(`[smoke-convites] ${m}`);

let falhas = 0;
function checa(cond: boolean, desc: string): void {
  if (cond) log(`  ok    ${desc}`);
  else {
    falhas++;
    log(`  FALHA ${desc}`);
  }
}

async function main(): Promise<void> {
  await store.loadUsers();
  const todos = await store.listUsers();
  const admin = todos.find((u) => u.role === 'superadmin') ?? todos.find((u) => u.role === 'admin');
  if (!admin) {
    log('nenhuma conta administrativa encontrada');
    process.exitCode = 1;
    return;
  }

  // Token emitido aqui, com o mesmo segredo da aplicação: o smoke passa pelo
  // middleware de verdade, incluindo a checagem de papel.
  const token = await signToken({
    sub: admin.id,
    email: admin.email,
    role: admin.role,
    tv: admin.tokenVersion,
  });
  const h = { Authorization: `Bearer ${token}` };
  log(`autenticado como ${admin.email} (${admin.role})`);

  const seg = (await fetch(`${BASE}/api/admin/convites/segmentos`, { headers: h }).then((r) =>
    r.json(),
  )) as {
    total: number;
    elegiveis: number;
    porMotivo: Record<string, number>;
    rotulos: Record<string, string>;
    amostra: Array<{ nome: string; email: string; matriculas: number }>;
  };

  checa(typeof seg.total === 'number' && seg.total > 0, `panorama traz a base (${seg.total})`);
  checa(seg.elegiveis > 0, `há elegíveis (${seg.elegiveis})`);
  checa(seg.elegiveis < seg.total, 'nem todo mundo é elegível — os filtros estão agindo');
  checa(
    Object.keys(seg.porMotivo).length > 0,
    `motivos de exclusão vêm preenchidos (${Object.keys(seg.porMotivo).join(', ')})`,
  );
  checa(
    Object.keys(seg.porMotivo).every((m) => !!seg.rotulos[m]),
    'todo motivo tem rótulo legível — a tela não mostra código cru',
  );
  checa(
    seg.amostra.every((a) => a.matriculas > 0),
    'ninguém sem matrícula entra na amostra de elegíveis',
  );

  const exc = (await fetch(`${BASE}/api/admin/convites/excluidos?motivo=sem_matricula`, {
    headers: h,
  }).then((r) => r.json())) as { total: number; lista: Array<{ motivo: string }> };
  checa(exc.lista.length > 0, `lista de excluídos por motivo responde (${exc.lista.length})`);
  checa(
    exc.lista.every((p) => p.motivo === 'sem_matricula'),
    'o filtro por motivo não mistura categorias',
  );

  const sim = (await fetch(`${BASE}/api/admin/convites/enviar`, {
    method: 'POST',
    headers: { ...h, 'content-type': 'application/json' },
    body: JSON.stringify({ limite: 5, diasValidade: 7, simular: true }),
  }).then((r) => r.json())) as {
    simulado: boolean;
    enviados: number;
    restantes: number;
    destinatarios: Array<{ email: string }>;
  };
  checa(sim.simulado === true, 'a simulação se identifica como simulação');
  checa(sim.enviados === 0, 'simulação não envia nada');
  checa(sim.destinatarios?.length === 5, `simulação mostra os destinatários (${sim.destinatarios?.length})`);
  checa(sim.restantes === seg.elegiveis, 'a fila reportada bate com os elegíveis');

  const semToken = await fetch(`${BASE}/api/admin/convites/segmentos`);
  checa(semToken.status === 401, `sem token dá 401 (veio ${semToken.status})`);

  log('');
  if (falhas === 0) log('TUDO OK — a tela de convites tem com o que trabalhar.');
  else {
    log(`${falhas} FALHA(S).`);
    process.exitCode = 1;
  }
}

void main();

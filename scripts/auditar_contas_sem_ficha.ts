/**
 * Responde a pergunta que trava o disparo dos convites:
 *
 *   "As ~990 contas que têm login e nenhuma matrícula são clientes só da loja,
 *    ou são matrículas que a migração perdeu?"
 *
 * A diferença importa. Cliente da loja convidado para o AVA recebe acesso a um
 * ambiente onde não tem nada — constrangimento, não serviço. Aluno com
 * matrícula perdida convidado sem que a matrícula volte encontra um ambiente
 * vazio e conclui que perdeu o que pagou.
 *
 * O método, em três perguntas que a base responde sozinha:
 *
 *   1. De onde a conta veio? `external-references.json` prefixa a origem desde
 *      a correção v3: `psi:` é a loja (psicanaliseclinica.online), `portal:` é
 *      o LMS (portalpco.online). Conta que só existe na loja nunca foi aluna.
 *   2. Existe referência de matrícula para ela? Se existe e a ficha não existe,
 *      a migração perdeu — é o caso grave.
 *   3. Existe progresso de aula? Progresso sem matrícula é prova de que a
 *      pessoa estudou e a matrícula sumiu depois. É a evidência mais forte, e
 *      só vale quando há dados de progresso carregados — sem eles a resposta é
 *      "inconclusivo", nunca "ninguém estudou".
 *
 * Uso:
 *   npx tsx scripts/auditar_contas_sem_ficha.ts            # lê data/*.json
 *   DATABASE_URL=... npx tsx scripts/auditar_contas_sem_ficha.ts --db
 *   npx tsx scripts/auditar_contas_sem_ficha.ts --listar=portal-sem-ficha
 *
 * Só lê. Não escreve em lugar nenhum.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data');

interface Conta {
  id: string;
  email?: string;
  name?: string;
}
interface Ficha {
  id: string;
  enrolledCourseIds?: string[];
}
interface Ref {
  externalEntityType?: string;
  externalId?: string;
  internalId?: string;
}

async function ler<T>(arquivo: string): Promise<T[]> {
  try {
    const cru = await fs.readFile(path.join(DATA_DIR, arquivo), 'utf8');
    const j = JSON.parse(cru) as unknown;
    return (Array.isArray(j) ? j : Object.values(j as Record<string, unknown>)) as T[];
  } catch {
    return [];
  }
}

export interface Resultado {
  contas: number;
  fichas: number;
  semFicha: number;
  /** Só existem na loja: nunca foram alunas. Explicação benigna. */
  soLoja: number;
  /** Têm presença no LMS e nenhuma ficha: é aqui que mora a dúvida. */
  comPortal: number;
  /** Referência de matrícula sem ficha correspondente: migração perdeu. */
  matriculaPerdida: number;
  /** Progresso de aula sem ficha: prova de que estudou e sumiu. */
  progressoSemFicha: number;
  /** `false` quando não há dados de progresso — aí o item acima não conclui nada. */
  progressoDisponivel: boolean;
  amostraPortalSemFicha: Array<{ id: string; email: string }>;
}

export async function auditar(): Promise<Resultado> {
  const [contas, fichas, refs, progresso] = await Promise.all([
    ler<Conta>('users.json'),
    ler<Ficha>('admin-students.json'),
    ler<Ref>('external-references.json'),
    ler<{ userId?: string }>('lesson-progress.json'),
  ]);

  const comFicha = new Set(fichas.map((f) => f.id));
  const semFicha = contas.filter((c) => !comFicha.has(c.id));
  const semFichaIds = new Set(semFicha.map((c) => c.id));

  const origens = new Map<string, Set<string>>();
  let matriculaPerdida = 0;
  for (const r of refs) {
    const interno = String(r.internalId ?? '');
    const raiz = interno.split(':')[0] ?? '';
    if (r.externalEntityType === 'student' && semFichaIds.has(interno)) {
      const origem = String(r.externalId ?? '').split(':')[0] ?? '';
      if (!origens.has(interno)) origens.set(interno, new Set());
      origens.get(interno)!.add(origem);
    }
    // Matrícula apontando para conta sem ficha: a migração perdeu a ficha.
    if (r.externalEntityType === 'enrollment' && semFichaIds.has(raiz)) {
      matriculaPerdida++;
    }
  }

  let soLoja = 0;
  let comPortal = 0;
  const amostra: Array<{ id: string; email: string }> = [];
  const porEmail = new Map(contas.map((c) => [c.id, c.email ?? '']));
  for (const [id, ori] of origens) {
    if (ori.has('portal')) {
      comPortal++;
      if (amostra.length < 20) amostra.push({ id, email: porEmail.get(id) ?? '' });
    } else if (ori.has('psi')) {
      soLoja++;
    }
  }

  const progressoDisponivel = progresso.length > 0;
  const progressoSemFicha = progressoDisponivel
    ? new Set(progresso.map((p) => p.userId).filter((u): u is string => !!u && semFichaIds.has(u)))
        .size
    : 0;

  return {
    contas: contas.length,
    fichas: fichas.length,
    semFicha: semFicha.length,
    soLoja,
    comPortal,
    matriculaPerdida,
    progressoSemFicha,
    progressoDisponivel,
    amostraPortalSemFicha: amostra,
  };
}

async function main(): Promise<void> {
  const r = await auditar();
  const pct = (n: number) => (r.semFicha ? ((n / r.semFicha) * 100).toFixed(1) : '0.0');

  console.log('');
  console.log('Contas sem ficha de aluno — de onde vieram');
  console.log('===========================================');
  console.log(`contas de login .................. ${r.contas}`);
  console.log(`fichas de aluno .................. ${r.fichas}`);
  console.log(`contas SEM ficha ................. ${r.semFicha}`);
  console.log('');
  console.log(`só da loja (psi) ................. ${r.soLoja}  (${pct(r.soLoja)}%)`);
  console.log(`   ^ nunca foram alunas: explicação benigna`);
  console.log(`com presença no portal/LMS ....... ${r.comPortal}  (${pct(r.comPortal)}%)`);
  console.log(`   ^ é aqui que mora a dúvida`);
  console.log('');
  console.log(`matrículas órfãs (sem ficha) ..... ${r.matriculaPerdida}`);
  console.log(`   ^ > 0 significa migração perdeu ficha de quem tinha matrícula`);
  if (r.progressoDisponivel) {
    console.log(`progresso sem ficha .............. ${r.progressoSemFicha}`);
    console.log(`   ^ > 0 é prova: estudou e a matrícula sumiu`);
  } else {
    console.log(`progresso sem ficha .............. INCONCLUSIVO`);
    console.log(`   ^ não há dados de progresso nesta base; rodar onde houver`);
  }

  if (process.argv.includes('--listar=portal-sem-ficha')) {
    console.log('');
    console.log('Amostra (até 20) das contas com portal e sem ficha:');
    for (const a of r.amostraPortalSemFicha) console.log(`  ${a.id}  ${a.email}`);
  }
  console.log('');
}

// Só roda quando chamado direto; o `auditar()` é importável pelos testes.
if (process.argv[1] && process.argv[1].includes('auditar_contas_sem_ficha')) {
  void main();
}

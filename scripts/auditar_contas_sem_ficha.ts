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

import 'dotenv/config';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getDb, schema } from '../server/db/client';

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
  /**
   * `false` quando as referências não conhecem NENHUMA das contas sem ficha —
   * arquivo velho demais para a base atual. Aí `soLoja` e `comPortal` são
   * ausência de dado, não medição.
   */
  origemConclusiva: boolean;
  contasConhecidasPelasRefs: number;
  /** Quem tem progresso de aula e nenhuma ficha. Nome e caso, não só contagem. */
  estudaramSemFicha: Array<{ id: string; email: string }>;
}

/**
 * De onde saiu cada metade da conta. Vai no relatório de propósito.
 *
 * Misturar as fontes dá número que parece resposta e não é: contas do JSON
 * local (3, depois do reset) contra fichas do banco (635) sugere que a base
 * inteira perdeu ficha. O `--db` era citado aqui e no CLAUDE.md desde a
 * auditoria, e **nunca existiu no código** — a função sempre leu só JSON.
 */
export interface Fontes {
  contas: string;
  fichas: string;
  refs: string;
  progresso: string;
}

export async function auditar(usarDb = false): Promise<Resultado & { fontes: Fontes }> {
  const db = usarDb ? getDb() : null;
  if (usarDb && !db) {
    throw new Error('--db pedido e sem DATABASE_URL: recuse-se a responder com a base errada.');
  }

  // Contas e fichas saem do banco quando pedido; referência externa e progresso
  // NÃO TÊM tabela — vivem em `data/*.json` e só existem inteiros no servidor.
  // Rodar `--db` a partir de uma máquina com o `data/` zerado responde
  // "0 com presença no portal" sem que isso queira dizer nada.
  const [contasJson, fichasJson, refs, progresso] = await Promise.all([
    ler<Conta>('users.json'),
    ler<Ficha>('admin-students.json'),
    ler<Ref>('external-references.json'),
    ler<{ userId?: string }>('lesson-progress.json'),
  ]);

  const contas: Conta[] = db
    ? (await db.select({ id: schema.users.id, email: schema.users.email, name: schema.users.name }).from(schema.users)).map(
        (u) => ({ id: u.id, email: u.email ?? '', name: u.name ?? '' }),
      )
    : contasJson;

  const fichas: Ficha[] = db
    ? (await db.select({ id: schema.students.id }).from(schema.students)).map((f) => ({ id: f.id }))
    : fichasJson;

  const fontes: Fontes = {
    contas: db ? 'banco (users)' : `${DATA_DIR}/users.json`,
    fichas: db ? 'banco (students)' : `${DATA_DIR}/admin-students.json`,
    refs: `${DATA_DIR}/external-references.json (${refs.length} linhas)`,
    progresso: `${DATA_DIR}/lesson-progress.json (${progresso.length} linhas)`,
  };

  const comFicha = new Set(fichas.map((f) => f.id));
  const semFicha = contas.filter((c) => !comFicha.has(c.id));
  const semFichaIds = new Set(semFicha.map((c) => c.id));

  // As referências conhecem estas contas?
  //
  // Sem esta pergunta o relatório mentia por omissão: quando o arquivo é
  // anterior à recarga v3 de 07/jul/2026, nenhum id atual aparece nele e a
  // origem saía como `0 (0,0%)` — que se lê "nenhuma veio da loja", quando o
  // certo é "não sei". Mesma regra de `docs/analytics.md`: zero é "medi e não
  // houve"; travessão é "não medi".
  const idsNasRefs = new Set(
    refs
      .filter((r) => r.externalEntityType === 'student')
      .map((r) => String(r.internalId ?? '')),
  );
  const contasConhecidas = [...semFichaIds].filter((id) => idsNasRefs.has(id)).length;

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
  const quemEstudouSemFicha = progressoDisponivel
    ? [
        ...new Set(
          progresso.map((p) => p.userId).filter((u): u is string => !!u && semFichaIds.has(u)),
        ),
      ]
    : [];
  const progressoSemFicha = quemEstudouSemFicha.length;
  const porId = new Map(contas.map((c) => [c.id, c.email ?? '']));

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
    origemConclusiva: contasConhecidas > 0,
    contasConhecidasPelasRefs: contasConhecidas,
    estudaramSemFicha: quemEstudouSemFicha.map((id) => ({ id, email: porId.get(id) ?? '' })),
    fontes,
  };
}

async function main(): Promise<void> {
  const r = await auditar(process.argv.includes('--db'));
  const pct = (n: number) => (r.semFicha ? ((n / r.semFicha) * 100).toFixed(1) : '0.0');

  console.log('');
  console.log('Contas sem ficha de aluno — de onde vieram');
  console.log('===========================================');
  console.log(`fonte contas ..... ${r.fontes.contas}`);
  console.log(`fonte fichas ..... ${r.fontes.fichas}`);
  console.log(`fonte refs ....... ${r.fontes.refs}`);
  console.log(`fonte progresso .. ${r.fontes.progresso}`);
  console.log('');
  console.log(`contas de login .................. ${r.contas}`);
  console.log(`fichas de aluno .................. ${r.fichas}`);
  console.log(`contas SEM ficha ................. ${r.semFicha}`);
  console.log('');
  if (!r.origemConclusiva) {
    console.log(`origem das contas sem ficha ...... INCONCLUSIVO`);
    console.log(
      `   ^ as referências não conhecem NENHUMA das ${r.semFicha} contas sem ficha.`,
    );
    console.log(`     Ou o arquivo está ausente, ou é anterior à recarga v3 de`);
    console.log(`     07/jul/2026, que gerou ids novos. Zero aqui seria mentira:`);
    console.log(`     não é "nenhuma veio da loja", é "não dá para saber".`);
  } else {
    console.log(`só da loja (psi) ................. ${r.soLoja}  (${pct(r.soLoja)}%)`);
    console.log(`   ^ nunca foram alunas: explicação benigna`);
    console.log(`com presença no portal/LMS ....... ${r.comPortal}  (${pct(r.comPortal)}%)`);
    console.log(`   ^ é aqui que mora a dúvida`);
  }
  console.log('');
  console.log(`matrículas órfãs (sem ficha) ..... ${r.matriculaPerdida}`);
  console.log(`   ^ > 0 significa migração perdeu ficha de quem tinha matrícula`);
  if (r.progressoDisponivel) {
    console.log(`progresso sem ficha .............. ${r.progressoSemFicha}`);
    console.log(`   ^ > 0 é prova: estudou e a matrícula sumiu`);
    for (const p of r.estudaramSemFicha) console.log(`     · ${p.id}  ${p.email}`);
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

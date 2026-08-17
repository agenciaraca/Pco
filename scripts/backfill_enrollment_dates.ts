/**
 * Corrige a data de matrícula do conjunto local a partir do dump bruto da
 * coleta, sem precisar re-coletar dos WordPress.
 *
 * Por que existe: `enrollInCourse` carimbava `new Date()` como data de
 * matrícula, então as 1.090 matrículas locais (e as 1.109 de produção) ficaram
 * todas com 07/jul/2026 — o dia do import. Com prazo de acesso por curso, essa
 * data passou a decidir quando o aluno perde o acesso, e contar do dia errado
 * daria meses de acesso a quem já deveria ter vencido.
 *
 * De onde vem a data real, em ordem de confiança:
 *   1. `progress.started_at`     — quando o aluno abriu aquele curso (LearnDash)
 *   2. `student.registered_date` — quando a conta nasceu no WordPress; no portal
 *                                  o usuário é criado na compra, então serve de
 *                                  reserva para quem nunca abriu o curso
 *
 * Casamento local ↔ dump é por e-mail: os IDs locais são gerados a cada
 * execução do import e não sobrevivem entre coletas.
 *
 * Uso:
 *   npx tsx scripts/backfill_enrollment_dates.ts --from-raw=data/migration/<ts>
 *   npx tsx scripts/backfill_enrollment_dates.ts --from-raw=... --apply
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

const APPLY = process.argv.includes('--apply');
const fromArg = process.argv.find((a) => a.startsWith('--from-raw='));
const log = (m: string) => console.log(`[backfill-datas] ${m}`);

if (!fromArg) {
  console.error('ERRO: informe --from-raw=data/migration/<timestamp>');
  process.exit(1);
}
const RAW_DIR = path.resolve(process.cwd(), fromArg.slice('--from-raw='.length), 'raw');

interface RawDump {
  rowsByEntity: Record<string, Array<Record<string, unknown>>>;
}
interface LocalStudent {
  id: string;
  email?: string;
  enrolledCourseIds?: string[];
  enrollmentDates?: Record<string, string>;
  createdAt: string;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

/**
 * Normaliza para ISO, devolvendo null quando a data não presta. O dump traz
 * `""` e datas sem fuso vindas do MySQL; deixar uma dessas virar `Invalid Date`
 * gravaria lixo na matrícula e o prazo de acesso sairia indefinido.
 */
function iso(v: unknown): string | null {
  const s = str(v).trim();
  if (!s) return null;
  // "2025-06-26T14:32:00" sem fuso: o WordPress devolve em UTC.
  const comFuso = /(?:Z|[+-]\d{2}:?\d{2})$/.test(s) ? s : `${s}Z`;
  const d = new Date(comFuso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function readRaw(file: string): Promise<RawDump | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(RAW_DIR, file), 'utf8')) as RawDump;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  log(`modo: ${APPLY ? '*** APPLY (grava) ***' : 'DRY-RUN (não grava)'}`);
  log(`raw: ${RAW_DIR}`);

  const portal = await readRaw('portal.json');
  if (!portal) {
    console.error(`ERRO: portal.json não encontrado em ${RAW_DIR}`);
    process.exit(1);
  }
  const psi = await readRaw('psi.json');

  // e-mail → data de cadastro no WordPress (as duas origens)
  const cadastroPorEmail = new Map<string, string>();
  // e-mail → id externo, para cruzar com o progresso
  const emailPorIdExterno = new Map<string, string>();
  for (const dump of [portal, psi].filter(Boolean) as RawDump[]) {
    for (const s of dump.rowsByEntity.student ?? []) {
      const email = str(s.email).toLowerCase();
      if (!email) continue;
      const reg = iso(s.registered_date);
      if (reg && !cadastroPorEmail.has(email)) cadastroPorEmail.set(email, reg);
      const ext = str(s.external_user_id);
      if (ext) emailPorIdExterno.set(ext, email);
    }
  }

  // (e-mail, curso) → início real, do progresso
  const inicioPorEmailCurso = new Map<string, string>();
  for (const p of portal.rowsByEntity.progress ?? []) {
    const started = iso(p.started_at);
    if (!started) continue;
    const email = emailPorIdExterno.get(str(p.user_external_id));
    const course = str(p.course_external_id);
    if (!email || !course) continue;
    const chave = `${email}|${course}`;
    // O dump traz uma linha por curso e outras por etapa; fica a mais antiga.
    const atual = inicioPorEmailCurso.get(chave);
    if (!atual || started < atual) inicioPorEmailCurso.set(chave, started);
  }

  log(
    `dump: ${cadastroPorEmail.size} e-mail(s) com data de cadastro · ${inicioPorEmailCurso.size} par(es) aluno+curso com início real`,
  );

  const alunosPath = path.resolve(process.cwd(), 'data', 'admin-students.json');
  const alunos = JSON.parse(await fs.readFile(alunosPath, 'utf8')) as LocalStudent[];

  let doProgresso = 0;
  let doCadastro = 0;
  let semFonte = 0;
  let inalteradas = 0;
  const amostra: string[] = [];

  for (const aluno of alunos) {
    const email = (aluno.email ?? '').toLowerCase();
    const datas = { ...(aluno.enrollmentDates ?? {}) };
    for (const courseId of aluno.enrolledCourseIds ?? []) {
      const doDump = email ? inicioPorEmailCurso.get(`${email}|${courseId}`) : undefined;
      const doCad = email ? cadastroPorEmail.get(email) : undefined;
      const nova = doDump ?? doCad;
      if (!nova) {
        semFonte++;
        continue;
      }
      const antiga = datas[courseId];
      if (antiga === nova) {
        inalteradas++;
        continue;
      }
      if (doDump) doProgresso++;
      else doCadastro++;
      if (amostra.length < 8) {
        amostra.push(
          `  ${(email || aluno.id).padEnd(36)} curso ${courseId.padEnd(7)} ${String(antiga ?? '—').slice(0, 10)} → ${nova.slice(0, 10)}`,
        );
      }
      datas[courseId] = nova;
    }
    aluno.enrollmentDates = datas;
  }

  log(`corrigidas pelo progresso do curso: ${doProgresso}`);
  log(`corrigidas pelo cadastro do aluno:  ${doCadastro}`);
  log(`sem nenhuma fonte de data:          ${semFonte}`);
  log(`já estavam certas:                  ${inalteradas}`);
  if (amostra.length) {
    log('amostra:');
    for (const l of amostra) console.log(l);
  }

  // Distribuição por ano, para conferir se o resultado faz sentido.
  const porAno = new Map<string, number>();
  for (const aluno of alunos) {
    for (const d of Object.values(aluno.enrollmentDates ?? {})) {
      const ano = String(d).slice(0, 4);
      porAno.set(ano, (porAno.get(ano) ?? 0) + 1);
    }
  }
  log(
    'matrículas por ano: ' +
      [...porAno.entries()]
        .sort()
        .map(([a, n]) => `${a}=${n}`)
        .join(' · '),
  );

  if (APPLY) {
    const backup = `${alunosPath}.bak-${Date.now()}`;
    await fs.copyFile(alunosPath, backup);
    await fs.writeFile(alunosPath, JSON.stringify(alunos, null, 2));
    log(`gravado. backup em ${path.basename(backup)}`);
  } else {
    log('DRY-RUN: nada gravado. Rode com --apply para aplicar.');
  }
}

void main();

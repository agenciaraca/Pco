import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * O impacto do reengajamento — a parte mais sutil do cálculo.
 *
 * "Retomou" não pode ser só "acessou depois de receber": um aluno que recebeu
 * três e-mails e voltou depois do terceiro daria crédito aos três, e a taxa de
 * sucesso viraria 100% por construção. Cada envio só ganha o crédito se o
 * acesso caiu na janela entre ele e o envio seguinte.
 */

let tmpDir: string;
let retencao: typeof import('../server/analytics/retencao');

const HOJE = new Date('2026-08-27T12:00:00Z');
const DIA = 24 * 60 * 60_000;

function iso(diasAtras: number): string {
  return new Date(HOJE.getTime() - diasAtras * DIA).toISOString();
}

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-reeng-'));
  process.env.DATA_DIR = tmpDir;

  const alunos = [
    {
      // Recebeu 3 e-mails (40, 25 e 10 dias atrás) e voltou há 5 dias:
      // só o ÚLTIMO envio pode levar o crédito.
      id: 's-voltou',
      name: 'Voltou',
      email: 'voltou@ex.com',
      enrolledCourseIds: ['c-psi'],
      progressByCourse: { 'c-psi': 20 },
      status: 'ativo',
      riskScore: 30,
      lastAccessAt: iso(5),
      createdAt: iso(300),
      enrollmentDates: { 'c-psi': iso(300) },
    },
    {
      // Recebeu 1 e-mail e nunca mais voltou.
      id: 's-perdido',
      name: 'Perdido',
      email: 'perdido@ex.com',
      enrolledCourseIds: ['c-psi'],
      progressByCourse: { 'c-psi': 5 },
      status: 'em_risco',
      riskScore: 90,
      lastAccessAt: iso(120),
      createdAt: iso(300),
      enrollmentDates: { 'c-psi': iso(300) },
    },
  ];
  await fs.writeFile(
    path.join(tmpDir, 'admin-students.json'),
    JSON.stringify(alunos, null, 2),
    'utf8',
  );

  const envios = [
    { userId: 's-voltou', email: 'voltou@ex.com', ts: iso(40) },
    { userId: 's-voltou', email: 'voltou@ex.com', ts: iso(25) },
    { userId: 's-voltou', email: 'voltou@ex.com', ts: iso(10) },
    { userId: 's-perdido', email: 'perdido@ex.com', ts: iso(30) },
  ];
  await fs.writeFile(
    path.join(tmpDir, 'reengagement-sent.json'),
    JSON.stringify(envios, null, 2),
    'utf8',
  );

  retencao = await import('../server/analytics/retencao');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('impacto do reengajamento', () => {
  it('cada envio conta uma vez', async () => {
    const r = await retencao.montaRetencao(HOJE);
    const enviados = r.reengajamento.reduce((s, w) => s + w.enviados, 0);
    expect(enviados).toBe(4);
    expect(r.kpis.impactoReengajamento.base).toBe(4);
  });

  it('o crédito do retorno vai só para o envio da janela certa', async () => {
    const r = await retencao.montaRetencao(HOJE);
    const retomados = r.reengajamento.reduce((s, w) => s + w.retomados, 0);
    // Um único retorno, creditado ao terceiro envio — não aos três.
    expect(retomados).toBe(1);
    expect(r.kpis.impactoReengajamento.pct).toBe(25);
  });

  it('quem recebeu e não voltou não conta como sucesso', async () => {
    const r = await retencao.montaRetencao(HOJE);
    // O envio ao aluno perdido caiu numa semana só dele: enviado sem retorno.
    const semanaDoPerdido = r.reengajamento.find((w) => w.enviados > 0 && w.retomados === 0);
    expect(semanaDoPerdido).toBeDefined();
  });

  it('as semanas saem em ordem cronológica', async () => {
    const r = await retencao.montaRetencao(HOJE);
    const datas = r.reengajamento.map((w) => w.semana);
    expect([...datas].sort()).toEqual(datas);
  });
});

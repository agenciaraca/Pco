import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * A retenção é calculada sobre registros reais. O que estes testes cobram é o
 * que a tela antiga não fazia: que o número nunca apareça sem a base, e que a
 * curva de coorte não conte como abandono quem simplesmente ainda não teve
 * tempo de chegar lá (censura à direita).
 */

let tmpDir: string;
let retencao: typeof import('../server/analytics/retencao');

const HOJE = new Date('2026-08-27T12:00:00Z');
const DIA = 24 * 60 * 60_000;

function iso(diasAtras: number): string {
  return new Date(HOJE.getTime() - diasAtras * DIA).toISOString();
}

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-retencao-'));
  process.env.DATA_DIR = tmpDir;

  // Quatro alunos no mesmo curso, com idades e últimos acessos diferentes.
  const alunos = [
    {
      // Veterano fiel: entrou há 1 ano, acessou ontem.
      id: 's-fiel',
      name: 'Fiel',
      email: 'fiel@ex.com',
      enrolledCourseIds: ['c-psi'],
      progressByCourse: { 'c-psi': 100 },
      status: 'ativo',
      riskScore: 5,
      lastAccessAt: iso(1),
      createdAt: iso(365),
      enrollmentDates: { 'c-psi': iso(365) },
    },
    {
      // Veterano que sumiu na 2ª semana.
      id: 's-sumiu',
      name: 'Sumiu',
      email: 'sumiu@ex.com',
      enrolledCourseIds: ['c-psi'],
      progressByCourse: { 'c-psi': 12 },
      status: 'em_risco',
      riskScore: 80,
      lastAccessAt: iso(365 - 10),
      createdAt: iso(365),
      enrollmentDates: { 'c-psi': iso(365) },
    },
    {
      // Entrou anteontem: não pode ser contado como abandono na semana 4.
      id: 's-novato',
      name: 'Novato',
      email: 'novato@ex.com',
      enrolledCourseIds: ['c-psi'],
      progressByCourse: { 'c-psi': 3 },
      status: 'ativo',
      riskScore: 10,
      lastAccessAt: iso(0),
      createdAt: iso(2),
      enrollmentDates: { 'c-psi': iso(2) },
    },
    {
      // Aluno de 6 meses, sem acesso há 200 dias.
      id: 's-frio',
      name: 'Frio',
      email: 'frio@ex.com',
      enrolledCourseIds: ['c-psi'],
      progressByCourse: { 'c-psi': 40 },
      status: 'em_risco',
      riskScore: 70,
      lastAccessAt: iso(200),
      createdAt: iso(210),
      enrollmentDates: { 'c-psi': iso(210) },
    },
  ];
  await fs.writeFile(
    path.join(tmpDir, 'admin-students.json'),
    JSON.stringify(alunos, null, 2),
    'utf8',
  );

  retencao = await import('../server/analytics/retencao');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('base do cálculo', () => {
  it('declara alunos, matrículas e cursos', async () => {
    const r = await retencao.montaRetencao(HOJE);
    expect(r.base.alunos).toBe(4);
    expect(r.base.matriculas).toBe(4);
    expect(r.base.cursos).toBe(1);
  });

  it('todo percentual vem com a base que o gerou', async () => {
    const r = await retencao.montaRetencao(HOJE);
    for (const m of [
      r.kpis.ativosRecentes,
      r.kpis.conclusaoGeral,
      r.kpis.impactoReengajamento,
    ]) {
      expect(m).toHaveProperty('base');
      expect(typeof m.base).toBe('number');
    }
    for (const c of r.cursos) {
      expect(c.conclusao.base).toBe(c.matriculados);
      expect(c.emRisco.base).toBe(c.matriculados);
    }
  });

  it('sem base o percentual é null, e não zero', async () => {
    const r = await retencao.montaRetencao(HOJE);
    // Ninguém recebeu e-mail de reengajamento neste ambiente.
    expect(r.kpis.impactoReengajamento.base).toBe(0);
    expect(r.kpis.impactoReengajamento.pct).toBeNull();
  });
});

describe('conclusão e risco por curso', () => {
  it('conta conclusão só em 100%', async () => {
    const r = await retencao.montaRetencao(HOJE);
    const psi = r.cursos.find((c) => c.id === 'c-psi');
    expect(psi?.matriculados).toBe(4);
    expect(psi?.conclusao.pct).toBe(25); // 1 de 4
  });

  it('risco vem do status calculado, não de uma lista fixa', async () => {
    const r = await retencao.montaRetencao(HOJE);
    const psi = r.cursos.find((c) => c.id === 'c-psi');
    expect(psi?.emRisco.pct).toBe(50); // 2 de 4
  });

  it('progresso médio é a média das matrículas', async () => {
    const r = await retencao.montaRetencao(HOJE);
    const psi = r.cursos.find((c) => c.id === 'c-psi');
    // (100 + 12 + 3 + 40) / 4
    expect(psi?.progressoMedio).toBeCloseTo(38.8, 1);
  });
});

describe('curva de coorte', () => {
  it('quem entrou anteontem não entra na base da semana 4', async () => {
    const r = await retencao.montaRetencao(HOJE);
    const s4 = r.coorte.find((p) => p.semana === 4)!;
    // Só os três com 4+ semanas de casa: o novato fica de fora.
    expect(s4.basePorCurso['c-psi']).toBe(3);
  });

  it('a semana 1 inclui o novato só quando ele completa uma semana', async () => {
    const r = await retencao.montaRetencao(HOJE);
    const s1 = r.coorte.find((p) => p.semana === 1)!;
    // Novato tem 2 dias — ainda não completou a semana 1.
    expect(s1.basePorCurso['c-psi']).toBe(3);
  });

  it('a retenção cai ao longo das semanas, e não por artefato', async () => {
    const r = await retencao.montaRetencao(HOJE);
    const s1 = r.coorte.find((p) => p.semana === 1)!.porCurso['c-psi'];
    const s52 = r.coorte.find((p) => p.semana === 52)!.porCurso['c-psi'];
    // Na semana 1 os três veteranos ainda estavam por perto.
    expect(s1).toBe(100);
    // Em 52 semanas só sobra quem entrou há um ano e continua acessando.
    expect(s52).toBeLessThan(s1 as number);
  });

  it('curso sem ninguém com idade suficiente devolve null, não zero', async () => {
    const r = await retencao.montaRetencao(new Date('2020-01-01T12:00:00Z'));
    for (const ponto of r.coorte) {
      for (const v of Object.values(ponto.porCurso)) {
        expect(v).toBeNull();
      }
    }
  });
});

describe('o que a tela declara não medir', () => {
  it('a lista existe e cada item diz o porquê', async () => {
    const r = await retencao.montaRetencao(HOJE);
    expect(r.naoMedido.length).toBeGreaterThan(0);
    expect(r.naoMedido.every((n) => n.o_que && n.depende_de)).toBe(true);
  });
});

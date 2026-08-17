import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { promises as fs } from 'node:fs';

// Mesma armadilha do teste de publicListed: `json-store` congela DATA_DIR no
// import, então apontar a variável num beforeAll faria este teste escrever no
// `data/` real do projeto. vi.hoisted roda acima dos imports.
const TMP_DIR = vi.hoisted(() => {
  const base = process.env.TEMP ?? process.env.TMPDIR ?? '/tmp';
  const dir = `${base}/ava-pco-access-${process.pid}-${Date.now()}`;
  process.env.DATA_DIR = dir;
  return dir;
});

import {
  addMonths,
  computeExpiry,
  resolveExpiry,
  describeAccess,
  accessFor,
  LIFETIME,
  EXPIRING_SOON_DAYS,
} from '../server/access/course-access';
import { extendCourseAccessSchema } from '../shared/schemas';

// Regra de negócio (dono, 17/ago/2026): cada curso define por quantos meses a
// matrícula dá acesso — Hipnoterapia 6, Psicanálise Clínica 16. Vencido, o aluno
// para de estudar até comprar extensão. Expirar NÃO desmatricula: o progresso
// continua guardado e volta intacto quando ele renova.

describe('addMonths — soma de meses sem transbordar', () => {
  it('soma simples', () => {
    expect(addMonths('2026-03-10T12:00:00.000Z', 6).slice(0, 10)).toBe('2026-09-10');
  });

  it('16 meses atravessa o ano', () => {
    expect(addMonths('2026-03-10T00:00:00.000Z', 16).slice(0, 10)).toBe('2027-07-10');
  });

  it('31 de janeiro + 1 mês para em 28 de fevereiro, não em 3 de março', () => {
    // `setMonth` puro daria 2026-03-03 — dois dias de acesso de brinde por
    // matrícula, e mais a cada renovação.
    expect(addMonths('2026-01-31T00:00:00.000Z', 1).slice(0, 10)).toBe('2026-02-28');
  });

  it('respeita ano bissexto', () => {
    expect(addMonths('2028-01-31T00:00:00.000Z', 1).slice(0, 10)).toBe('2028-02-29');
  });

  it('31 de maio + 1 mês = 30 de junho', () => {
    expect(addMonths('2026-05-31T00:00:00.000Z', 1).slice(0, 10)).toBe('2026-06-30');
  });

  it('preserva a hora do dia', () => {
    expect(addMonths('2026-03-10T15:45:30.000Z', 6)).toBe('2026-09-10T15:45:30.000Z');
  });

  it('data inválida é erro, não silêncio', () => {
    expect(() => addMonths('não é data', 6)).toThrow(RangeError);
  });
});

describe('computeExpiry — o prazo do curso', () => {
  it('Hipnoterapia: 6 meses', () => {
    expect(computeExpiry('2026-08-17T00:00:00.000Z', 6)?.slice(0, 10)).toBe('2027-02-17');
  });

  it('Psicanálise Clínica: 16 meses', () => {
    expect(computeExpiry('2026-08-17T00:00:00.000Z', 16)?.slice(0, 10)).toBe('2027-12-17');
  });

  it('curso sem prazo declarado é vitalício', () => {
    expect(computeExpiry('2026-08-17T00:00:00.000Z', null)).toBeNull();
    expect(computeExpiry('2026-08-17T00:00:00.000Z', undefined)).toBeNull();
    expect(computeExpiry('2026-08-17T00:00:00.000Z', 0)).toBeNull();
  });

  it('sem data de matrícula não há o que calcular', () => {
    expect(computeExpiry(null, 6)).toBeNull();
  });
});

describe('resolveExpiry — o que está gravado na matrícula manda', () => {
  it('data gravada vence o cálculo do curso', () => {
    // É o que preserva o acesso comprado quando o curso muda de política.
    const r = resolveExpiry({
      enrolledAt: '2026-08-17T00:00:00.000Z',
      storedExpiresAt: '2030-01-01T00:00:00.000Z',
      accessMonths: 6,
    });
    expect(r).toBe('2030-01-01T00:00:00.000Z');
  });

  it('`lifetime` isenta esta matrícula do prazo do curso', () => {
    // Cortesia, sócio, importação antiga: o curso cobra prazo, esta matrícula não.
    const r = resolveExpiry({
      enrolledAt: '2026-08-17T00:00:00.000Z',
      storedExpiresAt: LIFETIME,
      accessMonths: 6,
    });
    expect(r).toBeNull();
  });

  it('sem nada gravado, cai no prazo do curso', () => {
    const r = resolveExpiry({
      enrolledAt: '2026-08-17T00:00:00.000Z',
      storedExpiresAt: null,
      accessMonths: 6,
    });
    expect(r?.slice(0, 10)).toBe('2027-02-17');
  });
});

describe('describeAccess — estado que a interface consome', () => {
  const now = new Date('2026-08-17T12:00:00.000Z');

  it('sem prazo é vitalício e pode estudar', () => {
    const a = describeAccess(null, now);
    expect(a).toMatchObject({ state: 'lifetime', canStudy: true, daysLeft: null });
  });

  it('prazo distante é ativo', () => {
    const a = describeAccess('2027-02-17T12:00:00.000Z', now);
    expect(a.state).toBe('active');
    expect(a.canStudy).toBe(true);
    expect(a.daysLeft).toBeGreaterThan(EXPIRING_SOON_DAYS);
  });

  it('dentro dos 30 dias finais avisa, mas não bloqueia', () => {
    const a = describeAccess('2026-09-01T12:00:00.000Z', now);
    expect(a.state).toBe('expiring');
    expect(a.canStudy).toBe(true);
    expect(a.daysLeft).toBe(15);
  });

  it('vencido bloqueia', () => {
    const a = describeAccess('2026-08-16T12:00:00.000Z', now);
    expect(a.state).toBe('expired');
    expect(a.canStudy).toBe(false);
    expect(a.daysLeft).toBeLessThan(0);
  });

  it('vencer é no instante, não no dia seguinte', () => {
    expect(describeAccess('2026-08-17T11:59:59.000Z', now).canStudy).toBe(false);
    expect(describeAccess('2026-08-17T12:00:01.000Z', now).canStudy).toBe(true);
  });

  it('data corrompida não vira bloqueio silencioso', () => {
    // Preferimos deixar o aluno estudar e o defeito aparecer no dado do que
    // trancar alguém por causa de um campo mal gravado.
    expect(describeAccess('lixo', now)).toMatchObject({ state: 'lifetime', canStudy: true });
  });
});

describe('accessFor — os dois passos juntos', () => {
  it('curso de 6 meses, matriculado há 7: fora', () => {
    const a = accessFor(
      { enrolledAt: '2026-01-17T00:00:00.000Z', accessMonths: 6 },
      new Date('2026-08-17T00:00:00.000Z'),
    );
    expect(a.state).toBe('expired');
  });

  it('mesmo curso, matriculado há 1 mês: dentro', () => {
    const a = accessFor(
      { enrolledAt: '2026-07-17T00:00:00.000Z', accessMonths: 6 },
      new Date('2026-08-17T00:00:00.000Z'),
    );
    expect(a.state).toBe('active');
  });
});

describe('contrato de validação da extensão', () => {
  it('aceita meses, data ou vitalício', () => {
    expect(extendCourseAccessSchema.safeParse({ months: 6 }).success).toBe(true);
    expect(
      extendCourseAccessSchema.safeParse({ until: '2027-01-31T00:00:00.000Z' }).success,
    ).toBe(true);
    expect(extendCourseAccessSchema.safeParse({ lifetime: true }).success).toBe(true);
  });

  it('recusa dois de uma vez — ambiguidade não é conveniência', () => {
    expect(
      extendCourseAccessSchema.safeParse({ months: 6, lifetime: true }).success,
    ).toBe(false);
  });

  it('recusa vazio e recusa meses zero', () => {
    expect(extendCourseAccessSchema.safeParse({}).success).toBe(false);
    expect(extendCourseAccessSchema.safeParse({ months: 0 }).success).toBe(false);
  });
});

// O predicado sozinho não prova nada: o que interessa é a matrícula gravar o
// prazo e o portão respeitá-lo. Este bloco vai pelo repositório de verdade.
describe('ponta a ponta: matrícula, prazo e extensão', () => {
  let repo: typeof import('../server/repositories/students');
  let coursesRepo: typeof import('../server/repositories/courses');
  let guard: typeof import('../server/access/guard');
  const ALUNO = 's-101';
  let cursoComPrazo: string;
  let cursoSemPrazo: string;

  beforeAll(async () => {
    repo = await import('../server/repositories/students');
    coursesRepo = await import('../server/repositories/courses');
    guard = await import('../server/access/guard');

    // Precisa ser curso em que este aluno AINDA não está matriculado: o seed já
    // traz matrículas antigas (2025) e sem data por curso, e reaproveitar uma
    // delas testaria o fallback de data, não a matrícula nova.
    const cursos = await coursesRepo.listCourses();
    const jaMatriculado = new Set((await repo.findAdminStudent(ALUNO))?.enrolledCourseIds ?? []);
    const livres = cursos.filter((co) => !jaMatriculado.has(co.id));
    expect(livres.length).toBeGreaterThanOrEqual(2);
    cursoComPrazo = livres[0].id;
    cursoSemPrazo = livres[1].id;

    // Declara 6 meses de acesso, como faria o admin na aba do curso.
    await coursesRepo.updateCourse(cursoComPrazo, { accessMonths: 6 });
  });

  afterAll(async () => {
    await fs.rm(TMP_DIR, { recursive: true, force: true });
  });

  it('o prazo do curso persiste', async () => {
    const curso = await coursesRepo.findCourse(cursoComPrazo);
    expect((curso as unknown as { accessMonths?: number }).accessMonths).toBe(6);
  });

  it('matricular grava a data de fim, não só a de início', async () => {
    await repo.enrollInCourse(ALUNO, cursoComPrazo);
    const aluno = await repo.findAdminStudent(ALUNO);
    const inicio = aluno?.enrollmentDates?.[cursoComPrazo];
    const fim = aluno?.accessExpiresByCourse?.[cursoComPrazo];
    expect(inicio).toBeTruthy();
    expect(fim).toBeTruthy();
    expect(fim).toBe(addMonths(inicio!, 6));
  });

  it('recém-matriculado pode estudar', async () => {
    const acc = await guard.courseAccessFor(ALUNO, cursoComPrazo);
    expect(acc.enrolled).toBe(true);
    expect(acc.canStudy).toBe(true);
  });

  it('sete meses depois, o portão fecha — e a matrícula continua lá', async () => {
    const seteMesesDepois = new Date(addMonths(new Date().toISOString(), 7));
    const acc = await guard.courseAccessFor(ALUNO, cursoComPrazo, seteMesesDepois);
    expect(acc.canStudy).toBe(false);
    expect(acc.reason).toBe('access_expired');
    // Expirar não é desmatricular: o vínculo e o progresso ficam.
    expect(acc.enrolled).toBe(true);
    const aluno = await repo.findAdminStudent(ALUNO);
    expect(aluno?.enrolledCourseIds).toContain(cursoComPrazo);
  });

  it('estender por 6 meses soma ao prazo vigente', async () => {
    const antes = (await repo.findAdminStudent(ALUNO))?.accessExpiresByCourse?.[cursoComPrazo];
    const r = await repo.extendCourseAccess(ALUNO, cursoComPrazo, { months: 6 });
    expect(r.ok).toBe(true);
    expect(r.expiresAt).toBe(addMonths(antes!, 6));
  });

  it('estender depois de vencido conta de hoje, não do vencimento', async () => {
    // Devolver dias que o aluno passou sem estudar seria dar acesso retroativo.
    await repo.extendCourseAccess(ALUNO, cursoComPrazo, {
      until: '2020-01-01T00:00:00.000Z',
    });
    const r = await repo.extendCourseAccess(ALUNO, cursoComPrazo, { months: 3 });
    const esperado = addMonths(new Date().toISOString(), 3).slice(0, 10);
    expect(r.expiresAt?.slice(0, 10)).toBe(esperado);
  });

  it('marcar como vitalício isenta do prazo do curso', async () => {
    const r = await repo.extendCourseAccess(ALUNO, cursoComPrazo, { lifetime: true });
    expect(r.expiresAt).toBeNull();
    const acc = await guard.courseAccessFor(
      ALUNO,
      cursoComPrazo,
      new Date(addMonths(new Date().toISOString(), 120)),
    );
    expect(acc.canStudy).toBe(true);
    expect(acc.access?.state).toBe('lifetime');
  });

  it('curso sem prazo declarado não expira', async () => {
    await repo.enrollInCourse(ALUNO, cursoSemPrazo);
    const acc = await guard.courseAccessFor(
      ALUNO,
      cursoSemPrazo,
      new Date(addMonths(new Date().toISOString(), 240)),
    );
    expect(acc.access?.state).toBe('lifetime');
    expect(acc.canStudy).toBe(true);
  });

  it('não matriculado é caso diferente de expirado', async () => {
    const acc = await guard.courseAccessFor(ALUNO, 'curso-que-nao-existe');
    expect(acc.enrolled).toBe(false);
    expect(acc.reason).toBe('not_enrolled');
    expect(guard.accessDeniedCode(acc)).toBe('NOT_ENROLLED');
  });

  it('estender matrícula inexistente falha em vez de criar uma', async () => {
    const r = await repo.extendCourseAccess(ALUNO, 'curso-que-nao-existe', { months: 6 });
    expect(r.ok).toBe(false);
  });
});

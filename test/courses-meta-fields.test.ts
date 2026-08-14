import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Com DATABASE_URL setado, `updateCourse` gravava apenas as 8 colunas da tabela
// `courses` e `loadFromDb` devolvia apenas 9 campos — tags, instrutor,
// learningOutcomes, certificateTemplate, colaboradores e todos os campos da
// página pública eram descartados em silêncio. A coluna JSONB `meta` passou a
// carregá-los. Estes testes travam a regra de separação (coluna x meta) e o
// caminho JSON, que é o que roda em CI.

let tmpDir: string;
let repo: typeof import('../server/repositories/courses');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-cmeta-'));
  process.env.DATA_DIR = tmpDir;
  repo = await import('../server/repositories/courses');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('pickMetaFields — o que vai para a coluna JSONB', () => {
  it('mantém fora do meta tudo que tem coluna própria', () => {
    const meta = repo.pickMetaFields({
      title: 'T',
      slug: 's',
      shortTitle: 'ST',
      description: 'D',
      totalHours: 10,
      certificateAvailable: true,
      coverColor: 'from-a to-b',
      active: true,
    });
    expect(meta).toEqual({});
  });

  it('manda para o meta os campos da página pública', () => {
    const meta = repo.pickMetaFields({
      title: 'T',
      badge: 'Curso principal',
      tagline: 'Uma frase',
      tldr: 'Resumo answer-first',
      level: 'Formação profissional',
      language: 'pt-BR',
      monthsMin: 6,
      monthsMax: 18,
      forWhom: ['Psicólogos'],
      faqs: [{ q: 'Tem certificado?', a: 'Tem.' }],
      curriculum: [{ n: '01', title: 'Introdução', desc: 'Base' }],
    });
    expect(Object.keys(meta).sort()).toEqual(
      [
        'badge',
        'curriculum',
        'faqs',
        'forWhom',
        'language',
        'level',
        'monthsMax',
        'monthsMin',
        'tagline',
        'tldr',
      ].sort(),
    );
    expect(meta.title).toBeUndefined();
  });

  it('manda para o meta os campos ricos que já existiam e se perdiam', () => {
    const meta = repo.pickMetaFields({
      tags: ['psicanálise'],
      learningOutcomes: ['Escutar'],
      instructorName: 'Fulana',
      instructorBio: 'Bio',
      instructorPhotoUrl: 'https://x/f.png',
      coverImageUrl: 'https://x/c.png',
      certificateTemplate: { title: 'Certificado' },
      collaborators: [{ name: 'Beltrano' }],
      changelog: [{ version: '1.0', date: '2026-01-01', notes: 'n' }],
      prerequisiteCourseIds: ['c-1'],
    });
    expect(Object.keys(meta)).toHaveLength(10);
    expect(meta.instructorName).toBe('Fulana');
  });

  it('ignora undefined — patch parcial não apaga o que não veio', () => {
    const meta = repo.pickMetaFields({ tldr: undefined, badge: 'X' });
    expect(meta).toEqual({ badge: 'X' });
    expect('tldr' in meta).toBe(false);
  });
});

describe('updateCourse (modo JSON) preserva os campos da página pública', () => {
  it('persiste e devolve badge, tldr, forWhom, faqs e curriculum', async () => {
    const all = await repo.listCourses();
    expect(all.length).toBeGreaterThan(0);
    const id = all[0]!.id;

    const updated = await repo.updateCourse(id, {
      badge: 'Curso principal',
      tldr: 'Formação livre em psicanálise clínica.',
      forWhom: ['Quem quer atender', 'Quem já atende'],
      faqs: [{ q: 'Preciso de graduação?', a: 'Não.' }],
      curriculum: [{ n: '01', title: 'Fundamentos', desc: 'Freud' }],
      monthsMin: 12,
    });

    expect(updated).not.toBeNull();
    expect(updated!.badge).toBe('Curso principal');
    expect(updated!.tldr).toBe('Formação livre em psicanálise clínica.');
    expect(updated!.forWhom).toEqual(['Quem quer atender', 'Quem já atende']);
    expect(updated!.faqs).toHaveLength(1);
    expect(updated!.curriculum?.[0]?.title).toBe('Fundamentos');
    expect(updated!.monthsMin).toBe(12);

    // e continua lá na leitura seguinte
    const again = await repo.findCourse(id);
    expect(again!.tldr).toBe('Formação livre em psicanálise clínica.');
  });

  it('patch parcial não apaga campo público salvo antes', async () => {
    const all = await repo.listCourses();
    const id = all[0]!.id;
    await repo.updateCourse(id, { tagline: 'Frase original' });
    await repo.updateCourse(id, { badge: 'Outro selo' });
    const c = await repo.findCourse(id);
    expect(c!.tagline).toBe('Frase original');
    expect(c!.badge).toBe('Outro selo');
  });
});

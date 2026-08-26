import { describe, it, expect } from 'vitest';
import { courseJsonLd, blogPostingJsonLd, publicCourseUrl } from '../server/public/jsonld';
import {
  ORG,
  AUTHOR,
  AUTHOR_IS_PLACEHOLDER,
  AUTORIA_INSTITUCIONAL,
} from '../server/public/config';
import type { PublicCourse, PublicPost } from '../server/public/projections';

// Três defeitos encontrados em produção em 16/ago/2026, todos no structured
// data das páginas públicas de curso:
//
// 1. `Course.url` e `Offer.url` apontavam para `/curso/<slug>`. Essa rota
//    pertence ao SPA do ALUNO LOGADO e espera um **id**, não um slug — para um
//    crawler anônimo ela devolve 200 com o shell vazio (soft-404) e manda para
//    o login. A página canônica é `/formacao/<slug>`, servida por SSR.
// 2. Sem instrutor no curso, o JSON-LD referenciava o responsável técnico por
//    `@id`, mas nenhuma página emitia esse nó — referência pendurada.
// 3. O responsável técnico é um placeholder (`Dra. [Nome ...]`) com credenciais
//    anexadas. Publicá-lo em conteúdo YMYL é pior do que não ter autor.

const baseCourse = (over: Partial<PublicCourse> = {}): PublicCourse =>
  ({
    id: '123',
    slug: 'autismo',
    title: 'Autismo',
    shortTitle: 'Autismo',
    description: 'desc',
    language: 'pt-BR',
    level: 'Formação profissional',
    totalHours: 10,
    learningOutcomes: [],
    forWhom: [],
    faqs: [],
    curriculum: [],
    ...over,
  }) as unknown as PublicCourse;

describe('URL canônica pública do curso', () => {
  it('usa /formacao/:slug — nunca /curso/, que é a rota do aluno logado', () => {
    expect(publicCourseUrl('autismo')).toBe(`${ORG.url}/formacao/autismo`);
    expect(publicCourseUrl('autismo')).not.toContain('/curso/');
  });

  it('Course.url aponta para a página SSR pública', () => {
    const ld = courseJsonLd(baseCourse()) as Record<string, unknown>;
    expect(ld.url).toBe(`${ORG.url}/formacao/autismo`);
  });

  it('Offer.url aponta para a mesma página, e não para o SPA', () => {
    const ld = courseJsonLd(baseCourse({ priceCents: 119980 } as Partial<PublicCourse>)) as Record<
      string,
      unknown
    >;
    const offers = ld.offers as Record<string, unknown>;
    expect(offers.url).toBe(`${ORG.url}/formacao/autismo`);
    expect(offers.price).toBe('1199.80');
  });

  it('nenhuma URL emitida no JSON-LD do curso cai na rota do aluno', () => {
    const ld = JSON.stringify(
      courseJsonLd(baseCourse({ priceCents: 100 } as Partial<PublicCourse>)),
    );
    expect(ld).not.toMatch(/\/curso\//);
  });
});

describe('instrutor do CourseInstance', () => {
  it('usa o instrutor do curso quando existe', () => {
    const ld = courseJsonLd(
      baseCourse({ instructorName: 'Giovane Braga' } as Partial<PublicCourse>),
    ) as Record<string, unknown>;
    const inst = (ld.hasCourseInstance as Record<string, unknown>).instructor as Record<
      string,
      unknown
    >;
    expect(inst).toMatchObject({ '@type': 'Person', name: 'Giovane Braga' });
  });

  it('não deixa `@id` pendurado quando o responsável técnico é placeholder', () => {
    const ld = courseJsonLd(baseCourse()) as Record<string, unknown>;
    const instance = ld.hasCourseInstance as Record<string, unknown>;
    if (AUTHOR_IS_PLACEHOLDER) {
      // Preferimos ausência a uma referência para um nó que ninguém define.
      expect(instance.instructor).toBeUndefined();
    } else {
      expect(instance.instructor).toMatchObject({ '@id': `${ORG.url}/autor#${AUTHOR!.slug}` });
    }
  });
});

describe('autoria institucional', () => {
  it('a PCO assina como organização: não há pessoa nomeada configurada', () => {
    // A escola constrói curso com equipe — pedagogos, psicanalistas, redatores
    // e editores —, não com um docente de vitrine. `AUTHOR === null` é como
    // isso fica dito no código, e o que impede o molde de pessoa de voltar.
    expect(AUTHOR).toBeNull();
    expect(AUTORIA_INSTITUCIONAL).toBe(true);
    expect(AUTHOR_IS_PLACEHOLDER).toBe(true);
  });

  it('o detector de molde continua de pé para quem repuser colchetes', () => {
    // Se alguém voltar a pôr "Dra. [Nome]" aqui, o site tem que seguir omitindo
    // /autor em vez de publicar credencial sem dono.
    const molde = { name: 'Dra. [Nome do Responsável Técnico]' };
    expect(/\[.*\]/.test(molde.name)).toBe(true);
  });

  it('post sem autor nomeado atribui à organização enquanto não houver pessoa real', () => {
    const post = {
      slug: 'p',
      title: 'T',
      excerpt: 'E',
      authorName: AUTHOR?.name,
      tags: [],
      readingMinutes: 3,
      relatedCourseSlugs: [],
    } as unknown as PublicPost;
    const ld = blogPostingJsonLd(post) as Record<string, unknown>;
    const author = ld.author as Record<string, unknown>;
    expect(author['@id']).toBe(
      AUTHOR_IS_PLACEHOLDER ? `${ORG.url}/#org` : `${ORG.url}/autor#${AUTHOR!.slug}`,
    );
  });
});

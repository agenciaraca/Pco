/**
 * Construtores de JSON-LD (schema.org) emitidos no servidor por tipo de página.
 * Grafo conectado por @id: Article/Course referenciam o autor e a org por @id,
 * construindo um grafo de entidades (sinal central de E-E-A-T) em vez de blobs
 * soltos. Só marcar conteúdo realmente visível na página.
 */
import { ORG, AUTHOR, AUTHOR_IS_PLACEHOLDER, type AuthorConfig } from './config';
import type { PublicCourse, PublicFaq, PublicPost, PublicPostSummary } from './projections';

export const ORG_ID = `${ORG.url}/#org`;
export const WEBSITE_ID = `${ORG.url}/#website`;
export const authorId = (slug: string) => `${ORG.url}/autor#${slug}`;

type Json = Record<string, unknown>;

export function orgJsonLd(): Json {
  return {
    '@context': 'https://schema.org',
    '@type': ['Organization', 'EducationalOrganization'],
    '@id': ORG_ID,
    name: ORG.name,
    legalName: ORG.legalName,
    url: ORG.url,
    logo: ORG.url + ORG.logo,
    description: ORG.slogan,
    ...(ORG.founded ? { foundingDate: ORG.founded } : {}),
    ...(ORG.cnpj ? { taxID: ORG.cnpj } : {}),
    sameAs: Object.values(ORG.social).filter(Boolean),
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: ORG.email,
      telephone: ORG.phones[0],
      areaServed: 'BR',
      availableLanguage: 'Portuguese',
    },
    address: {
      '@type': 'PostalAddress',
      streetAddress: ORG.address.street,
      addressLocality: ORG.address.city,
      addressRegion: ORG.address.region,
      postalCode: ORG.address.postalCode,
      addressCountry: ORG.address.country,
    },
  };
}

export function websiteJsonLd(): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: ORG.url,
    name: ORG.name,
    inLanguage: 'pt-BR',
    publisher: { '@id': ORG_ID },
  };
}

/**
 * Nó `Person` do responsável técnico.
 *
 * Só faz sentido chamar com uma pessoa real: a autoria padrão da PCO é
 * institucional (`AUTHOR === null`), e por isso não há mais default aqui — quem
 * chama tem que ter uma pessoa em mãos.
 */
export function personJsonLd(author: AuthorConfig): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': authorId(author.slug),
    name: author.name,
    jobTitle: author.jobTitle,
    description: author.bio,
    ...(author.photo ? { image: author.photo } : {}),
    worksFor: { '@id': ORG_ID },
    knowsAbout: ['Psicanálise clínica', 'Saúde mental', 'Formação em psicanálise'],
    hasCredential: author.credentials.map((c) => ({
      '@type': 'EducationalOccupationalCredential',
      credentialCategory: 'certification',
      name: c,
    })),
    sameAs: author.sameAs.filter(Boolean),
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path?: string }>): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      ...(it.path ? { item: ORG.url + it.path } : {}),
    })),
  };
}

export function faqJsonLd(faqs: PublicFaq[]): Json | null {
  if (!faqs.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

/**
 * URL canônica pública de um curso.
 *
 * ⚠️ NÃO é `/curso/:id` — essa é a rota do SPA para o ALUNO LOGADO (recebe id,
 * não slug, e manda visitante anônimo para o login). A página pública de venda,
 * renderizada no servidor, mora em `/formacao/:slug`. Espelha o helper do
 * frontend em `src/app/lib/publicUrls.ts`.
 */
export const publicCourseUrl = (slug: string) => `${ORG.url}/formacao/${slug}`;

export function courseJsonLd(course: PublicCourse): Json {
  // Sem instrutor no curso, referenciamos o responsável técnico do site por
  // `@id`. Mas só quando ele existe de verdade E é emitido em algum lugar —
  // senão o `@id` fica pendurado, apontando para um nó que a página nunca
  // define, e o parser lê a instância como se não tivesse instrutor nenhum.
  const instructorRef = course.instructorName
    ? {
        '@type': 'Person',
        name: course.instructorName,
        ...(course.instructorPhotoUrl ? { image: course.instructorPhotoUrl } : {}),
      }
    : AUTHOR_IS_PLACEHOLDER
      ? undefined
      : { '@id': authorId(AUTHOR!.slug) };
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: course.title,
    description: course.tldr ?? course.description,
    inLanguage: course.language,
    url: publicCourseUrl(course.slug),
    provider: { '@id': ORG_ID },
    ...(course.learningOutcomes.length ? { teaches: course.learningOutcomes } : {}),
    educationalLevel: course.level,
    ...(course.totalHours ? { timeRequired: `PT${course.totalHours}H` } : {}),
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: 'online',
      courseWorkload: course.totalHours ? `PT${course.totalHours}H` : undefined,
      ...(instructorRef ? { instructor: instructorRef } : {}),
    },
    ...(course.priceCents != null
      ? {
          offers: {
            '@type': 'Offer',
            category: 'Paid',
            price: (course.priceCents / 100).toFixed(2),
            priceCurrency: 'BRL',
            availability: 'https://schema.org/InStock',
            url: publicCourseUrl(course.slug),
          },
        }
      : {}),
  };
}

export function blogPostingJsonLd(post: PublicPost): Json {
  const url = `${ORG.url}/blog/${post.slug}`;
  const named = post.authorName && post.authorName !== AUTHOR?.name;
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    inLanguage: 'pt-BR',
    ...(post.publishedAt ? { datePublished: post.publishedAt } : {}),
    ...(post.publishedAt ? { dateModified: post.publishedAt } : {}),
    // Autor: entidade nomeada se houver; senão o responsável técnico por @id.
    // Sem responsável real configurado, a autoria fica na organização — melhor
    // do que um `@id` apontando para um nó que nenhuma página define.
    author: named
      ? { '@type': 'Person', name: post.authorName }
      : AUTHOR_IS_PLACEHOLDER
        ? { '@id': ORG_ID }
        : { '@id': authorId(AUTHOR!.slug) },
    publisher: { '@id': ORG_ID },
    mainEntityOfPage: url,
    url,
    ...(post.category ? { articleSection: post.category } : {}),
    ...(post.tags.length ? { keywords: post.tags.join(', ') } : {}),
  };
}

export function blogJsonLd(posts: PublicPostSummary[]): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    '@id': `${ORG.url}/blog#blog`,
    name: `Blog — ${ORG.shortName}`,
    url: `${ORG.url}/blog`,
    inLanguage: 'pt-BR',
    publisher: { '@id': ORG_ID },
    blogPost: posts.slice(0, 20).map((p) => ({
      '@type': 'BlogPosting',
      headline: p.title,
      url: `${ORG.url}/blog/${p.slug}`,
      ...(p.publishedAt ? { datePublished: p.publishedAt } : {}),
    })),
  };
}

export function contactPageJsonLd(): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    name: `Contato — ${ORG.shortName}`,
    url: `${ORG.url}/contato`,
    inLanguage: 'pt-BR',
    publisher: { '@id': ORG_ID },
  };
}

export function aboutPageJsonLd(): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: `Sobre — ${ORG.name}`,
    url: `${ORG.url}/sobre`,
    inLanguage: 'pt-BR',
    publisher: { '@id': ORG_ID },
    mainEntity: { '@id': ORG_ID },
  };
}

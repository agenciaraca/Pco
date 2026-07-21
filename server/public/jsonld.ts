/**
 * Construtores de JSON-LD (schema.org) emitidos no servidor por tipo de página.
 * Grafo conectado por @id: Article/Course referenciam o autor e a org por @id,
 * construindo um grafo de entidades (sinal central de E-E-A-T) em vez de blobs
 * soltos. Só marcar conteúdo realmente visível na página.
 */
import { ORG, AUTHOR, type AuthorConfig } from './config';
import type { PublicCourse, PublicFaq } from './projections';

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

export function personJsonLd(author: AuthorConfig = AUTHOR): Json {
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

export function courseJsonLd(course: PublicCourse): Json {
  const instructorRef = course.instructorName
    ? {
        '@type': 'Person',
        name: course.instructorName,
        ...(course.instructorPhotoUrl ? { image: course.instructorPhotoUrl } : {}),
      }
    : { '@id': authorId(AUTHOR.slug) };
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: course.title,
    description: course.tldr ?? course.description,
    inLanguage: course.language,
    url: `${ORG.url}/curso/${course.slug}`,
    provider: { '@id': ORG_ID },
    ...(course.learningOutcomes.length ? { teaches: course.learningOutcomes } : {}),
    educationalLevel: course.level,
    ...(course.totalHours ? { timeRequired: `PT${course.totalHours}H` } : {}),
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: 'online',
      courseWorkload: course.totalHours ? `PT${course.totalHours}H` : undefined,
      instructor: instructorRef,
    },
    ...(course.priceCents != null
      ? {
          offers: {
            '@type': 'Offer',
            category: 'Paid',
            price: (course.priceCents / 100).toFixed(2),
            priceCurrency: 'BRL',
            availability: 'https://schema.org/InStock',
            url: `${ORG.url}/curso/${course.slug}`,
          },
        }
      : {}),
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

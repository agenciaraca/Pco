import { describe, it, expect } from 'vitest';
import { getTableColumns } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import * as schema from '../server/db/schema';
import {
  createLessonSchema,
  createModuleSchema,
  createAssessmentSchema,
  createProfessionalSchema,
  createSessionServiceSchema,
  createBookingSchema,
  createProductSchema,
  createCouponSchema,
  createNewsSchema,
  createPodcastSchema,
  createLibrarySchema,
} from '../shared/schemas';

/**
 * A generalização de `test/aula-cabe-no-banco.test.ts`.
 *
 * Aquele teste compara **uma** tabela (`lessons`) com **um** schema. Ele
 * funcionou: pegou `isPreview` e `transcripts`. Mas o padrão "campo que existe
 * no Zod, no formulário e nas telas, e não tem coluna" não é de `lessons` — é
 * do projeto inteiro, porque há dois backends de persistência atrás da mesma
 * superfície de repositório, e o de JSON aceita qualquer chave.
 *
 * Em 3/set/2026 uma auditoria encontrou o quarto caso, e ele estava em
 * `modules`: `releaseAfterEnrollmentDays` — o gotejamento relativo à matrícula
 * — existia no `createModuleSchema`, no `AdminCourseEditor`, no tipo do produto
 * e no motor de liberação (`repositories/drip.ts`), e não tinha coluna. O
 * caminho de banco descartava no insert, descartava no update e não devolvia na
 * leitura.
 *
 * **E este era pior que os três anteriores**, porque falhava *abrindo*: os
 * outros deixavam de entregar conteúdo (aula truncada, preview que dava 403,
 * transcrição inexistente); este liberava um módulo que o admin tinha mandado
 * segurar por 30 dias, imediatamente, para todo mundo, sem erro nenhum.
 *
 * O teste não olha valores: olha se **cabe**. Campo novo sem coluna falha aqui,
 * na hora, em vez de virar dado perdido em produção meses depois.
 *
 * ## Como acrescentar um par
 *
 * Ponha `{ nome, schema, tabela }` em `PARES`. Se um campo do Zod legitimamente
 * não tem coluna — porque vai para um jsonb, para outra tabela ou para o
 * histórico de eventos —, declare-o em `SEM_COLUNA_POR_DECISAO` **com o motivo
 * escrito**. A exceção sem motivo é rejeitada por um dos casos abaixo: uma
 * lista de anistia sem justificativa é como o inventário de rotas públicas
 * afirmava que `/auth/me` respondia 401 quando respondia 200.
 */

interface Par {
  nome: string;
  schema: z.ZodObject<z.ZodRawShape>;
  tabela: PgTable;
}

const PARES: Par[] = [
  { nome: 'createLessonSchema × lessons', schema: createLessonSchema, tabela: schema.lessons },
  { nome: 'createModuleSchema × modules', schema: createModuleSchema, tabela: schema.modules },
  {
    nome: 'createAssessmentSchema × assessments',
    schema: createAssessmentSchema,
    tabela: schema.assessments,
  },
  {
    nome: 'createProfessionalSchema × professionals',
    schema: createProfessionalSchema,
    tabela: schema.professionals,
  },
  {
    nome: 'createSessionServiceSchema × session_services',
    schema: createSessionServiceSchema,
    tabela: schema.sessionServices,
  },
  {
    nome: 'createBookingSchema × session_bookings',
    schema: createBookingSchema,
    tabela: schema.sessionBookings,
  },
  {
    nome: 'createProductSchema × payment_products',
    schema: createProductSchema,
    tabela: schema.paymentProducts,
  },
  {
    nome: 'createCouponSchema × payment_coupons',
    schema: createCouponSchema,
    tabela: schema.paymentCoupons,
  },
  { nome: 'createNewsSchema × news_articles', schema: createNewsSchema, tabela: schema.newsArticles },
  { nome: 'createPodcastSchema × podcasts', schema: createPodcastSchema, tabela: schema.podcasts },
  {
    nome: 'createLibrarySchema × library_items',
    schema: createLibrarySchema,
    tabela: schema.libraryItems,
  },
];

/**
 * Campo do Zod que **não tem coluna de propósito**, com o motivo escrito.
 * Chave: `<par>.<campo>`.
 */
const SEM_COLUNA_POR_DECISAO: Record<string, string> = {};

describe('todo campo de formulário tem onde pousar no banco', () => {
  for (const par of PARES) {
    describe(par.nome, () => {
      const colunas = new Set(Object.keys(getTableColumns(par.tabela)));
      const campos = Object.keys(par.schema.shape);

      it('nenhum campo fica sem coluna', () => {
        const semColuna = campos.filter(
          (c) => !colunas.has(c) && !SEM_COLUNA_POR_DECISAO[`${par.nome}.${c}`],
        );
        expect(
          semColuna,
          `Estes campos existem no Zod e não têm coluna. O caminho de banco vai ` +
            `descartá-los sem erro — a API responde 200 e o dado some. Ou crie a ` +
            `coluna (migração aditiva, e o código sobe DEPOIS dela), ou declare em ` +
            `SEM_COLUNA_POR_DECISAO com o motivo:\n  ${semColuna.join('\n  ')}`,
        ).toEqual([]);
      });

      it('o schema tem pelo menos um campo (guarda contra import quebrado)', () => {
        expect(campos.length).toBeGreaterThan(0);
      });
    });
  }

  it('toda exceção declarada tem motivo escrito', () => {
    for (const [chave, motivo] of Object.entries(SEM_COLUNA_POR_DECISAO)) {
      expect(motivo.trim().length, chave).toBeGreaterThan(10);
    }
  });

  it('o inventário cobre as tabelas que já perderam campo', () => {
    // Guarda contra alguém encolher a lista de pares.
    const nomes = PARES.map((p) => p.nome).join(' ');
    expect(nomes).toContain('lessons');
    expect(nomes).toContain('modules');
    expect(PARES.length).toBeGreaterThanOrEqual(11);
  });

  it('releaseAfterEnrollmentDays — o quarto caso — tem coluna', () => {
    // Nomeado de propósito: é o defeito que motivou este arquivo, e o único
    // dos quatro que falhava abrindo conteúdo em vez de fechando.
    const colunas = new Set(Object.keys(getTableColumns(schema.modules)));
    expect(Object.keys(createModuleSchema.shape)).toContain('releaseAfterEnrollmentDays');
    expect(colunas.has('releaseAfterEnrollmentDays')).toBe(true);
  });
});

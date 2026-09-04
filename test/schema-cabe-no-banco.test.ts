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
  createStudentSchema,
  createSystemUserSchema,
  createSupportTicketSchema,
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
  // ---------------------------------------------------------------- QA2-004
  //
  // Os quatro abaixo entraram em 3/set/2026. A auditoria observou que o
  // inventário cobria 11 das 25 tabelas e que **as duas de fora onde o defeito
  // custaria mais** eram exatamente `payment_orders` e `students`: uma guarda
  // dinheiro, a outra guarda quem é aluno. Um campo perdido em silêncio ali
  // não é conteúdo faltando na tela — é pedido sem dado de cobrança e ficha
  // sem o que a coordenação precisa.
  { nome: 'createStudentSchema × students', schema: createStudentSchema, tabela: schema.students },
  { nome: 'createSystemUserSchema × users', schema: createSystemUserSchema, tabela: schema.users },
  {
    nome: 'createSupportTicketSchema × support_tickets',
    schema: createSupportTicketSchema,
    tabela: schema.supportTickets,
  },

];

/**
 * Campo do Zod que **não tem coluna de propósito**, com o motivo escrito.
 * Chave: `<par>.<campo>`.
 */
const SEM_COLUNA_POR_DECISAO: Record<string, string> = {
  // ---- students: a ficha do aluno não guarda identidade nem matrícula ----
  //
  // As três abaixo apareceram no instante em que o par entrou no inventário, e
  // são o comportamento correto. Registradas aqui porque a alternativa era
  // deixar o par de fora — e foi justamente ficar de fora que deixou
  // `students` sem cobertura enquanto quatro campos se perdiam noutras tabelas.
  'createStudentSchema × students.name':
    'Nome mora em `users.name`. A ficha (`students`) referencia a conta por ' +
    '`userId` e não duplica identidade — duas cópias do nome divergiriam, e a ' +
    'conta é a fonte. `createAdminStudent` grava nas duas tabelas.',
  'createStudentSchema × students.email':
    'Mesmo caso do nome: `users.email` é a fonte, e é por ele que se faz login. ' +
    'Duplicar aqui criaria a possibilidade de a ficha dizer um e-mail e o login ' +
    'aceitar outro — que é exatamente o problema que a unificação de 19/ago/2026 ' +
    'resolveu.',
  'createStudentSchema × students.enrolledCourseIds':
    'Matrícula é linha na tabela `enrollments`, não coluna na ficha: cada uma ' +
    'carrega progresso, data e situação próprias. Um array de ids aqui não teria ' +
    'onde guardar nada disso, e a situação por curso é o que decide acesso.',

  // ---- users: senha não é coluna, e não deve ser ----
  'createSystemUserSchema × users.password':
    'A senha em claro nunca é persistida. O que existe é `users.password_hash`, ' +
    'preenchido pelo `users-store` no cadastro. Se um dia aparecer uma coluna ' +
    '`password`, é bug grave — e esta linha é o lembrete de que a ausência é ' +
    'deliberada, não esquecimento.',
};

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
    // QA2-004: as duas onde o defeito custaria mais. `payment_orders` não tem
    // schema Zod de criação — o pedido nasce do checkout, não de formulário —
    // e por isso ganhou caso próprio no fim deste arquivo, comparando o objeto
    // que `createOrder` produz contra as colunas.
    expect(nomes).toContain('students');
    expect(nomes).toContain('users');
    expect(PARES.length).toBeGreaterThanOrEqual(14);
  });

  it('releaseAfterEnrollmentDays — o quarto caso — tem coluna', () => {
    // Nomeado de propósito: é o defeito que motivou este arquivo, e o único
    // dos quatro que falhava abrindo conteúdo em vez de fechando.
    const colunas = new Set(Object.keys(getTableColumns(schema.modules)));
    expect(Object.keys(createModuleSchema.shape)).toContain('releaseAfterEnrollmentDays');
    expect(colunas.has('releaseAfterEnrollmentDays')).toBe(true);
  });
});

/**
 * QA2-004 · `payment_orders` não tem schema Zod, e mesmo assim perde campo.
 *
 * O pedido nasce do checkout, não de formulário, então não há
 * `createOrderSchema` para comparar com a tabela. Mas o risco é o mesmo, e por
 * um motivo específico: o insert usa **spread** —
 * `db.insert(schema.paymentOrders).values({ ...o, events: o.events })`.
 *
 * Espalhar um objeto mais largo que a tabela não é erro de compilação (a
 * checagem de propriedade excedente do TypeScript não vale para spread) e o
 * Drizzle percorre as colunas que conhece, ignorando o resto. Ou seja: campo
 * novo em `Order` sem coluna correspondente é **descartado no insert, sem
 * erro** — a mesma forma dos quatro casos de aula e módulo, agora na tabela
 * que guarda dinheiro.
 *
 * A comparação aqui é contra o objeto real que `createOrder` devolve, e não
 * contra um tipo: interface do TypeScript não existe em tempo de execução, e
 * um teste que só olha o tipo não veria o spread.
 */
describe('createOrder × payment_orders', () => {
  it('todo campo do pedido tem coluna', async () => {
    const { promises: fs } = await import('node:fs');
    const path = await import('node:path');
    const os = await import('node:os');
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-ord-schema-'));
    process.env.DATA_DIR = tmp;
    try {
      const repo = await import('../server/payments/orders-repo');
      const pedido = await repo.createOrder({
        userId: 'u-1',
        userEmail: 'u1@teste.local',
        productId: 'p-1',
        productSnapshot: {
          name: 'Curso',
          priceCents: 10000,
          currency: 'BRL',
          kind: 'course',
          refId: 'c-1',
        },
        gatewayId: 'gw-1',
        gatewayProvider: 'mock',
        amountCents: 10000,
        currency: 'BRL',
      });

      const colunas = new Set(Object.keys(getTableColumns(schema.paymentOrders)));
      const semColuna = Object.keys(pedido).filter((c) => !colunas.has(c));
      expect(
        semColuna,
        'Estes campos existem no pedido e não têm coluna. O insert usa spread, ' +
          'então o Drizzle os descarta em silêncio e o pedido volta do banco ' +
          'sem eles: ' + semColuna.join(', '),
      ).toEqual([]);

      // Guarda anti-vacuidade: se `createOrder` passar a devolver um objeto
      // vazio, o filtro acima fica vazio e o caso passaria sem provar nada.
      expect(Object.keys(pedido).length).toBeGreaterThan(10);
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });
});

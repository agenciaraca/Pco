// OpenAPI 3.0 spec gerada para a API pública v1 do AVA PCO.
// Mantida à mão (não há decorator-based routing). Serve como documentação
// vivente para integradores e como base pra `Try it out` em qualquer
// Swagger UI.

export interface OpenApiOptions {
  /** Origem pública (ex.: https://ava.psicanaliseclinica.online). */
  origin?: string;
  /** Versão do app (lida do package.json em runtime). */
  version?: string;
}

export function buildOpenApiSpec(opts: OpenApiOptions = {}): unknown {
  const origin = opts.origin ?? 'https://ava.psicanaliseclinica.online';
  const version = opts.version ?? '0.1.0';

  return {
    openapi: '3.0.3',
    info: {
      title: 'AVA PCO — API pública v1',
      version,
      description:
        'API REST somente leitura para integrações externas (BI, Zapier, n8n, etc). ' +
        'Autenticação via header `Authorization: Bearer pcok_...`. Tokens são gerenciados ' +
        'em /admin/api-tokens (admin) e têm escopos. Rate limit padrão: 120 req/min/IP.',
      contact: { name: 'AVA PCO', url: origin },
      license: { name: 'Proprietary' },
    },
    servers: [
      { url: `${origin}/api`, description: 'Produção' },
      { url: 'http://localhost:3001', description: 'Local dev (npm run dev:api)' },
    ],
    components: {
      securitySchemes: {
        ApiToken: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'pcok_<segredo>',
          description:
            'Token gerado em /admin/api-tokens. Segredo é mostrado uma única vez. ' +
            'Header obrigatório: `Authorization: Bearer pcok_xxxxxxxxxxxxxxxx`.',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          required: ['error'],
          properties: {
            error: {
              type: 'object',
              required: ['code', 'message'],
              properties: {
                code: {
                  type: 'string',
                  enum: [
                    'UNAUTHORIZED',
                    'FORBIDDEN',
                    'NOT_FOUND',
                    'INVALID_INPUT',
                    'RATE_LIMITED',
                    'INTERNAL',
                  ],
                },
                message: { type: 'string' },
                details: {},
              },
            },
          },
        },
        TokenInfo: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            scopes: {
              type: 'array',
              items: { $ref: '#/components/schemas/Scope' },
            },
            prefix: { type: 'string', example: 'pcok_a1b2c3' },
            createdAt: { type: 'string', format: 'date-time' },
            expiresAt: { type: 'string', format: 'date-time', nullable: true },
            usageCount: { type: 'integer' },
          },
        },
        Scope: {
          type: 'string',
          enum: [
            'stats:read',
            'students:read',
            'orders:read',
            'courses:read',
            'certificates:read',
            'products:read',
            'all:read',
          ],
        },
        StatsSummary: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string', format: 'date-time' },
            users: {
              type: 'object',
              properties: {
                total: { type: 'integer' },
                active: { type: 'integer' },
                students: { type: 'integer' },
                admins: { type: 'integer' },
              },
            },
            orders: {
              type: 'object',
              properties: {
                total: { type: 'integer' },
                paid: { type: 'integer' },
                refunded: { type: 'integer' },
                canceled: { type: 'integer' },
              },
            },
            revenue: {
              type: 'object',
              properties: {
                currency: { type: 'string', example: 'BRL' },
                netCents: { type: 'integer' },
                grossCents: { type: 'integer' },
                refundedCents: { type: 'integer' },
              },
            },
          },
        },
        Student: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            active: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            lastLoginAt: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        Order: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            userId: { type: 'string' },
            userEmail: { type: 'string', format: 'email' },
            productId: { type: 'string' },
            productName: { type: 'string' },
            amountCents: { type: 'integer' },
            currency: { type: 'string' },
            status: {
              type: 'string',
              enum: ['pending', 'paid', 'refunded', 'canceled', 'failed'],
            },
            gatewayProvider: { type: 'string' },
            externalId: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            paidAt: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        CourseSummary: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            slug: { type: 'string', nullable: true },
            moduleCount: { type: 'integer' },
            lessonCount: { type: 'integer' },
          },
        },
        CourseDetail: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            slug: { type: 'string', nullable: true },
            shortTitle: { type: 'string' },
            description: { type: 'string' },
            totalHours: { type: 'number' },
            tags: { type: 'array', items: { type: 'string' } },
            modules: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  title: { type: 'string' },
                  description: { type: 'string' },
                  order: { type: 'integer' },
                  lessons: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        title: { type: 'string' },
                        durationMinutes: { type: 'number' },
                        isMandatory: { type: 'boolean' },
                        order: { type: 'integer' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        Certificate: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            studentId: { type: 'string' },
            courseId: { type: 'string' },
            validationCode: { type: 'string' },
            issuedAt: { type: 'string', format: 'date-time' },
          },
        },
        CertificateDetail: {
          allOf: [
            { $ref: '#/components/schemas/Certificate' },
            {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['issued', 'revoked'] },
                validationUrl: { type: 'string', format: 'uri' },
              },
            },
          ],
        },
        Product: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            kind: { type: 'string', enum: ['course', 'bundle', 'session_pack', 'tutor_pack'] },
            name: { type: 'string' },
            priceCents: { type: 'integer' },
            currency: { type: 'string' },
            active: { type: 'boolean' },
            refId: { type: 'string' },
          },
        },
      },
    },
    security: [{ ApiToken: [] }],
    paths: {
      '/v1/me': {
        get: {
          summary: 'Inspeciona o token atual',
          description: 'Retorna informações do token autenticado (escopos, criação, uso).',
          tags: ['Auth'],
          security: [{ ApiToken: [] }],
          responses: {
            '200': {
              description: 'Token info',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/TokenInfo' },
                },
              },
            },
            '401': errorRef('Token ausente ou inválido'),
          },
        },
      },
      '/v1/stats/summary': {
        get: {
          summary: 'Métricas agregadas (revenue, users, orders)',
          tags: ['Stats'],
          security: [{ ApiToken: ['stats:read'] }],
          responses: {
            '200': {
              description: 'Snapshot agregado',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/StatsSummary' },
                },
              },
            },
            '401': errorRef('Token ausente'),
            '403': errorRef('Falta escopo stats:read'),
          },
        },
      },
      '/v1/students': {
        get: {
          summary: 'Lista alunos (paginada)',
          tags: ['Students'],
          security: [{ ApiToken: ['students:read'] }],
          parameters: [
            {
              name: 'limit',
              in: 'query',
              required: false,
              schema: { type: 'integer', minimum: 1, maximum: 1000, default: 100 },
            },
          ],
          responses: {
            '200': {
              description: 'Lista de alunos',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Student' },
                  },
                },
              },
            },
            '401': errorRef('Token ausente'),
            '403': errorRef('Falta escopo students:read'),
          },
        },
      },
      '/v1/orders': {
        get: {
          summary: 'Lista pedidos com filtro opcional por status',
          tags: ['Orders'],
          security: [{ ApiToken: ['orders:read'] }],
          parameters: [
            {
              name: 'limit',
              in: 'query',
              required: false,
              schema: { type: 'integer', minimum: 1, maximum: 1000, default: 100 },
            },
            {
              name: 'status',
              in: 'query',
              required: false,
              schema: {
                type: 'string',
                enum: ['pending', 'paid', 'refunded', 'canceled', 'failed'],
              },
            },
          ],
          responses: {
            '200': {
              description: 'Lista de pedidos',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Order' },
                  },
                },
              },
            },
            '401': errorRef('Token ausente'),
            '403': errorRef('Falta escopo orders:read'),
          },
        },
      },
      '/v1/courses': {
        get: {
          summary: 'Lista cursos (resumo)',
          tags: ['Courses'],
          security: [{ ApiToken: ['courses:read'] }],
          responses: {
            '200': {
              description: 'Resumo de cursos',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/CourseSummary' },
                  },
                },
              },
            },
            '401': errorRef('Token ausente'),
            '403': errorRef('Falta escopo courses:read'),
          },
        },
      },
      '/v1/courses/{id}': {
        get: {
          summary: 'Detalhe de curso com módulos e aulas',
          tags: ['Courses'],
          security: [{ ApiToken: ['courses:read'] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'Curso completo',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/CourseDetail' },
                },
              },
            },
            '404': errorRef('Curso não encontrado'),
            '401': errorRef('Token ausente'),
            '403': errorRef('Falta escopo courses:read'),
          },
        },
      },
      '/v1/certificates': {
        get: {
          summary: 'Lista certificados emitidos',
          tags: ['Certificates'],
          security: [{ ApiToken: ['certificates:read'] }],
          responses: {
            '200': {
              description: 'Lista de certificados',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Certificate' },
                  },
                },
              },
            },
            '401': errorRef('Token ausente'),
            '403': errorRef('Falta escopo certificates:read'),
          },
        },
      },
      '/v1/certificates/{id}': {
        get: {
          summary: 'Detalhe de certificado com URL pública de validação',
          tags: ['Certificates'],
          security: [{ ApiToken: ['certificates:read'] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'Certificado',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/CertificateDetail' },
                },
              },
            },
            '404': errorRef('Certificado não encontrado'),
            '401': errorRef('Token ausente'),
            '403': errorRef('Falta escopo certificates:read'),
          },
        },
      },
      '/v1/products': {
        get: {
          summary: 'Lista produtos do catálogo',
          tags: ['Products'],
          security: [{ ApiToken: ['products:read'] }],
          responses: {
            '200': {
              description: 'Lista de produtos',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Product' },
                  },
                },
              },
            },
            '401': errorRef('Token ausente'),
            '403': errorRef('Falta escopo products:read'),
          },
        },
      },
    },
    tags: [
      { name: 'Auth', description: 'Token e escopos' },
      { name: 'Stats', description: 'Métricas agregadas' },
      { name: 'Students', description: 'Alunos cadastrados' },
      { name: 'Orders', description: 'Pedidos e pagamentos' },
      { name: 'Courses', description: 'Catálogo de cursos' },
      { name: 'Certificates', description: 'Certificados emitidos' },
      { name: 'Products', description: 'Produtos comercializáveis' },
    ],
  };
}

function errorRef(description: string) {
  return {
    description,
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/Error' },
      },
    },
  };
}

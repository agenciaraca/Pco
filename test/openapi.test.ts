import { describe, it, expect } from 'vitest';
import { buildOpenApiSpec } from '../server/http/openapi';

interface OpenApiPath {
  get?: {
    summary?: string;
    security?: Array<{ ApiToken?: string[] }>;
    responses: Record<string, { description?: string; content?: unknown }>;
    parameters?: Array<{ name: string; in: string; required?: boolean }>;
  };
}

interface OpenApiSpec {
  openapi: string;
  info: { title: string; version: string };
  servers: Array<{ url: string }>;
  paths: Record<string, OpenApiPath>;
  components: {
    schemas: Record<string, unknown>;
    securitySchemes: Record<string, unknown>;
  };
  tags: Array<{ name: string }>;
}

describe('OpenAPI spec', () => {
  it('é OpenAPI 3.0.x válido na superfície', () => {
    const s = buildOpenApiSpec() as OpenApiSpec;
    expect(s.openapi).toMatch(/^3\.0/);
    expect(s.info.title).toContain('AVA PCO');
    expect(s.info.version).toBeTruthy();
  });

  it('usa origin/version customizadas quando passados', () => {
    const s = buildOpenApiSpec({
      origin: 'https://custom.example.com',
      version: '9.9.9',
    }) as OpenApiSpec;
    expect(s.info.version).toBe('9.9.9');
    expect(s.servers[0].url).toBe('https://custom.example.com/api');
  });

  it('declara securitySchemes ApiToken bearer', () => {
    const s = buildOpenApiSpec() as OpenApiSpec;
    expect(s.components.securitySchemes).toHaveProperty('ApiToken');
  });

  it('cobre todas as 9 rotas /v1 conhecidas', () => {
    const s = buildOpenApiSpec() as OpenApiSpec;
    const expected = [
      '/v1/me',
      '/v1/stats/summary',
      '/v1/students',
      '/v1/orders',
      '/v1/courses',
      '/v1/courses/{id}',
      '/v1/certificates',
      '/v1/certificates/{id}',
      '/v1/products',
    ];
    for (const p of expected) {
      expect(Object.keys(s.paths)).toContain(p);
    }
  });

  it('cada rota /v1 tem GET com ApiToken security e response 200', () => {
    const s = buildOpenApiSpec() as OpenApiSpec;
    for (const [route, value] of Object.entries(s.paths)) {
      expect(value.get, `${route} sem GET`).toBeDefined();
      expect(value.get!.security, `${route} sem security`).toBeDefined();
      expect(value.get!.responses['200'], `${route} sem 200`).toBeDefined();
    }
  });

  it('rotas /v1/courses/{id} e /v1/certificates/{id} têm path param id required', () => {
    const s = buildOpenApiSpec() as OpenApiSpec;
    for (const route of ['/v1/courses/{id}', '/v1/certificates/{id}']) {
      const params = s.paths[route].get!.parameters!;
      const idParam = params.find((p) => p.name === 'id');
      expect(idParam, `${route} sem param id`).toBeDefined();
      expect(idParam!.in).toBe('path');
      expect(idParam!.required).toBe(true);
    }
  });

  it('/v1/orders aceita query status com enum', () => {
    const s = buildOpenApiSpec() as OpenApiSpec;
    const params = s.paths['/v1/orders'].get!.parameters!;
    const statusParam = params.find((p) => p.name === 'status');
    expect(statusParam).toBeDefined();
    expect(statusParam!.in).toBe('query');
  });

  it('escopos requeridos por rota batem com a implementação', () => {
    const s = buildOpenApiSpec() as OpenApiSpec;
    const expectedScopes: Record<string, string[]> = {
      '/v1/stats/summary': ['stats:read'],
      '/v1/students': ['students:read'],
      '/v1/orders': ['orders:read'],
      '/v1/courses': ['courses:read'],
      '/v1/courses/{id}': ['courses:read'],
      '/v1/certificates': ['certificates:read'],
      '/v1/certificates/{id}': ['certificates:read'],
      '/v1/products': ['products:read'],
    };
    for (const [route, scopes] of Object.entries(expectedScopes)) {
      const sec = s.paths[route].get!.security!;
      expect(sec[0].ApiToken, `${route}`).toEqual(scopes);
    }
  });

  it('declara schemas reusáveis para Order, Student, Course, Certificate, Product', () => {
    const s = buildOpenApiSpec() as OpenApiSpec;
    const required = [
      'Error',
      'TokenInfo',
      'Scope',
      'StatsSummary',
      'Student',
      'Order',
      'CourseSummary',
      'CourseDetail',
      'Certificate',
      'CertificateDetail',
      'Product',
    ];
    for (const name of required) {
      expect(Object.keys(s.components.schemas)).toContain(name);
    }
  });

  it('servers inclui produção e localhost', () => {
    const s = buildOpenApiSpec() as OpenApiSpec;
    expect(s.servers.length).toBeGreaterThanOrEqual(2);
    const urls = s.servers.map((sv) => sv.url);
    expect(urls.some((u) => u.includes('localhost'))).toBe(true);
  });

  it('declara tags pra agrupamento na UI Swagger', () => {
    const s = buildOpenApiSpec() as OpenApiSpec;
    const tagNames = s.tags.map((t) => t.name);
    expect(tagNames).toEqual(
      expect.arrayContaining([
        'Auth',
        'Stats',
        'Students',
        'Orders',
        'Courses',
        'Certificates',
        'Products',
      ]),
    );
  });
});

// Tests do tratamento gracioso de 404 rest_no_route no orchestrator de imports.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { collectFromApi } from '../server/imports/connectors/orchestrator';
import { ConnectorError } from '../server/imports/connectors/http';
import type { ImportConnection } from '../server/imports/connections-store';

const FAKE_CONN = {
  id: 'imc-x',
  name: 'fake',
  kind: 'wp_ld_wc' as const,
  siteUrl: 'https://example.com',
  wpUsername: 'u',
  wpAppPassword: 'p',
  createdAt: '',
  updatedAt: '',
} as unknown as ImportConnection;

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('collectFromApi — skip gracioso 404 rest_no_route', () => {
  it('quando WC nao existe (404 rest_no_route em products), pula sem falhar', async () => {
    vi.doMock('../server/imports/connectors/wp', () => ({
      fetchWpStudents: vi.fn().mockResolvedValue([{ id: 1, email: 'a@b.c' }]),
    }));
    vi.doMock('../server/imports/connectors/wc', () => ({
      fetchWcProducts: vi.fn().mockRejectedValue(
        new ConnectorError(
          'HTTP 404',
          404,
          '{"code":"rest_no_route","message":"Nenhuma rota","data":{"status":404}}',
        ),
      ),
      fetchWcOrders: vi.fn().mockRejectedValue(
        new ConnectorError(
          'HTTP 404',
          404,
          '{"code":"rest_no_route","message":"Nenhuma rota","data":{"status":404}}',
        ),
      ),
    }));
    vi.doMock('../server/imports/connectors/ld', () => ({
      fetchLdCourses: vi.fn().mockResolvedValue([]),
      fetchLdLessons: vi.fn().mockResolvedValue([]),
      fetchLdTopics: vi.fn().mockResolvedValue([]),
      fetchLdQuizzes: vi.fn().mockResolvedValue([]),
      fetchLdQuestions: vi.fn().mockResolvedValue([]),
      fetchLdGroups: vi.fn().mockResolvedValue([]),
      fetchLdEnrollments: vi.fn().mockResolvedValue([]),
      fetchLdProgress: vi.fn().mockResolvedValue([]),
    }));
    const { collectFromApi: fresh } = await import(
      '../server/imports/connectors/orchestrator'
    );
    const r = await fresh(FAKE_CONN, {
      entities: ['student', 'product', 'order', 'course'],
    });
    expect(r.skipped).toHaveLength(2);
    expect(r.skipped.map((s) => s.entity).sort()).toEqual(['order', 'product']);
    expect(r.skipped[0].reason).toMatch(/rest_no_route|nao disponivel/i);
    expect(r.rowsByEntity.student).toHaveLength(1);
    expect(r.rowsByEntity.product).toBeUndefined();
    expect(r.rowsByEntity.order).toBeUndefined();
  });

  it('quando LD nao existe (404 em courses), pula entidades LD sem falhar', async () => {
    vi.doMock('../server/imports/connectors/wp', () => ({
      fetchWpStudents: vi.fn().mockResolvedValue([]),
    }));
    vi.doMock('../server/imports/connectors/ld', () => ({
      fetchLdCourses: vi.fn().mockRejectedValue(
        new ConnectorError(
          'HTTP 404',
          404,
          '{"code":"rest_no_route","message":"Nenhuma rota","data":{"status":404}}',
        ),
      ),
      fetchLdLessons: vi.fn().mockRejectedValue(
        new ConnectorError('HTTP 404', 404, '{"code":"rest_no_route"}'),
      ),
      fetchLdTopics: vi.fn().mockResolvedValue([]),
      fetchLdQuizzes: vi.fn().mockResolvedValue([]),
      fetchLdQuestions: vi.fn().mockResolvedValue([]),
      fetchLdGroups: vi.fn().mockResolvedValue([]),
      fetchLdEnrollments: vi.fn().mockResolvedValue([]),
      fetchLdProgress: vi.fn().mockResolvedValue([]),
    }));
    vi.doMock('../server/imports/connectors/wc', () => ({
      fetchWcProducts: vi.fn().mockResolvedValue([{ id: 99 }]),
      fetchWcOrders: vi.fn().mockResolvedValue([]),
    }));
    const { collectFromApi: fresh } = await import(
      '../server/imports/connectors/orchestrator'
    );
    const r = await fresh(FAKE_CONN, {
      entities: ['student', 'course', 'lesson', 'product'],
    });
    expect(r.skipped.map((s) => s.entity).sort()).toEqual(['course', 'lesson']);
    expect(r.rowsByEntity.product).toHaveLength(1);
  });

  it('NAO pula erros nao-404 — propaga normalmente (ex: 500)', async () => {
    vi.doMock('../server/imports/connectors/wp', () => ({
      fetchWpStudents: vi.fn().mockRejectedValue(
        new ConnectorError('HTTP 500 Internal', 500, 'oops'),
      ),
    }));
    vi.doMock('../server/imports/connectors/ld', () => ({
      fetchLdCourses: vi.fn().mockResolvedValue([]),
      fetchLdLessons: vi.fn().mockResolvedValue([]),
      fetchLdTopics: vi.fn().mockResolvedValue([]),
      fetchLdQuizzes: vi.fn().mockResolvedValue([]),
      fetchLdQuestions: vi.fn().mockResolvedValue([]),
      fetchLdGroups: vi.fn().mockResolvedValue([]),
      fetchLdEnrollments: vi.fn().mockResolvedValue([]),
      fetchLdProgress: vi.fn().mockResolvedValue([]),
    }));
    vi.doMock('../server/imports/connectors/wc', () => ({
      fetchWcProducts: vi.fn().mockResolvedValue([]),
      fetchWcOrders: vi.fn().mockResolvedValue([]),
    }));
    const { collectFromApi: fresh } = await import(
      '../server/imports/connectors/orchestrator'
    );
    await expect(
      fresh(FAKE_CONN, { entities: ['student'] }),
    ).rejects.toThrow(/500/);
  });

  it('detecta rest_no_route via mensagem de fallback (sem ConnectorError)', async () => {
    vi.doMock('../server/imports/connectors/wp', () => ({
      fetchWpStudents: vi
        .fn()
        .mockRejectedValue(new Error('HTTP 404 em /wc/v3: rest_no_route')),
    }));
    vi.doMock('../server/imports/connectors/ld', () => ({
      fetchLdCourses: vi.fn().mockResolvedValue([]),
      fetchLdLessons: vi.fn().mockResolvedValue([]),
      fetchLdTopics: vi.fn().mockResolvedValue([]),
      fetchLdQuizzes: vi.fn().mockResolvedValue([]),
      fetchLdQuestions: vi.fn().mockResolvedValue([]),
      fetchLdGroups: vi.fn().mockResolvedValue([]),
      fetchLdEnrollments: vi.fn().mockResolvedValue([]),
      fetchLdProgress: vi.fn().mockResolvedValue([]),
    }));
    vi.doMock('../server/imports/connectors/wc', () => ({
      fetchWcProducts: vi.fn().mockResolvedValue([]),
      fetchWcOrders: vi.fn().mockResolvedValue([]),
    }));
    const { collectFromApi: fresh } = await import(
      '../server/imports/connectors/orchestrator'
    );
    const r = await fresh(FAKE_CONN, { entities: ['student'] });
    expect(r.skipped).toHaveLength(1);
    expect(r.skipped[0].entity).toBe('student');
  });

  it('totalRows + perEntity contam apenas entidades coletadas', async () => {
    vi.doMock('../server/imports/connectors/wp', () => ({
      fetchWpStudents: vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]),
    }));
    vi.doMock('../server/imports/connectors/wc', () => ({
      fetchWcProducts: vi.fn().mockRejectedValue(
        new ConnectorError('HTTP 404', 404, '{"code":"rest_no_route"}'),
      ),
      fetchWcOrders: vi.fn().mockResolvedValue([]),
    }));
    vi.doMock('../server/imports/connectors/ld', () => ({
      fetchLdCourses: vi.fn().mockResolvedValue([{ id: 10 }]),
      fetchLdLessons: vi.fn().mockResolvedValue([]),
      fetchLdTopics: vi.fn().mockResolvedValue([]),
      fetchLdQuizzes: vi.fn().mockResolvedValue([]),
      fetchLdQuestions: vi.fn().mockResolvedValue([]),
      fetchLdGroups: vi.fn().mockResolvedValue([]),
      fetchLdEnrollments: vi.fn().mockResolvedValue([]),
      fetchLdProgress: vi.fn().mockResolvedValue([]),
    }));
    const { collectFromApi: fresh } = await import(
      '../server/imports/connectors/orchestrator'
    );
    const r = await fresh(FAKE_CONN, {
      entities: ['student', 'course', 'product'],
    });
    expect(r.totalRows).toBe(4); // 3 students + 1 course
    expect(r.perEntity.student).toBe(3);
    expect(r.perEntity.course).toBe(1);
    expect(r.perEntity.product).toBeUndefined();
    expect(r.skipped[0].entity).toBe('product');
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getLdSlugs, _resetLdSlugCacheForTests } from '../server/imports/connectors/ld';
import type { ImportConnection } from '../server/imports/connections-store';

const devEncode = (s: string) => `dev:${Buffer.from(s, 'utf8').toString('base64')}`;

const conn: ImportConnection = {
  id: 'c-disc',
  name: 'PCO',
  kind: 'wp_ld_wc',
  siteUrl: 'https://psicanaliseclinica.online',
  wpUsername: 'admin',
  wpAppPassword: devEncode('secret'),
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

// Index com slugs PT-BR (do site real do usuário)
const PT_BR_INDEX = {
  namespace: 'ldlms/v2',
  routes: {
    '/ldlms/v2': {},
    '/ldlms/v2/cursos': {},
    '/ldlms/v2/cursos/(?P<id>[\\d]+)/usuarios': {},
    '/ldlms/v2/cursos/(?P<id>[\\d]+)/passo': {},
    '/ldlms/v2/cursos/(?P<id>[\\d]+)/grupos': {},
    '/ldlms/v2/cursos/(?P<id>[\\d]+)/prerequisitos': {},
    '/ldlms/v2/aulas': {},
    '/ldlms/v2/topicos': {},
    '/ldlms/v2/teste': {},
    '/ldlms/v2/sfwd-question': {},
    '/ldlms/v2/groups': {},
    '/ldlms/v2/users': {},
    '/ldlms/v2/users/(?P<id>[\\d]+)/courses': {},
    '/ldlms/v2/users/(?P<id>[\\d]+)/course-progress': {},
  },
};

const ENGLISH_INDEX = {
  namespace: 'ldlms/v2',
  routes: {
    '/ldlms/v2/sfwd-courses': {},
    '/ldlms/v2/sfwd-lessons': {},
    '/ldlms/v2/sfwd-topic': {},
    '/ldlms/v2/sfwd-quiz': {},
    '/ldlms/v2/sfwd-question': {},
    '/ldlms/v2/groups': {},
    '/ldlms/v2/sfwd-courses/(?P<id>[\\d]+)/users': {},
    '/ldlms/v2/sfwd-courses/(?P<id>[\\d]+)/steps': {},
    '/ldlms/v2/sfwd-courses/(?P<id>[\\d]+)/prerequisites': {},
  },
};

function mockFetchReturning(body: unknown, status = 200): typeof globalThis.fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response) as unknown as typeof globalThis.fetch;
}

describe('getLdSlugs — auto-discovery', () => {
  let originalFetch: typeof globalThis.fetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
    _resetLdSlugCacheForTests();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('detecta slugs PT-BR do site psicanaliseclinica.online', async () => {
    globalThis.fetch = mockFetchReturning(PT_BR_INDEX);
    const slugs = await getLdSlugs(conn);
    expect(slugs.courses).toBe('cursos');
    expect(slugs.lessons).toBe('aulas');
    expect(slugs.topics).toBe('topicos');
    expect(slugs.quizzes).toBe('teste');
    expect(slugs.questions).toBe('sfwd-question');
    expect(slugs.groups).toBe('groups');
  });

  it('detecta subroutes localizadas (passo, prerequisitos, usuarios)', async () => {
    globalThis.fetch = mockFetchReturning(PT_BR_INDEX);
    const slugs = await getLdSlugs(conn);
    expect(slugs.courseUsers).toBe('usuarios');
    expect(slugs.courseSteps).toBe('passo');
    expect(slugs.coursePrerequisites).toBe('prerequisitos');
    expect(slugs.userCourseProgress).toBe('course-progress');
  });

  it('site em inglês padrão retorna slugs sfwd-*', async () => {
    globalThis.fetch = mockFetchReturning(ENGLISH_INDEX);
    const slugs = await getLdSlugs(conn);
    expect(slugs.courses).toBe('sfwd-courses');
    expect(slugs.lessons).toBe('sfwd-lessons');
    expect(slugs.topics).toBe('sfwd-topic');
    expect(slugs.quizzes).toBe('sfwd-quiz');
    expect(slugs.courseUsers).toBe('users');
    expect(slugs.courseSteps).toBe('steps');
    expect(slugs.coursePrerequisites).toBe('prerequisites');
  });

  it('fallback pra defaults quando index inacessível', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers(),
      text: async () => 'erro',
    } as unknown as Response);
    const slugs = await getLdSlugs(conn);
    expect(slugs.courses).toBe('sfwd-courses');
    expect(slugs.lessons).toBe('sfwd-lessons');
  });

  it('cacheia por connection id (segunda chamada não fetcha de novo)', async () => {
    const spy = mockFetchReturning(PT_BR_INDEX);
    globalThis.fetch = spy;
    await getLdSlugs(conn);
    await getLdSlugs(conn);
    await getLdSlugs(conn);
    expect((spy as { mock: { calls: unknown[] } }).mock.calls.length).toBe(1);
  });

  it('connections diferentes têm caches isolados', async () => {
    const spy = mockFetchReturning(PT_BR_INDEX);
    globalThis.fetch = spy;
    await getLdSlugs(conn);
    await getLdSlugs({ ...conn, id: 'outra-conn' });
    expect((spy as { mock: { calls: unknown[] } }).mock.calls.length).toBe(2);
  });

  it('site com slugs ES (cursos+lecciones) é detectado', async () => {
    globalThis.fetch = mockFetchReturning({
      namespace: 'ldlms/v2',
      routes: {
        '/ldlms/v2/cursos': {},
        '/ldlms/v2/lecciones': {},
        '/ldlms/v2/groups': {},
      },
    });
    const slugs = await getLdSlugs(conn);
    expect(slugs.courses).toBe('cursos');
    expect(slugs.lessons).toBe('lecciones');
  });

  it('mistura PT/EN (courses default + lessons custom) — pega cada um separadamente', async () => {
    globalThis.fetch = mockFetchReturning({
      namespace: 'ldlms/v2',
      routes: {
        '/ldlms/v2/sfwd-courses': {},
        '/ldlms/v2/aulas': {},
        '/ldlms/v2/sfwd-topic': {},
      },
    });
    const slugs = await getLdSlugs(conn);
    expect(slugs.courses).toBe('sfwd-courses');
    expect(slugs.lessons).toBe('aulas');
    expect(slugs.topics).toBe('sfwd-topic');
  });

  it('routes vazias → fallback defaults', async () => {
    globalThis.fetch = mockFetchReturning({ namespace: 'ldlms/v2', routes: {} });
    const slugs = await getLdSlugs(conn);
    expect(slugs.courses).toBe('sfwd-courses');
  });

  it('ignora paths com placeholders no nivel top', async () => {
    globalThis.fetch = mockFetchReturning({
      namespace: 'ldlms/v2',
      routes: {
        '/ldlms/v2/(?P<weird>[a-z]+)': {},
        '/ldlms/v2/cursos': {},
      },
    });
    const slugs = await getLdSlugs(conn);
    expect(slugs.courses).toBe('cursos');
  });
});

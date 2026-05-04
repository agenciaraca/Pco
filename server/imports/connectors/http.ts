// Helper HTTP comum aos connectors REST (WP/LD/WC).
// Faz fetch com Basic Auth, paginação automática e tratamento de erros.

export interface FetchOptions {
  baseUrl: string;
  path: string;
  query?: Record<string, string | number | undefined>;
  username?: string;
  password?: string;
  // Timeout por request individual (ms)
  timeoutMs?: number;
}

export class ConnectorError extends Error {
  status: number;
  body?: unknown;
  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

function buildUrl(opts: FetchOptions): string {
  const url = new URL(opts.path.replace(/^\//, ''), opts.baseUrl + '/');
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null && v !== '')
        url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

function authHeader(username?: string, password?: string): Record<string, string> {
  if (!username || !password) return {};
  const b64 = Buffer.from(`${username}:${password}`).toString('base64');
  return { Authorization: `Basic ${b64}` };
}

export async function getJson<T = unknown>(opts: FetchOptions): Promise<{
  data: T;
  totalPages?: number;
  total?: number;
}> {
  const url = buildUrl(opts);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 30_000);
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        ...authHeader(opts.username, opts.password),
      },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new ConnectorError(
        `HTTP ${res.status} em ${url}: ${body.slice(0, 300)}`,
        res.status,
        body,
      );
    }
    const data = (await res.json()) as T;
    const totalPages = Number(res.headers.get('x-wp-totalpages') ?? '');
    const total = Number(res.headers.get('x-wp-total') ?? '');
    return {
      data,
      totalPages: Number.isFinite(totalPages) && totalPages > 0 ? totalPages : undefined,
      total: Number.isFinite(total) && total > 0 ? total : undefined,
    };
  } finally {
    clearTimeout(t);
  }
}

/**
 * Paginate WP-style: usa headers X-WP-TotalPages quando disponíveis,
 * caso contrário pára quando uma página vier vazia.
 */
export async function* paginate<T = unknown>(
  base: Omit<FetchOptions, 'query'> & { query?: Record<string, string | number> },
  perPage = 100,
  maxPages = 1000,
): AsyncGenerator<T[], void, unknown> {
  let page = 1;
  let knownTotalPages: number | undefined;
  while (page <= maxPages) {
    const { data, totalPages } = await getJson<T[]>({
      ...base,
      query: { ...base.query, page, per_page: perPage },
    });
    if (!Array.isArray(data) || data.length === 0) return;
    yield data;
    if (totalPages !== undefined) knownTotalPages = totalPages;
    if (knownTotalPages !== undefined && page >= knownTotalPages) return;
    page++;
  }
}

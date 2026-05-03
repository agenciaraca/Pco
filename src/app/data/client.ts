// HTTP client centralizado — single point para autenticação, erros e logging.

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const BASE_URL = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '');

const STORAGE_KEY = 'ava-pco-auth';

function getToken(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.token ?? null;
  } catch {
    return null;
  }
}

interface RequestOptions extends RequestInit {
  query?: Record<string, string | number | boolean | undefined | null>;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { query, headers, ...rest } = options;

  let url = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  if (query) {
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      usp.set(k, String(v));
    }
    const qs = usp.toString();
    if (qs) url += (url.includes('?') ? '&' : '?') + qs;
  }

  const token = getToken();
  const finalHeaders: HeadersInit = {
    'content-type': 'application/json',
    accept: 'application/json',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(headers ?? {}),
  };

  let response: Response;
  try {
    response = await fetch(url, { ...rest, headers: finalHeaders, credentials: 'include' });
  } catch (err) {
    throw new ApiError(0, 'NETWORK', 'Falha de rede ou servidor indisponível.', String(err));
  }

  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const body = isJson ? await response.json().catch(() => null) : await response.text();

  if (!response.ok) {
    const code = (body as { error?: { code?: string } })?.error?.code ?? 'HTTP_ERROR';
    const message =
      (body as { error?: { message?: string } })?.error?.message ??
      `Requisição falhou (${response.status})`;
    const details = (body as { error?: { details?: unknown } })?.error?.details;
    throw new ApiError(response.status, code, message, details);
  }

  return body as T;
}

export const http = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};

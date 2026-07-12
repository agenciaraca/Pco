// Connector WordPress — usa /wp-json/wp/v2/users com Basic Auth (Application Password).
// Retorna rows no formato canônico esperado pelo importer (mesmas chaves do CSV de students).

import { paginate } from './http';
import type { ImportConnection } from '../connections-store';
import { decryptCreds } from '../connections-store';

interface WpUser {
  id: number;
  username?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  email: string;
  registered_date?: string;
  roles?: string[];
  meta?: Record<string, unknown>;
}

/**
 * Diagnóstico detalhado: testa /wp-json, /wp/v2/users/me (vê role atual)
 * e /wp/v2/users?context=edit (testa permissão real). Retorna info útil
 * pra debugar 401 forbidden_context.
 */
export async function diagnoseWp(c: ImportConnection): Promise<{
  rootOk: boolean;
  rootStatus: number;
  rootMessage: string;
  meOk: boolean;
  meStatus: number;
  meRoles: string[];
  meUser: string | null;
  usersListOk: boolean;
  usersListStatus: number;
  usersListMessage: string;
  usersFirstEmail: string | null;
}> {
  const creds = decryptCreds(c);
  const baseUrl = c.siteUrl.replace(/\/+$/, '');
  const authHeader =
    creds.wpUsername && creds.wpAppPassword
      ? `Basic ${Buffer.from(`${creds.wpUsername}:${creds.wpAppPassword}`).toString('base64')}`
      : '';

  async function call(
    path: string,
  ): Promise<{ status: number; body: unknown; bodyText: string }> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12_000);
    try {
      const res = await fetch(`${baseUrl}${path}`, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'AVA-PCO-Importer/1.0',
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        signal: ctrl.signal,
        redirect: 'follow',
      });
      clearTimeout(t);
      const text = await res.text();
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        /* ignore */
      }
      return { status: res.status, body: parsed, bodyText: text.slice(0, 500) };
    } catch (err) {
      clearTimeout(t);
      const e = err as { message?: string };
      return { status: 0, body: null, bodyText: e?.message ?? 'fetch failed' };
    }
  }

  const root = await call('/wp-json');
  const me = await call('/wp-json/wp/v2/users/me?context=edit');
  const users = await call('/wp-json/wp/v2/users?context=edit&per_page=1');

  const meBody = me.body as { roles?: string[]; name?: string; code?: string } | null;
  const usersBody = users.body as Array<{ email?: string }> | { code?: string; message?: string } | null;
  const usersFirstEmail = Array.isArray(usersBody) && usersBody[0]
    ? usersBody[0].email ?? null
    : null;

  let usersListMessage = '';
  if (users.status === 200 && Array.isArray(usersBody)) {
    usersListMessage = `OK — ${usersBody.length} user(s) retornado(s) na página 1`;
  } else if (users.status === 401) {
    const code = (usersBody as { code?: string } | null)?.code ?? '';
    const msg = (usersBody as { message?: string } | null)?.message ?? '';
    usersListMessage = `401 ${code}: ${msg}`;
  } else if (users.status === 0) {
    usersListMessage = `Falha de rede: ${users.bodyText}`;
  } else {
    usersListMessage = `HTTP ${users.status} — ${users.bodyText.slice(0, 200)}`;
  }

  return {
    rootOk: root.status === 200,
    rootStatus: root.status,
    rootMessage:
      root.status === 200
        ? `OK — REST API ativa em ${baseUrl}/wp-json`
        : `HTTP ${root.status} — ${root.bodyText.slice(0, 200)}`,
    meOk: me.status === 200,
    meStatus: me.status,
    meRoles: meBody?.roles ?? [],
    meUser: meBody?.name ?? null,
    usersListOk: users.status === 200 && Array.isArray(usersBody),
    usersListStatus: users.status,
    usersListMessage,
    usersFirstEmail,
  };
}

export async function pingWp(c: ImportConnection): Promise<{ ok: boolean; message: string }> {
  const creds = decryptCreds(c);
  // Tenta /wp-json (raiz da REST API). Se 401 sem creds, ainda significa que existe.
  try {
    const url = `${c.siteUrl.replace(/\/+$/, '')}/wp-json`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12_000);
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'AVA-PCO-Importer/1.0',
        ...(creds.wpUsername && creds.wpAppPassword
          ? {
              Authorization: `Basic ${Buffer.from(
                `${creds.wpUsername}:${creds.wpAppPassword}`,
              ).toString('base64')}`,
            }
          : {}),
      },
      signal: ctrl.signal,
      redirect: 'follow',
    });
    clearTimeout(t);
    if (!res.ok && res.status !== 401) {
      return {
        ok: false,
        message: `${url} → HTTP ${res.status}. Verifique se o WordPress responde nessa URL.`,
      };
    }
    const ctype = res.headers.get('content-type') ?? '';
    if (!ctype.includes('application/json')) {
      return {
        ok: false,
        message: `${url} respondeu ${res.status} mas content-type=${ctype} (esperado JSON). REST API talvez esteja bloqueada.`,
      };
    }
    const j = (await res.json().catch(() => null)) as
      | { name?: string; namespaces?: string[]; code?: string }
      | null;
    if (!j) {
      return { ok: false, message: `${url} retornou JSON inválido` };
    }
    if (res.status === 401) {
      // REST existe mas creds rejeitadas
      return {
        ok: false,
        message: `WP REST acessível em ${url} mas autenticação rejeitada. Verifique usuário e Application Password.`,
      };
    }
    const ns = (j.namespaces ?? []).join(',');
    return {
      ok: true,
      message: `OK · WP: ${j.name ?? 'sem nome'} · namespaces: ${ns.slice(0, 200)}`,
    };
  } catch (err) {
    const e = err as { name?: string; cause?: { code?: string }; message?: string };
    if (e?.name === 'AbortError') {
      return { ok: false, message: 'Timeout (12s) ao acessar WP' };
    }
    return {
      ok: false,
      message: `fetch failed (${e.cause?.code ?? e.message ?? 'unknown'}). Verifique URL/SSL/firewall.`,
    };
  }
}

export async function fetchWpStudents(
  c: ImportConnection,
  perPage = 100,
): Promise<Array<Record<string, unknown>>> {
  const creds = decryptCreds(c);

  async function fetchAll(context: 'edit' | 'view'): Promise<Array<Record<string, unknown>>> {
    const acc: Array<Record<string, unknown>> = [];
    for await (const batch of paginate<WpUser>(
      {
        baseUrl: c.siteUrl,
        path: 'wp-json/wp/v2/users',
        query: { context },
        username: creds.wpUsername,
        password: creds.wpAppPassword,
      },
      perPage,
    )) {
      pushBatch(batch, acc);
    }
    return acc;
  }

  // Retry em erros transitórios de rede (fetch failed / ECONNRESET / timeout).
  // NÃO retenta 401/403/rest_forbidden_context — é permissão, retry não ajuda.
  const isTransient = (m: string): boolean =>
    /fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|network|timed? ?out|and retry|aborted/i.test(
      m,
    ) && !/HTTP 40[13]|rest_forbidden/i.test(m);

  const MAX_ATTEMPTS = 4;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fetchAll('edit');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isTransient(msg) && attempt < MAX_ATTEMPTS) {
        // backoff linear: 2s, 4s, 6s
        await new Promise((r) => setTimeout(r, attempt * 2000));
        continue;
      }
      const is401 = msg.includes('HTTP 401');
      const isForbiddenContext = msg.includes('rest_forbidden_context');
      if (!is401 || !isForbiddenContext) {
        throw new Error(
          `Falha ao listar usuários WP: ${msg}\n\nDica: o Application Password precisa pertencer a um usuário com role "administrator" no WordPress para listar todos os alunos com email. Caso contrário, o WP retorna 401 com "rest_forbidden_context".`,
        );
      }
      break; // 401 + forbidden_context → cai no fallback context=view
    }
  }

  // Fallback: context=view (não retorna email de terceiros). Comecamos do zero
  // pra evitar duplicatas de pages que tenham vindo na primeira tentativa.
  const viewOut = await fetchAll('view');
  const anyWithEmail = viewOut.some((r) => typeof r.email === 'string' && r.email);
  if (viewOut.length > 0 && !anyWithEmail) {
    throw new Error(
      `WP retornou ${viewOut.length} usuários mas SEM email (context=view, role insuficiente). Use Application Password de um usuário com role "administrator" para importar com email completo.`,
    );
  }
  return viewOut;
}

function pushBatch(
  batch: WpUser[],
  out: Array<Record<string, unknown>>,
): void {
  for (const u of batch) {
    out.push({
      external_user_id: String(u.id),
      wp_user_id: String(u.id),
      email: u.email,
      first_name: u.first_name ?? '',
      last_name: u.last_name ?? '',
      display_name: u.name ?? '',
      registered_date: u.registered_date ?? '',
      wp_roles: (u.roles ?? []).join('|'),
      status: 'active',
    });
  }
}

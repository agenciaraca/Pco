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
  const out: Array<Record<string, unknown>> = [];

  // Tenta context=edit primeiro (retorna emails); se 401, fallback context=view
  // (limita campos mas pelo menos lista os users que o role atual pode ver).
  let context: 'edit' | 'view' = 'edit';
  try {
    for await (const batch of paginate<WpUser>(
      {
        baseUrl: c.siteUrl,
        path: 'wp-json/wp/v2/users',
        query: { context: 'edit' },
        username: creds.wpUsername,
        password: creds.wpAppPassword,
      },
      perPage,
    )) {
      pushBatch(batch, out);
    }
    return out;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('HTTP 401') && msg.includes('rest_forbidden_context')) {
      // Fallback: context=view não exige admin, mas não retorna email de outros users.
      // Útil para teste de credenciais; admin recebe aviso para usar role admin.
      context = 'view';
    } else {
      throw new Error(
        `Falha ao listar usuários WP: ${msg}\n\nDica: o Application Password precisa pertencer a um usuário com role "administrator" no WordPress para listar todos os alunos com email. Caso contrário, o WP retorna 401 com "rest_forbidden_context".`,
      );
    }
  }

  // Tenta context=view com aviso
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
    pushBatch(batch, out);
  }
  if (out.length > 0 && !out[0]!.email) {
    throw new Error(
      `WP retornou ${out.length} usuários mas SEM email (context=view, role insuficiente). Use Application Password de um usuário com role "administrator" para importar com email completo.`,
    );
  }
  return out;
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

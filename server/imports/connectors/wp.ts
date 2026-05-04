// Connector WordPress — usa /wp-json/wp/v2/users com Basic Auth (Application Password).
// Retorna rows no formato canônico esperado pelo importer (mesmas chaves do CSV de students).

import { paginate, getJson } from './http';
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
  try {
    const res = await getJson<{ name?: string; namespaces?: string[] }>({
      baseUrl: c.siteUrl,
      path: 'wp-json',
      username: creds.wpUsername,
      password: creds.wpAppPassword,
      timeoutMs: 10_000,
    });
    const ns = (res.data.namespaces ?? []).join(',');
    return {
      ok: true,
      message: `OK · WP: ${res.data.name ?? 'sem nome'} · namespaces: ${ns.slice(0, 120)}`,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function fetchWpStudents(
  c: ImportConnection,
  perPage = 100,
): Promise<Array<Record<string, unknown>>> {
  const creds = decryptCreds(c);
  const out: Array<Record<string, unknown>> = [];
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
  return out;
}

// Connector WooCommerce — REST API v3.
// Auth: consumer_key/consumer_secret via Basic Auth.
// Endpoints: /wp-json/wc/v3/products, /wp-json/wc/v3/orders.

import { paginate, getJson } from './http';
import type { ImportConnection } from '../connections-store';
import { decryptCreds } from '../connections-store';

interface WcProduct {
  id: number;
  name: string;
  slug?: string;
  sku?: string;
  description?: string;
  short_description?: string;
  price?: string;
  regular_price?: string;
  sale_price?: string;
  status?: string;
  type?: string;
  meta_data?: Array<{ key: string; value: unknown }>;
  date_created?: string;
}

interface WcLineItem {
  id: number;
  product_id: number;
  variation_id?: number;
  name: string;
  quantity: number;
  sku?: string;
  total: string;
}

interface WcOrder {
  id: number;
  status: string;
  currency: string;
  date_created: string;
  date_paid?: string | null;
  date_completed?: string | null;
  total: string;
  customer_id: number;
  billing?: {
    email?: string;
    first_name?: string;
    last_name?: string;
  };
  line_items?: WcLineItem[];
}

export interface WcPingResult {
  ok: boolean;
  skipped?: boolean;
  message: string;
}

export async function pingWc(c: ImportConnection): Promise<WcPingResult> {
  const creds = decryptCreds(c);
  if (!creds.wcConsumerKey || !creds.wcConsumerSecret) {
    return {
      ok: true, // não é erro — só não há WC configurado
      skipped: true,
      message:
        'WooCommerce não configurado. Adicione consumer_key/secret só se for importar produtos/pedidos.',
    };
  }
  try {
    const res = await getJson<{ environment?: { version?: string } }>({
      baseUrl: c.siteUrl,
      path: 'wp-json/wc/v3/system_status',
      username: creds.wcConsumerKey,
      password: creds.wcConsumerSecret,
      timeoutMs: 10_000,
    });
    return {
      ok: true,
      message: `OK · WooCommerce v${res.data?.environment?.version ?? '?'}`,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

function findMeta(metas: WcProduct['meta_data'], key: string): string {
  if (!metas) return '';
  const m = metas.find((mm) => mm.key === key);
  return m && m.value !== undefined ? String(m.value) : '';
}

export async function fetchWcProducts(
  c: ImportConnection,
  perPage = 100,
): Promise<Array<Record<string, unknown>>> {
  const creds = decryptCreds(c);
  const out: Array<Record<string, unknown>> = [];
  for await (const batch of paginate<WcProduct>(
    {
      baseUrl: c.siteUrl,
      path: 'wp-json/wc/v3/products',
      query: { status: 'any' },
      username: creds.wcConsumerKey,
      password: creds.wcConsumerSecret,
    },
    perPage,
  )) {
    for (const p of batch) {
      const linkedCourseId =
        findMeta(p.meta_data, '_related_course') ||
        findMeta(p.meta_data, 'related_course') ||
        findMeta(p.meta_data, 'learndash_course_id');
      out.push({
        external_product_id: String(p.id),
        wc_product_id: String(p.id),
        sku: p.sku ?? '',
        name: p.name,
        description: p.description ?? p.short_description ?? '',
        regular_price: p.regular_price ?? p.price ?? '',
        sale_price: p.sale_price ?? '',
        currency: '', // WC não vem por produto; pega via orders ou config
        status: p.status ?? '',
        linked_course_external_id: linkedCourseId,
      });
    }
  }
  return out;
}

export async function fetchWcOrders(
  c: ImportConnection,
  perPage = 50,
): Promise<Array<Record<string, unknown>>> {
  const creds = decryptCreds(c);
  const out: Array<Record<string, unknown>> = [];
  for await (const batch of paginate<WcOrder>(
    {
      baseUrl: c.siteUrl,
      path: 'wp-json/wc/v3/orders',
      query: { status: 'any' },
      username: creds.wcConsumerKey,
      password: creds.wcConsumerSecret,
    },
    perPage,
  )) {
    for (const o of batch) {
      out.push({
        external_order_id: String(o.id),
        wc_order_id: String(o.id),
        customer_email: o.billing?.email ?? '',
        customer_external_id: String(o.customer_id ?? ''),
        status: o.status,
        currency: o.currency,
        order_date: o.date_created,
        paid_date: o.date_paid ?? '',
        completed_date: o.date_completed ?? '',
        total: o.total,
        product_ids: (o.line_items ?? []).map((l) => l.product_id).join('|'),
        product_skus: (o.line_items ?? []).map((l) => l.sku ?? '').join('|'),
      });
    }
  }
  return out;
}

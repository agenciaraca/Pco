// Test do CSV export de webhook deliveries.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { buildCsv } from '../server/export/csv';
import type { WebhookDelivery } from '../server/webhooks/types';

let tmpDir: string;

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-csv-wh-'));
  process.env.DATA_DIR = tmpDir;
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('webhook deliveries CSV export', () => {
  function sample(over?: Partial<WebhookDelivery>): WebhookDelivery {
    return {
      id: 'whd-1',
      endpointId: 'ep-1',
      event: 'order.paid',
      payload: { orderId: 'ord-1', total: 100 },
      status: 'success',
      attempts: 1,
      createdAt: '2026-05-08T10:00:00.000Z',
      updatedAt: '2026-05-08T10:00:01.000Z',
      completedAt: '2026-05-08T10:00:01.000Z',
      lastResponseStatus: 200,
      ...over,
    };
  }

  it('serializa colunas com BOM UTF-8', () => {
    const list = [sample(), sample({ id: 'whd-2', status: 'failed', lastError: 'boom' })];
    const csv = buildCsv(list, [
      { key: 'id', label: 'id' },
      { key: 'event', label: 'event' },
      { key: 'status', label: 'status' },
      {
        key: 'lastError',
        label: 'last_error',
        map: (d) => (d.lastError ?? '').slice(0, 500),
      },
      {
        key: 'payload',
        label: 'payload_keys',
        map: (d) => Object.keys(d.payload).join('|'),
      },
    ]);
    expect(csv.charCodeAt(0)).toBe(0xfeff); // BOM
    const lines = csv.replace(/^﻿/, '').split('\r\n');
    expect(lines[0]).toBe('id,event,status,last_error,payload_keys');
    expect(lines[1]).toContain('whd-1');
    expect(lines[1]).toContain('order.paid');
    expect(lines[1]).toContain('orderId|total');
    expect(lines[2]).toContain('boom');
  });

  it('escapa campos com vírgulas', () => {
    const csv = buildCsv(
      [sample({ lastError: 'erro, com vírgula' })],
      [{ key: 'lastError', label: 'last_error', map: (d) => d.lastError ?? '' }],
    );
    expect(csv).toContain('"erro, com vírgula"');
  });

  it('aceita lastResponseStatus undefined', () => {
    const csv = buildCsv(
      [sample({ lastResponseStatus: undefined })],
      [
        {
          key: 'lastResponseStatus',
          label: 'last_status',
          map: (d) => d.lastResponseStatus ?? '',
        },
      ],
    );
    const lines = csv.replace(/^﻿/, '').split('\r\n');
    expect(lines[1]).toBe('');
  });

  it('trunca lastError em 500 chars', () => {
    const long = 'x'.repeat(800);
    const csv = buildCsv(
      [sample({ lastError: long })],
      [
        {
          key: 'lastError',
          label: 'last_error',
          map: (d) => (d.lastError ?? '').slice(0, 500),
        },
      ],
    );
    const data = csv.replace(/^﻿/, '').split('\r\n')[1];
    expect(data.length).toBeLessThanOrEqual(500);
  });
});

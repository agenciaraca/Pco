// Test do CSV export de messaging-log via buildCsv (sprint 560).

import { describe, it, expect } from 'vitest';
import { buildCsv } from '../server/export/csv';
import type { MessagingLogEntry } from '../server/messaging/log-store';

const sample: MessagingLogEntry[] = [
  {
    id: 'msg-1',
    ts: '2026-05-08T10:00:00.000Z',
    provider: 'twilio',
    to: '+5511999999999',
    body: 'Olá, sua matrícula foi confirmada.',
    tag: 'enrollment',
    status: 'sent',
    externalId: 'SM123abc',
  },
  {
    id: 'msg-2',
    ts: '2026-05-08T10:01:00.000Z',
    provider: 'mock',
    to: '+5511888888888',
    body: 'erro de envio aqui',
    status: 'failed',
    error: 'TWILIO_FAILED: HTTP 401',
  },
];

describe('messaging log CSV export', () => {
  it('serializa colunas com BOM + escape', () => {
    const csv = buildCsv(sample, [
      { key: 'id', label: 'id' },
      { key: 'provider', label: 'provider' },
      { key: 'to', label: 'to' },
      { key: 'status', label: 'status' },
      { key: 'externalId', label: 'external_id', map: (e) => e.externalId ?? '' },
      { key: 'tag', label: 'tag', map: (e) => e.tag ?? '' },
      { key: 'body', label: 'body_preview', map: (e) => e.body.slice(0, 80) },
      { key: 'error', label: 'error', map: (e) => (e.error ?? '').slice(0, 200) },
    ]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.replace(/^﻿/, '').split('\r\n');
    expect(lines[0]).toBe('id,provider,to,status,external_id,tag,body_preview,error');
    expect(lines[1]).toContain('msg-1');
    expect(lines[1]).toContain('twilio');
    expect(lines[1]).toContain('+5511999999999');
    expect(lines[1]).toContain('SM123abc');
    expect(lines[1]).toContain('enrollment');
    expect(lines[2]).toContain('msg-2');
    expect(lines[2]).toContain('TWILIO_FAILED');
  });

  it('handle externalId/tag/error undefined', () => {
    const csv = buildCsv(
      [{ ...sample[0], externalId: undefined, tag: undefined, error: undefined }],
      [
        { key: 'externalId', label: 'eid', map: (e) => e.externalId ?? '' },
        { key: 'tag', label: 'tag', map: (e) => e.tag ?? '' },
        { key: 'error', label: 'err', map: (e) => (e.error ?? '').slice(0, 200) },
      ],
    );
    const data = csv.replace(/^﻿/, '').split('\r\n')[1];
    expect(data).toBe(',,');
  });

  it('body preview limita 80 chars', () => {
    const long = 'x'.repeat(200);
    const csv = buildCsv(
      [{ ...sample[0], body: long }],
      [{ key: 'body', label: 'body', map: (e) => e.body.slice(0, 80) }],
    );
    const data = csv.replace(/^﻿/, '').split('\r\n')[1];
    expect(data.length).toBe(80);
  });
});

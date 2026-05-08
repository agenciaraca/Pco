// Tests do cliente S3 (mock fetch).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { putObject, s3CredsFromEnv } from '../server/aws/s3';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.S3_BUCKET;
  delete process.env.S3_REGION;
  delete process.env.S3_ACCESS_KEY_ID;
  delete process.env.S3_SECRET_ACCESS_KEY;
  delete process.env.S3_BACKUP_PREFIX;
});

const baseCreds = {
  accessKeyId: 'AKIAFAKE',
  secretAccessKey: 'fakesecret',
  region: 'us-east-1',
  bucket: 'test-bucket',
};

describe('s3.putObject', () => {
  it('faz PUT virtual-hosted style com SigV4', async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response('', { status: 200, headers: { etag: '"abc"' } }),
    );
    const r = await putObject(baseCreds, {
      key: 'backups/2026-05-08/users.json',
      body: '{"x":1}',
      contentType: 'application/json',
    });
    expect(r.ok).toBe(true);
    expect(r.status).toBe(200);
    expect(r.etag).toBe('"abc"');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      'https://test-bucket.s3.us-east-1.amazonaws.com/backups/2026-05-08/users.json',
    );
    expect((init as RequestInit).method).toBe('PUT');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toMatch(/^AWS4-HMAC-SHA256 /);
    expect(headers.Authorization).toContain('/s3/aws4_request');
    expect(headers['content-type']).toBe('application/json');
  });

  it('aceita Buffer como body', async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(new Response('', { status: 200 }));
    const r = await putObject(baseCreds, {
      key: 'k',
      body: Buffer.from('hello'),
    });
    expect(r.ok).toBe(true);
    expect((fetchMock.mock.calls[0][1] as RequestInit).body).toBeInstanceOf(
      Uint8Array,
    );
  });

  it('inclui x-amz-acl quando passado', async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(new Response('', { status: 200 }));
    await putObject(baseCreds, { key: 'k', body: 'x', acl: 'public-read' });
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<
      string,
      string
    >;
    expect(headers['x-amz-acl']).toBe('public-read');
    expect(headers.Authorization).toContain('x-amz-acl');
  });

  it('aceita endpoint custom (LocalStack/MinIO)', async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(new Response('', { status: 200 }));
    await putObject(baseCreds, {
      key: 'k',
      body: 'x',
      endpoint: 'http://localhost:9000/test-bucket',
    });
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('http://localhost:9000/k');
  });

  it('retorna ok=false em HTTP 403', async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response('AccessDenied', { status: 403 }),
    );
    const r = await putObject(baseCreds, { key: 'k', body: 'x' });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(403);
    expect(r.message).toContain('AccessDenied');
  });

  it('chave com leading slash é normalizada', async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(new Response('', { status: 200 }));
    await putObject(baseCreds, { key: '/no-leading', body: 'x' });
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      'https://test-bucket.s3.us-east-1.amazonaws.com/no-leading',
    );
  });
});

describe('s3CredsFromEnv', () => {
  it('retorna null sem qualquer var', () => {
    expect(s3CredsFromEnv()).toBeNull();
  });

  it('retorna null com vars parciais', () => {
    process.env.S3_BUCKET = 'b';
    process.env.S3_REGION = 'r';
    expect(s3CredsFromEnv()).toBeNull();
  });

  it('retorna creds com 4 vars', () => {
    process.env.S3_BUCKET = 'mybucket';
    process.env.S3_REGION = 'eu-west-1';
    process.env.S3_ACCESS_KEY_ID = 'AKIA1';
    process.env.S3_SECRET_ACCESS_KEY = 'sec1';
    expect(s3CredsFromEnv()).toEqual({
      bucket: 'mybucket',
      region: 'eu-west-1',
      accessKeyId: 'AKIA1',
      secretAccessKey: 'sec1',
    });
  });
});

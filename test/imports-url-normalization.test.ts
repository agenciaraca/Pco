import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let connections: typeof import('../server/imports/connections-store');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-conn-norm-'));
  process.env.DATA_DIR = tmpDir;
  connections = await import('../server/imports/connections-store');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

beforeEach(async () => {
  await connections._resetForTests();
});

describe('connections-store — normalização de siteUrl', () => {
  it('strip de barra final', async () => {
    const c = await connections.createConnection({
      name: 'a',
      siteUrl: 'https://site.com/',
      wpUsername: 'u',
      wpAppPassword: 'p',
    });
    expect(c.siteUrl).toBe('https://site.com');
  });

  it('strip de /wp-json com barra', async () => {
    const c = await connections.createConnection({
      name: 'a',
      siteUrl: 'https://site.com/wp-json/',
      wpUsername: 'u',
      wpAppPassword: 'p',
    });
    expect(c.siteUrl).toBe('https://site.com');
  });

  it('strip de /wp-json sem barra', async () => {
    const c = await connections.createConnection({
      name: 'a',
      siteUrl: 'https://site.com/wp-json',
      wpUsername: 'u',
      wpAppPassword: 'p',
    });
    expect(c.siteUrl).toBe('https://site.com');
  });

  it('preserva subpath', async () => {
    const c = await connections.createConnection({
      name: 'a',
      siteUrl: 'https://site.com/blog',
      wpUsername: 'u',
      wpAppPassword: 'p',
    });
    expect(c.siteUrl).toBe('https://site.com/blog');
  });

  it('strip de /wp-json em subpath', async () => {
    const c = await connections.createConnection({
      name: 'a',
      siteUrl: 'https://site.com/blog/wp-json',
      wpUsername: 'u',
      wpAppPassword: 'p',
    });
    expect(c.siteUrl).toBe('https://site.com/blog');
  });

  it('adiciona https quando faltando', async () => {
    const c = await connections.createConnection({
      name: 'a',
      siteUrl: 'site.com/wp-json',
      wpUsername: 'u',
      wpAppPassword: 'p',
    });
    expect(c.siteUrl).toBe('https://site.com');
  });

  it('preserva http quando explícito', async () => {
    const c = await connections.createConnection({
      name: 'a',
      siteUrl: 'http://localhost:8080/wp-json/',
      wpUsername: 'u',
      wpAppPassword: 'p',
    });
    expect(c.siteUrl).toBe('http://localhost:8080');
  });

  it('case-insensitive em /WP-JSON', async () => {
    const c = await connections.createConnection({
      name: 'a',
      siteUrl: 'https://site.com/WP-JSON',
      wpUsername: 'u',
      wpAppPassword: 'p',
    });
    expect(c.siteUrl).toBe('https://site.com');
  });
});

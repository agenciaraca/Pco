import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let zoom: typeof import('../server/live-sessions/zoom-config');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-zoom-'));
  process.env.DATA_DIR = tmpDir;
  process.env.AI_KEY_ENCRYPTION_SECRET = 'b'.repeat(64);
  zoom = await import('../server/live-sessions/zoom-config');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('zoom-config', () => {
  it('getConfig retorna null quando não configurado', async () => {
    const cfg = await zoom.getConfig();
    expect(cfg).toBeNull();
  });

  it('setConfig persiste sdkKey e encrypta sdkSecret', async () => {
    const cfg = await zoom.setConfig({
      sdkKey: 'test-sdk-key',
      sdkSecret: 'test-sdk-secret-123',
    });
    expect(cfg.sdkKey).toBe('test-sdk-key');
    expect(cfg.sdkSecretEncrypted).not.toBe('test-sdk-secret-123');
    expect(cfg.sdkSecretEncrypted.length).toBeGreaterThan(10);
    expect(cfg.enabled).toBe(true);
  });

  it('getConfig retorna config persistida', async () => {
    const cfg = await zoom.getConfig();
    expect(cfg).not.toBeNull();
    expect(cfg!.sdkKey).toBe('test-sdk-key');
    expect(cfg!.enabled).toBe(true);
  });

  it('getPublicConfig não expõe sdkSecret', () => {
    const pub = zoom.getPublicConfig({
      sdkKey: 'key',
      sdkSecretEncrypted: 'enc',
      enabled: true,
      updatedAt: new Date().toISOString(),
    });
    expect(pub.sdkKey).toBe('key');
    expect(pub.hasSecret).toBe(true);
    expect((pub as Record<string, unknown>).sdkSecretEncrypted).toBeUndefined();
  });

  it('generateSignature produz JWT válido com 3 partes', async () => {
    const cfg = await zoom.getConfig();
    expect(cfg).not.toBeNull();
    const sig = zoom.generateSignature(
      cfg!.sdkKey,
      cfg!.sdkSecretEncrypted,
      '1234567890',
      0,
    );
    const parts = sig.split('.');
    expect(parts.length).toBe(3);
    const header = JSON.parse(
      Buffer.from(parts[0], 'base64url').toString(),
    );
    expect(header.alg).toBe('HS256');
    expect(header.typ).toBe('JWT');
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString(),
    );
    expect(payload.mn).toBe('1234567890');
    expect(payload.role).toBe(0);
    expect(payload.sdkKey).toBe(cfg!.sdkKey);
  });

  it('disable desativa config', async () => {
    await zoom.disable();
    const cfg = await zoom.getConfig();
    expect(cfg).not.toBeNull();
    expect(cfg!.enabled).toBe(false);
  });
});

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * `google-ads-config.setConfig()` fazia `getAll()` (via `getConfig()`) e só
 * depois `setAll([cfg])` — a mesma janela de leitura-seguida-de-escrita que
 * este projeto já documentou e corrigiu em oito outros lugares (8/set/2026,
 * ver `test/config-de-uma-linha-perde-escrita.test.ts`). Entre o `await
 * getConfig()` e o `await store.setAll(...)` cabe uma escrita concorrente de
 * `patchConfig()` — chamado pelo teste de conexão e pelos dois crons
 * (Customer Match, Conversões Offline) para gravar `lastTestedAt`/
 * `lastCustomerMatchAt` — e ela some sem erro.
 *
 * Achado em 12/set/2026, numa varredura autônoma sobre o próprio código
 * escrito nesta sessão.
 */

let tmpDir: string;

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-gads-cfg-'));
  process.env.DATA_DIR = tmpDir;
  process.env.AI_KEY_ENCRYPTION_SECRET = 'a'.repeat(64);
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('google-ads-config: setConfig não apaga escrita concorrente de patchConfig', () => {
  it('trocar a credencial e gravar o resultado do teste de conexão ao mesmo tempo não se apagam', async () => {
    const { setConfig, patchConfig, getConfig } = await import(
      '../server/marketing/google-ads-config'
    );

    await setConfig({
      developerToken: 'dev-token-1',
      clientId: 'client-1',
      clientSecret: 'secret-1',
      refreshToken: 'refresh-1',
      customerId: '111-111-1111',
    });

    await Promise.all([
      setConfig({
        developerToken: 'dev-token-2',
        clientId: 'client-2',
        clientSecret: 'secret-2',
        refreshToken: 'refresh-2',
        customerId: '222-222-2222',
      }),
      patchConfig({ lastTestedAt: '2026-09-12T10:00:00.000Z', lastTestStatus: 'ok', lastTestMessage: 'Conectado: Conta X' }),
    ]);

    const final = await getConfig();
    // Com `getAll` + `setAll`, o segundo dos dois a gravar apagava o campo
    // que o outro tinha acabado de escrever — sem erro nenhum.
    expect(final!.customerId).toBe('2222222222');
    expect(final!.lastTestStatus).toBe('ok');
    expect(final!.lastTestMessage).toBe('Conectado: Conta X');
  });

  it('trocar a credencial preserva o `conversionActionResourceName` já resolvido', async () => {
    const { patchConfig, setConfig, getConfig } = await import(
      '../server/marketing/google-ads-config'
    );
    await patchConfig({ conversionActionResourceName: 'customers/123/conversionActions/456' });
    await setConfig({
      developerToken: 'dev-token-3',
      clientId: 'client-3',
      clientSecret: 'secret-3',
      refreshToken: 'refresh-3',
      customerId: '333-333-3333',
    });
    const final = await getConfig();
    expect(final!.conversionActionResourceName).toBe('customers/123/conversionActions/456');
  });
});

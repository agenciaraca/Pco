// Credenciais da conta de Google Ads da PCO — mesmo padrão do Zoom SDK
// (`server/live-sessions/zoom-config.ts`): um único registro, campos sensíveis
// cifrados com `encryptApiKey` (AES-GCM, chave em `AI_KEY_ENCRYPTION_SECRET`),
// persistido em `data/google-ads-config.json` via `JsonStore` — sobrevive a
// `pm2 restart` porque a escrita é atômica (ver o comentário no topo de
// `db/json-store.ts`).
//
// Duas coisas saem daqui, cada uma com sua própria cadência (ver
// `google-ads-customer-match.ts` e `google-ads-offline-conversions.ts`):
//   1. Customer Match — lista de e-mail/telefone hasheado, mensal.
//   2. Conversões offline — clique (gclid) + venda paga, diário.
// As duas são coisas DIFERENTES que o Google recebe: uma diz "essa pessoa já é
// cliente" (público-alvo), a outra diz "esse clique virou venda" (atribuição).

import crypto from 'node:crypto';
import { JsonStore } from '../db/json-store';
import { encryptApiKey, decryptApiKey } from '../db/encryption';

export interface GoogleAdsConfig {
  /** Token do desenvolvedor da conta MCC/standalone (Google Ads API Center). */
  developerTokenEncrypted: string;
  /** Client ID do app OAuth (Google Cloud Console). */
  clientId: string;
  /** Client Secret do app OAuth. */
  clientSecretEncrypted: string;
  /** Refresh token de uma conta com acesso à conta de Ads (obtido 1x via OAuth). */
  refreshTokenEncrypted: string;
  /** ID da conta de Ads que recebe os envios (só dígitos, sem hífen). */
  customerId: string;
  /** ID da conta de login/MCC, se a `customerId` for gerenciada por uma. */
  loginCustomerId?: string;
  /**
   * Nome da ação de conversão que recebe o upload de cliques
   * (`customers/{cid}/conversionActions/{id}`, resolvido no teste de conexão
   * e guardado aqui pra não perguntar de novo a cada rodada).
   */
  conversionActionResourceName?: string;
  /** Nome da lista de público (`customers/{cid}/userLists/{id}`) do Customer Match. */
  customerMatchUserListResourceName?: string;
  enabled: boolean;
  updatedAt: string;
  lastCustomerMatchAt?: string;
  lastCustomerMatchCount?: number;
  lastOfflineConversionsAt?: string;
  lastOfflineConversionsCount?: number;
  lastTestedAt?: string;
  lastTestStatus?: 'ok' | 'error';
  lastTestMessage?: string;
}

const store = new JsonStore<GoogleAdsConfig>('google-ads-config.json', () => []);

export async function getConfig(): Promise<GoogleAdsConfig | null> {
  const all = await store.getAll();
  return all[0] ?? null;
}

/** Versão com os segredos já descriptografados — só para uso interno (nunca sai pela API). */
export async function getDecryptedConfig(): Promise<
  (GoogleAdsConfig & { developerToken: string; clientSecret: string; refreshToken: string }) | null
> {
  const cfg = await getConfig();
  if (!cfg) return null;
  return {
    ...cfg,
    developerToken: decryptApiKey(cfg.developerTokenEncrypted),
    clientSecret: decryptApiKey(cfg.clientSecretEncrypted),
    refreshToken: decryptApiKey(cfg.refreshTokenEncrypted),
  };
}

/*
  `getAll()` seguido de `setAll()` tem a mesma janela que este projeto já
  documentou e corrigiu em oito outros lugares (8/set/2026): entre ler `prev`
  e gravar `[cfg]` há um `await` (o próprio `getConfig()`), e qualquer escrita
  concorrente nesse intervalo — o teste de conexão ou um cron gravando
  `lastTestedAt`/`lastCustomerMatchAt` via `patchConfig()` — some sem erro.
  `store.modify()` já existe exatamente para isto: lê e grava sob a mesma
  fila de escrita, sem a janela.
*/
export async function setConfig(input: {
  developerToken: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  customerId: string;
  loginCustomerId?: string;
}): Promise<GoogleAdsConfig> {
  const now = new Date().toISOString();
  return store.modify((items) => {
    const prev = items[0];
    const cfg: GoogleAdsConfig = {
      developerTokenEncrypted: encryptApiKey(input.developerToken),
      clientId: input.clientId,
      clientSecretEncrypted: encryptApiKey(input.clientSecret),
      refreshTokenEncrypted: encryptApiKey(input.refreshToken),
      customerId: input.customerId.replace(/\D/g, ''),
      loginCustomerId: input.loginCustomerId?.replace(/\D/g, '') || undefined,
      conversionActionResourceName: prev?.conversionActionResourceName,
      customerMatchUserListResourceName: prev?.customerMatchUserListResourceName,
      enabled: true,
      updatedAt: now,
    };
    items.length = 0;
    items.push(cfg);
    return cfg;
  });
}

export async function patchConfig(patch: Partial<GoogleAdsConfig>): Promise<void> {
  await store.modify((items) => {
    const cfg = items[0];
    if (!cfg) return;
    Object.assign(cfg, patch, { updatedAt: new Date().toISOString() });
  });
}

export function getPublicConfig(cfg: GoogleAdsConfig): {
  clientId: string;
  customerId: string;
  loginCustomerId?: string;
  enabled: boolean;
  hasDeveloperToken: boolean;
  hasClientSecret: boolean;
  hasRefreshToken: boolean;
  conversionActionResourceName?: string;
  customerMatchUserListResourceName?: string;
  lastCustomerMatchAt?: string;
  lastCustomerMatchCount?: number;
  lastOfflineConversionsAt?: string;
  lastOfflineConversionsCount?: number;
  lastTestedAt?: string;
  lastTestStatus?: 'ok' | 'error';
  lastTestMessage?: string;
} {
  return {
    clientId: cfg.clientId,
    customerId: cfg.customerId,
    loginCustomerId: cfg.loginCustomerId,
    enabled: cfg.enabled,
    hasDeveloperToken: !!cfg.developerTokenEncrypted,
    hasClientSecret: !!cfg.clientSecretEncrypted,
    hasRefreshToken: !!cfg.refreshTokenEncrypted,
    conversionActionResourceName: cfg.conversionActionResourceName,
    customerMatchUserListResourceName: cfg.customerMatchUserListResourceName,
    lastCustomerMatchAt: cfg.lastCustomerMatchAt,
    lastCustomerMatchCount: cfg.lastCustomerMatchCount,
    lastOfflineConversionsAt: cfg.lastOfflineConversionsAt,
    lastOfflineConversionsCount: cfg.lastOfflineConversionsCount,
    lastTestedAt: cfg.lastTestedAt,
    lastTestStatus: cfg.lastTestStatus,
    lastTestMessage: cfg.lastTestMessage,
  };
}

/** Só pra dar um id estável a jobs/logs — não é chave de nada. */
export function shortId(): string {
  return crypto.randomBytes(4).toString('hex');
}

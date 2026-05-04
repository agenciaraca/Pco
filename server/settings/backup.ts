// Backup/restore das configurações do AVA.
// Inclui: gateways, products, coupons, email-configs, webhook-endpoints,
// reengagement-config, login-config, app-settings, ai-configs, import-connections.
// NÃO inclui: users, audit-log, errors, notifications, orders, sessions.
//
// Tudo armazenado encriptado já vem encriptado nos arquivos JSON, então o
// backup é um JSON cru. O restore aceita o mesmo formato.

import { promises as fs } from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data');

export const BACKUP_FILES = [
  'payment-gateways.json',
  'products.json',
  'coupons.json',
  'email-configs.json',
  'webhook-endpoints.json',
  'reengagement-config.json',
  'login-config.json',
  'app-settings.json',
  'ai-configs.json',
  'import-connections.json',
  'api-tokens.json',
] as const;

export interface BackupFileEntry {
  file: string;
  exists: boolean;
  data: unknown;
}

export interface SettingsBackup {
  version: 1;
  createdAt: string;
  files: BackupFileEntry[];
}

export async function exportBackup(): Promise<SettingsBackup> {
  const files: BackupFileEntry[] = [];
  for (const file of BACKUP_FILES) {
    const full = path.join(DATA_DIR, file);
    try {
      const raw = await fs.readFile(full, 'utf8');
      const data = raw.trim() ? JSON.parse(raw) : null;
      files.push({ file, exists: true, data });
    } catch {
      files.push({ file, exists: false, data: null });
    }
  }
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    files,
  };
}

export interface RestoreResult {
  restored: string[];
  skipped: Array<{ file: string; reason: string }>;
  dryRun: boolean;
}

/**
 * Sobrescreve os arquivos do backup. Em dryRun, só valida.
 * Por segurança, ignora arquivos não-listados em BACKUP_FILES.
 */
export async function restoreBackup(
  payload: SettingsBackup,
  opts: { dryRun?: boolean } = {},
): Promise<RestoreResult> {
  if (!payload || payload.version !== 1 || !Array.isArray(payload.files)) {
    throw new Error('Backup inválido: version != 1 ou faltando files[]');
  }
  const restored: string[] = [];
  const skipped: Array<{ file: string; reason: string }> = [];
  await fs.mkdir(DATA_DIR, { recursive: true });

  for (const entry of payload.files) {
    if (!BACKUP_FILES.includes(entry.file as (typeof BACKUP_FILES)[number])) {
      skipped.push({ file: entry.file, reason: 'arquivo não permitido no backup' });
      continue;
    }
    if (!entry.exists || entry.data === null || entry.data === undefined) {
      skipped.push({ file: entry.file, reason: 'sem dados (vazio)' });
      continue;
    }
    if (opts.dryRun) {
      restored.push(entry.file);
      continue;
    }
    const full = path.join(DATA_DIR, entry.file);
    await fs.writeFile(
      full,
      JSON.stringify(entry.data, null, 2) + '\n',
      { mode: 0o600 },
    );
    restored.push(entry.file);
  }

  return { restored, skipped, dryRun: !!opts.dryRun };
}

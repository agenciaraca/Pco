// Sync de backups locais para S3 (env-gated por S3_BUCKET/REGION/KEYS).
//
// Estratégia: depois do runBackup local criar data/backups/YYYY-MM-DD/,
// sobe cada *.json individualmente como
//   {S3_PREFIX}/{date}/{filename}
// Ausencia de S3_BUCKET = no-op silencioso.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { putObject, s3CredsFromEnv } from '../aws/s3';

export interface S3UploadResult {
  enabled: boolean;
  uploaded: number;
  failed: number;
  bytesTotal: number;
  errors: string[];
}

function s3Prefix(): string {
  return (process.env.S3_BACKUP_PREFIX ?? 'ava-pco-backups').replace(
    /^\/+|\/+$/g,
    '',
  );
}

/**
 * Sobe os arquivos *.json do snapshot local para S3.
 * @param snapshotDir Diretório local data/backups/YYYY-MM-DD/.
 * @param date YYYY-MM-DD usado como subkey.
 */
export async function uploadSnapshotToS3(
  snapshotDir: string,
  date: string,
): Promise<S3UploadResult> {
  const creds = s3CredsFromEnv();
  if (!creds) {
    return { enabled: false, uploaded: 0, failed: 0, bytesTotal: 0, errors: [] };
  }
  const errors: string[] = [];
  let uploaded = 0;
  let failed = 0;
  let bytesTotal = 0;
  let entries: string[];
  try {
    entries = await fs.readdir(snapshotDir);
  } catch (err) {
    return {
      enabled: true,
      uploaded: 0,
      failed: 0,
      bytesTotal: 0,
      errors: [`readdir falhou: ${err instanceof Error ? err.message : String(err)}`],
    };
  }
  const prefix = s3Prefix();
  for (const name of entries) {
    if (!name.endsWith('.json')) continue;
    const src = path.join(snapshotDir, name);
    let buf: Buffer;
    try {
      buf = await fs.readFile(src);
    } catch (err) {
      errors.push(
        `${name} read: ${err instanceof Error ? err.message : String(err)}`,
      );
      failed++;
      continue;
    }
    const key = `${prefix}/${date}/${name}`;
    try {
      const r = await putObject(creds, {
        key,
        body: buf,
        contentType: 'application/json',
      });
      if (r.ok) {
        uploaded++;
        bytesTotal += buf.byteLength;
      } else {
        failed++;
        errors.push(`${name}: HTTP ${r.status} ${r.message ?? ''}`.trim());
      }
    } catch (err) {
      failed++;
      errors.push(
        `${name} put: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  return { enabled: true, uploaded, failed, bytesTotal, errors };
}

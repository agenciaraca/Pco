// Sync de backups locais para S3 (env-gated por S3_BUCKET/REGION/KEYS).
//
// Estratégia: depois do runBackup local criar data/backups/YYYY-MM-DD/,
// sobe cada *.json individualmente como
//   {S3_PREFIX}/{date}/{filename}
// Ausencia de S3_BUCKET = no-op silencioso.
//
// ## Este módulo NÃO apaga nada, e isso é decisão de segurança
//
// O bucket cresce para sempre — a auditoria registrou isso como pendência
// ("o S3 não tem lifecycle"), e a leitura de que faltava código aqui está
// errada. **Quem sobe backup não pode ter permissão de apagar backup.** Uma
// credencial de escrita comprometida que também apague transforma um incidente
// em perda total: o atacante criptografa a base e limpa as cópias.
//
// A retenção pertence ao **lifecycle do bucket**, configurado no provedor:
//
//   - regra por prefixo (`ava-pco-backups/`), expirando objetos com N dias;
//   - versionamento ligado + MFA delete, se o provedor oferecer;
//   - a credencial daqui com `s3:PutObject` e **sem** `s3:DeleteObject`.
//
// Enquanto a regra não existir, o custo cresce e nada se perde — que é o lado
// certo para errar. Ver `docs/deploy.md`, seção "Backup e restore".
//
// O que sobe carrega **hash de senha e colunas cifradas** (chaves de gateway,
// segredos de webhook, sementes de TOTP). O que é cifrado usa chave derivada de
// `AI_KEY_ENCRYPTION_SECRET`, que vive no ambiente e **não** entra no despejo —
// mas o bucket merece o mesmo cuidado do banco, e a credencial dele também.

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

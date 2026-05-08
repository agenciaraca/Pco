// Cliente S3 minimo — apenas PutObject. Reusa SigV4 do server/aws/sigv4.
// Sem aws-sdk: faz POST/PUT direto via fetch.

import { signSigV4 } from './sigv4';

export interface S3Creds {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  /** virtual-hosted style por padrao. */
  bucket: string;
}

export interface PutObjectInput {
  key: string;
  body: Buffer | string;
  contentType?: string;
  acl?: 'private' | 'public-read';
  /** Override endpoint (para LocalStack/MinIO). */
  endpoint?: string;
}

export interface PutObjectResult {
  ok: boolean;
  status: number;
  etag?: string;
  message?: string;
}

function endpointFor(creds: S3Creds, override?: string): string {
  if (override) return override;
  // virtual-hosted-style: <bucket>.s3.<region>.amazonaws.com
  return `https://${creds.bucket}.s3.${creds.region}.amazonaws.com`;
}

export async function putObject(
  creds: S3Creds,
  input: PutObjectInput,
): Promise<PutObjectResult> {
  const ep = new URL(endpointFor(creds, input.endpoint));
  const path = `/${input.key.replace(/^\//, '')}`;
  const body = input.body;
  const contentType = input.contentType ?? 'application/octet-stream';
  const extra: Record<string, string> = { 'content-type': contentType };
  if (input.acl) extra['x-amz-acl'] = input.acl;

  const signed = signSigV4({
    method: 'PUT',
    host: ep.host,
    path,
    body: typeof body === 'string' ? body : body.toString('binary'),
    region: creds.region,
    service: 's3',
    accessKeyId: creds.accessKeyId,
    secretAccessKey: creds.secretAccessKey,
    extraHeaders: extra,
  });
  const res = await fetch(`${ep.origin}${path}`, {
    method: 'PUT',
    headers: signed.headers,
    body: typeof body === 'string' ? body : new Uint8Array(body),
  });
  const etag = res.headers.get('etag') ?? undefined;
  if (res.ok) return { ok: true, status: res.status, etag };
  const text = await res.text().catch(() => '');
  return {
    ok: false,
    status: res.status,
    message: text.slice(0, 500),
  };
}

/** Le S3_* env vars e retorna creds, ou null se ausente. */
export function s3CredsFromEnv(): S3Creds | null {
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const region = process.env.S3_REGION;
  const bucket = process.env.S3_BUCKET;
  if (!accessKeyId || !secretAccessKey || !region || !bucket) return null;
  return { accessKeyId, secretAccessKey, region, bucket };
}

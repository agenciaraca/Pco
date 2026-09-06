// Upload de arquivos. Por padrão grava local em data/uploads/<random>.<ext>
// e devolve `/uploads/<filename>`. Se S3_BUCKET (+ S3_UPLOADS_PREFIX e
// S3_PUBLIC_URL) estiverem definidos, faz upload pro S3/R2 e devolve
// URL pública absoluta. Fallback local sempre funciona.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { putObject, s3CredsFromEnv } from '../aws/s3';

const DATA_DIR = process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

/**
 * O que qualquer pessoa logada pode subir: imagem, e só.
 *
 * `POST /uploads` é `requireAuth()`, não `requireAuth('admin')` — todo aluno
 * alcança. Imagem serve para avatar e é o caso de uso que justifica isso.
 */
const MIME_DE_IMAGEM: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

/**
 * O que **só a administração** pode subir: material da biblioteca.
 *
 * Separado de propósito. Liberar PDF na rota aberta deixaria qualquer aluno
 * hospedar arquivo no domínio da escola — e arquivo hospedado em domínio de
 * escola é exatamente o que golpe de phishing procura. Aqui a biblioteca ganha
 * o que precisa sem abrir essa porta.
 *
 * SVG fica de fora, e não por esquecimento: SVG é documento que executa script,
 * servido da mesma origem.
 */
const MIME_DE_DOCUMENTO: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/epub+zip': '.epub',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
};

export function ehTipoDeDocumento(mime: string): boolean {
  return mime in MIME_DE_DOCUMENTO;
}

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
/** Material da biblioteca é maior que avatar: PDF de apostila passa dos 5MB. */
const MAX_SIZE_DOCUMENTO = 50 * 1024 * 1024;

export interface UploadResult {
  url: string;
  filename: string;
  size: number;
  mime: string;
}

export class UploadError extends Error {
  status: number;
  code: string;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/**
 * @param permiteDocumento libera PDF/EPUB/áudio. **Só para a administração** —
 * a rota decide, não o cliente.
 */
export async function saveUpload(
  file: File,
  opts: { permiteDocumento?: boolean } = {},
): Promise<UploadResult> {
  const permitidos = opts.permiteDocumento
    ? { ...MIME_DE_IMAGEM, ...MIME_DE_DOCUMENTO }
    : MIME_DE_IMAGEM;
  const limite = opts.permiteDocumento ? MAX_SIZE_DOCUMENTO : MAX_SIZE;
  if (file.size > limite) {
    throw new UploadError(
      'FILE_TOO_LARGE',
      `Arquivo excede o limite de ${Math.round(limite / 1024 / 1024)}MB.`,
    );
  }
  const mime = file.type;
  const ext = permitidos[mime];
  if (!ext) {
    throw new UploadError(
      'INVALID_MIME',
      opts.permiteDocumento
        ? 'Tipo não permitido. Use imagem, PDF, EPUB ou áudio (MP3/M4A).'
        : 'Tipo de arquivo não permitido. Use JPG, PNG, WEBP ou GIF.',
    );
  }
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  const id = crypto.randomBytes(12).toString('hex');
  const filename = `${id}${ext}`;
  const filepath = path.join(UPLOADS_DIR, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(filepath, buffer, { mode: 0o644 });

  // Tentativa de upload para S3/R2 se configurado. Mantém cópia local como
  // cache (e fallback se upload falhar). URL pública absoluta tem precedência.
  const s3Url = await tryUploadToS3(filename, buffer, mime);

  return {
    url: s3Url ?? `/uploads/${filename}`,
    filename,
    size: file.size,
    mime,
  };
}

/**
 * Tenta upload para S3/R2 quando S3_BUCKET + creds estão configurados.
 * Retorna URL pública absoluta (S3_PUBLIC_URL/{prefix}/{filename}) ou null
 * se S3 não configurado ou upload falhou. Não lança erro: silencioso.
 */
async function tryUploadToS3(
  filename: string,
  buffer: Buffer,
  mime: string,
): Promise<string | null> {
  const creds = s3CredsFromEnv();
  if (!creds) return null;
  const prefix = (process.env.S3_UPLOADS_PREFIX ?? 'uploads').replace(
    /^\/+|\/+$/g,
    '',
  );
  const key = `${prefix}/${filename}`;
  try {
    const r = await putObject(creds, {
      key,
      body: buffer,
      contentType: mime,
      acl: 'public-read',
    });
    if (!r.ok) return null;
  } catch {
    return null;
  }
  const publicBase = process.env.S3_PUBLIC_URL?.replace(/\/+$/, '');
  if (publicBase) return `${publicBase}/${key}`;
  // Fallback: tenta deduzir
  if (process.env.S3_ENDPOINT) {
    return `${process.env.S3_ENDPOINT.replace(/\/+$/, '')}/${creds.bucket}/${key}`;
  }
  return `https://${creds.bucket}.s3.${creds.region}.amazonaws.com/${key}`;
}

export function uploadsDir(): string {
  return UPLOADS_DIR;
}

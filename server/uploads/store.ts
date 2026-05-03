// Upload local — salva arquivos em data/uploads/<random>.<ext>.
// Servidos depois por /uploads/* (static handler em server/dev.ts).

import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DATA_DIR = process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

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

export async function saveUpload(file: File): Promise<UploadResult> {
  if (file.size > MAX_SIZE) {
    throw new UploadError(
      'FILE_TOO_LARGE',
      `Arquivo excede o limite de ${Math.round(MAX_SIZE / 1024 / 1024)}MB.`,
    );
  }
  const mime = file.type;
  const ext = ALLOWED_MIME[mime];
  if (!ext) {
    throw new UploadError(
      'INVALID_MIME',
      'Tipo de arquivo não permitido. Use JPG, PNG, WEBP ou GIF.',
    );
  }
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  const id = crypto.randomBytes(12).toString('hex');
  const filename = `${id}${ext}`;
  const filepath = path.join(UPLOADS_DIR, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(filepath, buffer, { mode: 0o644 });
  return {
    url: `/uploads/${filename}`,
    filename,
    size: file.size,
    mime,
  };
}

export function uploadsDir(): string {
  return UPLOADS_DIR;
}

// Global setup: roda antes do webServer subir + antes de qualquer test.
// Garante state determinístico: apaga data/users.json para forçar
// recriação com as senhas das env vars (INITIAL_*_PASSWORD).

import { promises as fs } from 'node:fs';
import path from 'node:path';

export default async function globalSetup() {
  const dataDir = process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data');
  const usersFile = path.join(dataDir, 'users.json');
  try {
    await fs.unlink(usersFile);
    console.log(`[e2e setup] users.json removido — sera recriado com INITIAL_*_PASSWORD`);
  } catch (e) {
    // Arquivo não existia — tudo bem
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn('[e2e setup] erro removendo users.json:', e);
    }
  }
}

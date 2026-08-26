// Global setup: roda antes do webServer subir + antes de qualquer test.
// Garante state determinístico.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  limparSessoesEmDisco,
  STUDENT_EMAIL,
  SUPERADMIN_EMAIL,
} from './helpers';

/**
 * Arquivos que os testes criam ou dependem, e que precisam voltar ao zero.
 *
 * `users.json` força a recriação com as senhas de `INITIAL_*_PASSWORD`.
 * Os demais existem porque teste que agenda deixa agendamento para trás: sem
 * limpar, a segunda execução tenta o mesmo horário e recebe HORARIO_OCUPADO —
 * falha que parece bug de produto e é só resíduo da rodada anterior.
 */
const DESCARTAVEIS = [
  'users.json',
  'session-bookings.json',
  'session-reminders.json',
  'access-expiry-notices.json',
];

export default async function globalSetup() {
  // As sessões em disco valem por execução: os usuários são recriados abaixo,
  // então token antigo apontaria para conta que não existe mais.
  await limparSessoesEmDisco([STUDENT_EMAIL, SUPERADMIN_EMAIL]);

  const dataDir = process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data');
  for (const nome of DESCARTAVEIS) {
    try {
      await fs.unlink(path.join(dataDir, nome));
      console.log(`[e2e setup] ${nome} removido`);
    } catch (e) {
      // Não existir é o caso normal — só reclama de erro de verdade.
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn(`[e2e setup] erro removendo ${nome}:`, e);
      }
    }
  }
}

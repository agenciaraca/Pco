/**
 * Upsert do superadmin no users.json. Idempotente.
 *
 * Uso: ADMIN_EMAIL=foo@bar.com ADMIN_PASSWORD='senha' npx tsx scripts/ensure_superadmin.ts
 *
 * Se o email já existe: atualiza role para 'superadmin' + reseta senha.
 * Se não existe: cria.
 *
 * Grava em data/users.json. Para subir pro VPS, rode sync_data_to_vps.py
 * em seguida (whitelist inclui users.json).
 */

import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.import' });

import * as usersStore from '../server/auth/users-store';

async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.error('uso: ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx scripts/ensure_superadmin.ts');
    process.exit(1);
  }

  await usersStore.loadUsers();

  const existing = await usersStore.findUserByEmail(email);
  if (existing) {
    console.log(`[ensure-superadmin] já existe: ${existing.email} (role atual: ${existing.role}, id: ${existing.id})`);
    if (existing.role !== 'superadmin') {
      await usersStore.updateUser(existing.id, { role: 'superadmin' });
      console.log(`[ensure-superadmin] role atualizada → superadmin`);
    }
    await usersStore.changePassword(existing.id, password);
    console.log(`[ensure-superadmin] senha atualizada`);
    return;
  }

  const created = await usersStore.createUser({
    email,
    name: email,
    role: 'superadmin',
    password,
    active: true,
  });
  console.log(`[ensure-superadmin] CRIADO: ${created.email} (id: ${created.id}, role: ${created.role})`);
}

main().catch((err) => {
  console.error('[ensure-superadmin] erro:', err);
  process.exit(1);
});

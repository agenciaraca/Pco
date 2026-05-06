// Store de usuários do sistema (logins) — persiste em JSON local.
// Quando plugarmos Postgres, a interface fica idêntica e migramos só o backend.

import bcrypt from 'bcryptjs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export type Role = 'student' | 'admin' | 'superadmin';

export interface SystemUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  passwordHash: string;
  tokenVersion: number;
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  active: boolean;
  // Documento (CPF/RG/passport) — opcional, normalizado (só dígitos para CPF/RG)
  document?: string | null;
  // 2FA TOTP
  totpEnabled?: boolean;
  totpSecretEncrypted?: string;
  // Códigos de backup — guardamos só os hashes (sha256)
  totpBackupCodes?: string[];
}

export interface SystemUserPublic {
  id: string;
  email: string;
  name: string;
  role: Role;
  tokenVersion: number;
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  active: boolean;
  document?: string | null;
  totpEnabled?: boolean;
}

const DATA_DIR = process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const BCRYPT_ROUNDS = 11;

let users: SystemUser[] = [];
let loaded = false;
let writeQueue: Promise<void> = Promise.resolve();

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

export function generatePassword(length = 16): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#%*-_+=';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

export function toPublic(u: SystemUser): SystemUserPublic {
  const {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    passwordHash,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    totpSecretEncrypted,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    totpBackupCodes,
    ...rest
  } = u;
  return rest;
}

async function persist(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2) + '\n', { mode: 0o600 });
}

function queueWrite(): Promise<void> {
  writeQueue = writeQueue.then(persist).catch((e) => {
    // eslint-disable-next-line no-console
    console.error('[users-store] persist failed:', e);
  });
  return writeQueue;
}

export async function loadUsers(): Promise<void> {
  if (loaded) return;
  try {
    const raw = await fs.readFile(USERS_FILE, 'utf8');
    const parsed = JSON.parse(raw) as SystemUser[];
    // Normaliza campos novos para registros antigos
    let needsRewrite = false;
    users = parsed.map((u) => {
      if (typeof u.tokenVersion !== 'number') {
        needsRewrite = true;
        return { ...u, tokenVersion: 0 };
      }
      return u;
    });
    if (needsRewrite) await persist();
    loaded = true;
    return;
  } catch {
    // arquivo não existe — vamos seedar
  }
  // Seed com 3 contas default
  const defaults: Array<{ email: string; name: string; role: Role; envPasswordVar: string }> = [
    {
      email: 'superadmin@pco.local',
      name: 'Superadmin',
      role: 'superadmin',
      envPasswordVar: 'INITIAL_SUPERADMIN_PASSWORD',
    },
    {
      email: 'admin@pco.local',
      name: 'Admin Demo',
      role: 'admin',
      envPasswordVar: 'INITIAL_ADMIN_PASSWORD',
    },
    {
      email: 'aluno@pco.local',
      name: 'Aluno Demo',
      role: 'student',
      envPasswordVar: 'INITIAL_STUDENT_PASSWORD',
    },
  ];
  const now = new Date().toISOString();
  const seeded: SystemUser[] = [];
  for (const d of defaults) {
    const password = process.env[d.envPasswordVar] ?? generatePassword(16);
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    seeded.push({
      id: newId(d.role.slice(0, 5)),
      email: d.email,
      name: d.name,
      role: d.role,
      passwordHash: hash,
      tokenVersion: 0,
      createdAt: now,
      updatedAt: now,
      active: true,
    });
    if (!process.env[d.envPasswordVar]) {
      // eslint-disable-next-line no-console
      console.log(`[users-store] SEED ${d.email}: ${password}`);
    }
  }
  users = seeded;
  await persist();
  loaded = true;
}

export async function listUsers(): Promise<SystemUserPublic[]> {
  await loadUsers();
  return users.map(toPublic);
}

export async function findUserById(id: string): Promise<SystemUserPublic | null> {
  await loadUsers();
  const u = users.find((x) => x.id === id);
  return u ? toPublic(u) : null;
}

export async function findUserByEmail(email: string): Promise<SystemUser | null> {
  await loadUsers();
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null;
}

/** Normaliza CPF/RG removendo pontuação. */
export function normalizeDocument(doc: string): string {
  return doc.replace(/\D/g, '');
}

export async function findUserByDocument(document: string): Promise<SystemUser | null> {
  await loadUsers();
  const norm = normalizeDocument(document);
  if (!norm) return null;
  return (
    users.find((u) => u.document && normalizeDocument(u.document) === norm) ?? null
  );
}

export async function verifyPassword(
  email: string,
  password: string,
): Promise<SystemUserPublic | null> {
  await loadUsers();
  const u = await findUserByEmail(email);
  if (!u || !u.active) return null;
  const ok = await bcrypt.compare(password, u.passwordHash);
  if (!ok) return null;
  u.lastLoginAt = new Date().toISOString();
  await queueWrite();
  return toPublic(u);
}

interface CreateInput {
  email: string;
  name: string;
  role: Role;
  password: string;
  active?: boolean;
  document?: string | null;
}

export async function createUser(input: CreateInput): Promise<SystemUserPublic> {
  await loadUsers();
  const existing = await findUserByEmail(input.email);
  if (existing) throw new Error('Já existe um usuário com este e-mail.');
  const hash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const now = new Date().toISOString();
  const u: SystemUser = {
    id: newId(input.role.slice(0, 5)),
    email: input.email,
    name: input.name,
    role: input.role,
    passwordHash: hash,
    tokenVersion: 0,
    createdAt: now,
    updatedAt: now,
    active: input.active ?? true,
    document: input.document ?? null,
  };
  users.push(u);
  await queueWrite();
  return toPublic(u);
}

interface UpdateInput {
  email?: string;
  name?: string;
  role?: Role;
  active?: boolean;
  avatarUrl?: string | null;
}

export async function updateUser(
  id: string,
  patch: UpdateInput,
): Promise<SystemUserPublic | null> {
  await loadUsers();
  const i = users.findIndex((u) => u.id === id);
  if (i === -1) return null;
  if (patch.email && patch.email !== users[i].email) {
    const conflict = await findUserByEmail(patch.email);
    if (conflict) throw new Error('Já existe um usuário com este e-mail.');
  }
  // Desativar conta também invalida tokens vivos
  const willDeactivate =
    patch.active === false && users[i].active === true;
  users[i] = {
    ...users[i],
    ...(patch.email !== undefined ? { email: patch.email } : {}),
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.role !== undefined ? { role: patch.role } : {}),
    ...(patch.active !== undefined ? { active: patch.active } : {}),
    ...(patch.avatarUrl !== undefined ? { avatarUrl: patch.avatarUrl } : {}),
    ...(willDeactivate ? { tokenVersion: (users[i].tokenVersion ?? 0) + 1 } : {}),
    updatedAt: new Date().toISOString(),
  };
  await queueWrite();
  return toPublic(users[i]);
}

/**
 * Self-service: troca senha exigindo senha atual correta.
 * Bumpa tokenVersion (invalida todos tokens — força re-login em outros devices).
 * Retorna 'ok' | 'wrong-password' | 'not-found'.
 */
export async function verifyAndChangePassword(
  id: string,
  currentPassword: string,
  newPassword: string,
): Promise<'ok' | 'wrong-password' | 'not-found'> {
  await loadUsers();
  const i = users.findIndex((u) => u.id === id);
  if (i === -1) return 'not-found';
  const ok = await bcrypt.compare(currentPassword, users[i].passwordHash);
  if (!ok) return 'wrong-password';
  users[i].passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  users[i].tokenVersion = (users[i].tokenVersion ?? 0) + 1;
  users[i].updatedAt = new Date().toISOString();
  await queueWrite();
  return 'ok';
}

export async function changePassword(id: string, newPassword: string): Promise<boolean> {
  await loadUsers();
  const i = users.findIndex((u) => u.id === id);
  if (i === -1) return false;
  users[i].passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  users[i].tokenVersion = (users[i].tokenVersion ?? 0) + 1;
  users[i].updatedAt = new Date().toISOString();
  await queueWrite();
  return true;
}

// ---------- 2FA / TOTP ----------

export async function findRawById(id: string): Promise<SystemUser | null> {
  await loadUsers();
  return users.find((u) => u.id === id) ?? null;
}

export async function setTotpSecret(
  id: string,
  secretEncrypted: string,
): Promise<boolean> {
  await loadUsers();
  const i = users.findIndex((u) => u.id === id);
  if (i === -1) return false;
  users[i].totpSecretEncrypted = secretEncrypted;
  users[i].totpEnabled = false; // só ativa após verificar
  users[i].updatedAt = new Date().toISOString();
  await queueWrite();
  return true;
}

export async function enableTotp(
  id: string,
  backupCodeHashes: string[],
): Promise<boolean> {
  await loadUsers();
  const i = users.findIndex((u) => u.id === id);
  if (i === -1) return false;
  if (!users[i].totpSecretEncrypted) return false;
  users[i].totpEnabled = true;
  users[i].totpBackupCodes = backupCodeHashes;
  // Bump tokenVersion para invalidar sessions antigas — força re-login com 2FA
  users[i].tokenVersion = (users[i].tokenVersion ?? 0) + 1;
  users[i].updatedAt = new Date().toISOString();
  await queueWrite();
  return true;
}

export async function disableTotp(id: string): Promise<boolean> {
  await loadUsers();
  const i = users.findIndex((u) => u.id === id);
  if (i === -1) return false;
  users[i].totpEnabled = false;
  users[i].totpSecretEncrypted = undefined;
  users[i].totpBackupCodes = undefined;
  users[i].updatedAt = new Date().toISOString();
  await queueWrite();
  return true;
}

/** Consume um código de backup. Retorna true se removido (válido), false caso contrário. */
export async function consumeBackupCode(
  id: string,
  hash: string,
): Promise<boolean> {
  await loadUsers();
  const i = users.findIndex((u) => u.id === id);
  if (i === -1) return false;
  const codes = users[i].totpBackupCodes ?? [];
  const idx = codes.indexOf(hash);
  if (idx === -1) return false;
  codes.splice(idx, 1);
  users[i].totpBackupCodes = codes;
  users[i].updatedAt = new Date().toISOString();
  await queueWrite();
  return true;
}

export async function regenBackupCodes(
  id: string,
  hashes: string[],
): Promise<boolean> {
  await loadUsers();
  const i = users.findIndex((u) => u.id === id);
  if (i === -1) return false;
  users[i].totpBackupCodes = hashes;
  users[i].updatedAt = new Date().toISOString();
  await queueWrite();
  return true;
}

/**
 * Invalida todos os tokens existentes do usuário (logout em todos os
 * dispositivos). Retorna a nova tokenVersion ou null se o usuário não existe.
 */
export async function bumpTokenVersion(id: string): Promise<number | null> {
  await loadUsers();
  const i = users.findIndex((u) => u.id === id);
  if (i === -1) return null;
  users[i].tokenVersion = (users[i].tokenVersion ?? 0) + 1;
  users[i].updatedAt = new Date().toISOString();
  await queueWrite();
  return users[i].tokenVersion;
}

export async function deleteUser(id: string): Promise<boolean> {
  await loadUsers();
  const i = users.findIndex((u) => u.id === id);
  if (i === -1) return false;
  // proteção: nunca deixe ficar sem nenhum superadmin
  if (users[i].role === 'superadmin') {
    const others = users.filter((u) => u.role === 'superadmin' && u.id !== id);
    if (others.length === 0) {
      throw new Error('Não é possível excluir o último superadmin.');
    }
  }
  users.splice(i, 1);
  await queueWrite();
  return true;
}

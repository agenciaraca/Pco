// Store de usuários do sistema (logins).
//
// Dois backends, mesma interface — como o resto do projeto. Por padrão persiste
// em `data/users.json`; com AUTH_STORE=db e DATABASE_URL presente, persiste nas
// colunas de credencial da tabela `users` do Postgres.
//
// Por que a flag existe em vez de simplesmente seguir o hasDb(): virar a chave
// sem os dados migrados deixaria todo mundo sem conseguir entrar. A ordem é
// migrar (scripts/migrate_logins_to_db.ts), conferir, e só então ligar.
//
// A lista vive em memória e `persist()` é o único ponto de escrita — por isso a
// troca de backend não toca nenhuma das funções de negócio abaixo.

import bcrypt from 'bcryptjs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { getDb, schema } from '../db/client';

export type Role = 'student' | 'admin' | 'superadmin';

export interface SystemUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  /**
   * Slug de role customizada (de /admin/papeis). Coexiste com `role` que
   * continua sendo o role do sistema enforced pelo middleware. Quando RBAC
   * dinâmico for ativado, este campo passa a ser a fonte da verdade.
   */
  customRoleSlug?: string | null;
  passwordHash: string;
  tokenVersion: number;
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  active: boolean;
  // Documento (CPF/RG/passport) — opcional, normalizado (só dígitos para CPF/RG)
  document?: string | null;
  onboardingCompletedAt?: string | null;
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
  customRoleSlug?: string | null;
  tokenVersion: number;
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  active: boolean;
  document?: string | null;
  onboardingCompletedAt?: string | null;
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

/** O backend do Postgres só entra quando pedido E disponível. */
function usingDb(): boolean {
  return process.env.AUTH_STORE === 'db' && getDb() !== null;
}

type UserRow = typeof schema.users.$inferInsert;

function toRow(u: SystemUser): UserRow {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    avatarUrl: u.avatarUrl ?? null,
    createdAt: new Date(u.createdAt),
    updatedAt: new Date(u.updatedAt),
    passwordHash: u.passwordHash,
    tokenVersion: u.tokenVersion,
    active: u.active,
    customRoleSlug: u.customRoleSlug ?? null,
    lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt) : null,
    document: u.document ?? null,
    onboardingCompletedAt: u.onboardingCompletedAt ? new Date(u.onboardingCompletedAt) : null,
    totpEnabled: u.totpEnabled ?? false,
    totpSecretEncrypted: u.totpSecretEncrypted ?? null,
    totpBackupCodes: u.totpBackupCodes ?? null,
  };
}

function fromRow(r: typeof schema.users.$inferSelect): SystemUser {
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    role: r.role,
    customRoleSlug: r.customRoleSlug,
    // Conta sem senha ainda não pode entrar; bcrypt.compare contra string vazia
    // falha, que é o comportamento correto para quem veio da importação e
    // precisa passar pelo "esqueci minha senha".
    passwordHash: r.passwordHash ?? '',
    tokenVersion: r.tokenVersion,
    avatarUrl: r.avatarUrl,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    lastLoginAt: r.lastLoginAt?.toISOString(),
    active: r.active,
    document: r.document,
    onboardingCompletedAt: r.onboardingCompletedAt?.toISOString() ?? null,
    totpEnabled: r.totpEnabled,
    totpSecretEncrypted: r.totpSecretEncrypted ?? undefined,
    totpBackupCodes: r.totpBackupCodes ?? undefined,
  };
}

/**
 * Retrato da última gravação, para saber o que mudou.
 *
 * Sem isto, cada operação — inclusive um login, que só carimba lastLoginAt —
 * reescreveria as 1.600 linhas da tabela. O JSON já se dava ao luxo de
 * reescrever o arquivo inteiro; o banco não precisa herdar esse hábito.
 */
let lastPersisted = new Map<string, string>();

async function persistToDb(): Promise<void> {
  const db = getDb();
  if (!db) return;
  const atual = new Map(users.map((u) => [u.id, JSON.stringify(u)]));
  const mudados = users.filter((u) => lastPersisted.get(u.id) !== atual.get(u.id));
  const removidos = [...lastPersisted.keys()].filter((id) => !atual.has(id));

  for (const u of mudados) {
    const row = toRow(u);
    await db
      .insert(schema.users)
      .values(row)
      .onConflictDoUpdate({ target: schema.users.id, set: row });
  }
  if (removidos.length > 0) {
    await db.delete(schema.users).where(inArray(schema.users.id, removidos));
  }
  lastPersisted = atual;
}

async function persist(): Promise<void> {
  if (usingDb()) {
    await persistToDb();
    return;
  }
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

/**
 * Última vez que a lista foi relida do backend, para não transformar cada busca
 * frustrada numa consulta ao banco.
 */
let ultimaRecarga = 0;
const INTERVALO_MIN_RECARGA_MS = 5_000;

/**
 * Relê a lista quando alguém procurado não está nela.
 *
 * A lista é carregada no boot e vive em memória, então conta criada por outro
 * processo — um script de migração, o sincronizador da loja, SQL direto — não
 * existe para quem está servindo. O sintoma é cruel: a pessoa recebe o convite,
 * clica no link, define a senha e leva "usuário não encontrado", enquanto a
 * conta está lá no banco, inteira.
 *
 * Só relê de fato a cada poucos segundos: quem procurar um e-mail que nunca
 * existiu não deve conseguir provocar uma consulta por tentativa.
 */
async function recarregarSeAusente(): Promise<boolean> {
  const agora = Date.now();
  if (agora - ultimaRecarga < INTERVALO_MIN_RECARGA_MS) return false;
  ultimaRecarga = agora;
  loaded = false;
  await loadUsers();
  return true;
}

export async function loadUsers(): Promise<void> {
  if (loaded) return;

  if (usingDb()) {
    const db = getDb()!;
    const rows = await db.select().from(schema.users);
    if (rows.length > 0) {
      users = rows.map(fromRow);
      lastPersisted = new Map(users.map((u) => [u.id, JSON.stringify(u)]));
      loaded = true;
      return;
    }
    // Tabela vazia: cai no seed abaixo, que grava pelo persist() — já no banco.
    // Não lê o JSON de propósito: importar credencial é trabalho do script de
    // migração, com conferência, e não de um efeito colateral do primeiro boot.
  }
  // Backend de arquivo: lê o JSON. No modo banco com a tabela vazia, cai direto
  // no seed abaixo — ler o JSON aqui importaria credencial pela porta dos
  // fundos, sem conferência, que é justamente o que o script de migração faz
  // com cuidado.
  try {
    if (usingDb()) throw new Error('modo banco: pula o arquivo');
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
  const achar = () => users.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null;
  const primeiro = achar();
  if (primeiro) return primeiro;
  // Pode ter sido criada por fora depois do boot — ver recarregarSeAusente().
  if (await recarregarSeAusente()) return achar();
  return null;
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
  customRoleSlug?: string | null;
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
    customRoleSlug: input.customRoleSlug ?? null,
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
  customRoleSlug?: string | null;
  active?: boolean;
  avatarUrl?: string | null;
  onboardingCompletedAt?: string | null;
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
    ...(patch.customRoleSlug !== undefined
      ? { customRoleSlug: patch.customRoleSlug }
      : {}),
    ...(patch.active !== undefined ? { active: patch.active } : {}),
    ...(patch.avatarUrl !== undefined ? { avatarUrl: patch.avatarUrl } : {}),
    ...(patch.onboardingCompletedAt !== undefined
      ? { onboardingCompletedAt: patch.onboardingCompletedAt }
      : {}),
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
  let i = users.findIndex((u) => u.id === id);
  if (i === -1 && (await recarregarSeAusente())) {
    i = users.findIndex((u) => u.id === id);
  }
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

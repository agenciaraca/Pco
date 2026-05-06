// Roles & Permissions inventory.
//
// **Status atual:** documentação. Os 3 system roles (student/admin/superadmin)
// são canônicos e enforced pelo `requireAuth(...)`. Esta store permite ao admin:
// 1. Inspecionar os roles existentes e suas permissões nominais
// 2. Criar roles "custom" pra documentar convenções de equipe (advisory)
// 3. Editar/remover roles custom
//
// Quando RBAC dinâmico for implementado (sprint futuro), as permissões aqui
// passam a ser enforced. Hoje servem como documentação versionada.

import crypto from 'node:crypto';
import { JsonStore } from '../db/json-store';

/** Permission codes pré-definidos (system). Custom permissions podem ser adicionadas. */
export const SYSTEM_PERMISSIONS = [
  // Conteúdo
  'courses.read',
  'courses.write',
  'courses.delete',
  'lessons.read',
  'lessons.write',
  // Alunos
  'students.read',
  'students.write',
  'students.delete',
  // Pagamentos
  'orders.read',
  'orders.refund',
  'payments.gateways.manage',
  'products.read',
  'products.write',
  'coupons.manage',
  // Usuários do sistema
  'users.read',
  'users.write',
  'users.delete',
  'users.impersonate',
  // Notificações
  'notifications.send',
  'notifications.broadcast',
  // Suporte
  'support.read',
  'support.respond',
  // Relatórios
  'analytics.read',
  'audit.read',
  'errors.read',
  // Sistema
  'settings.manage',
  'api-tokens.manage',
  'webhooks.manage',
  'imports.run',
  'lgpd.review',
] as const;

export type SystemPermission = (typeof SYSTEM_PERMISSIONS)[number];

export interface Role {
  id: string;
  /** Slug imutável (case-insensitive). System roles têm slug fixo. */
  slug: string;
  name: string;
  description: string;
  permissions: string[];
  /** Sistema: imutável e não-deletável. */
  system: boolean;
  createdAt: string;
  updatedAt: string;
}

const SYSTEM_ROLES: Role[] = [
  {
    id: 'role-student',
    slug: 'student',
    name: 'Aluno',
    description:
      'Usuário final da plataforma. Acessa cursos, biblioteca, certificados, tutor.',
    permissions: [],
    system: true,
    createdAt: '1970-01-01T00:00:00.000Z',
    updatedAt: '1970-01-01T00:00:00.000Z',
  },
  {
    id: 'role-admin',
    slug: 'admin',
    name: 'Administrador',
    description: 'Pode gerenciar conteúdo, alunos, pagamentos, suporte e relatórios.',
    permissions: [
      'courses.read',
      'courses.write',
      'lessons.read',
      'lessons.write',
      'students.read',
      'students.write',
      'orders.read',
      'orders.refund',
      'products.read',
      'products.write',
      'coupons.manage',
      'users.read',
      'users.write',
      'users.impersonate',
      'notifications.send',
      'notifications.broadcast',
      'support.read',
      'support.respond',
      'analytics.read',
      'audit.read',
      'errors.read',
      'imports.run',
      'lgpd.review',
    ],
    system: true,
    createdAt: '1970-01-01T00:00:00.000Z',
    updatedAt: '1970-01-01T00:00:00.000Z',
  },
  {
    id: 'role-superadmin',
    slug: 'superadmin',
    name: 'Superadmin',
    description: 'Acesso total. Único que pode mudar roles de outros usuários.',
    permissions: [...SYSTEM_PERMISSIONS],
    system: true,
    createdAt: '1970-01-01T00:00:00.000Z',
    updatedAt: '1970-01-01T00:00:00.000Z',
  },
];

const store = new JsonStore<Role>('roles.json', () => SYSTEM_ROLES);

function newId(): string {
  return `role-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

function normalizeSlug(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Garante que system roles existam mesmo após edits manuais ao JSON. */
async function ensureSystemRoles(): Promise<void> {
  const all = await store.getAll();
  const slugs = new Set(all.map((r) => r.slug));
  const missing = SYSTEM_ROLES.filter((r) => !slugs.has(r.slug));
  if (missing.length > 0) {
    await store.modify((arr) => {
      for (const r of missing) arr.push(r);
    });
  }
}

export async function listRoles(): Promise<Role[]> {
  await ensureSystemRoles();
  const all = await store.getAll();
  return all.slice().sort((a, b) => {
    if (a.system !== b.system) return a.system ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export async function findById(id: string): Promise<Role | null> {
  const all = await store.getAll();
  return all.find((r) => r.id === id) ?? null;
}

export async function findBySlug(slug: string): Promise<Role | null> {
  const all = await store.getAll();
  const norm = normalizeSlug(slug);
  return all.find((r) => r.slug === norm) ?? null;
}

export interface CreateRoleInput {
  slug: string;
  name: string;
  description?: string;
  permissions?: string[];
}

export class RoleError extends Error {
  constructor(
    public code:
      | 'INVALID_SLUG'
      | 'INVALID_NAME'
      | 'SLUG_TAKEN'
      | 'INVALID_PERMISSION'
      | 'SYSTEM_ROLE'
      | 'NOT_FOUND',
    message: string,
  ) {
    super(message);
    this.name = 'RoleError';
  }
}

function validatePermissions(perms: string[]): string[] {
  const out: string[] = [];
  for (const p of perms) {
    const t = String(p).trim();
    if (!t) continue;
    if (!/^[a-z][a-z0-9._-]*$/.test(t)) {
      throw new RoleError(
        'INVALID_PERMISSION',
        `Permissão inválida: "${t}" (use lowercase, dígitos, ponto, hífen).`,
      );
    }
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

export async function createRole(input: CreateRoleInput): Promise<Role> {
  const slug = normalizeSlug(input.slug);
  if (!slug || slug.length < 2 || slug.length > 40) {
    throw new RoleError('INVALID_SLUG', 'Slug deve ter 2-40 caracteres válidos.');
  }
  const name = input.name.trim();
  if (!name || name.length > 80) {
    throw new RoleError('INVALID_NAME', 'Nome deve ter 1-80 caracteres.');
  }
  const existing = await findBySlug(slug);
  if (existing) {
    throw new RoleError('SLUG_TAKEN', `Slug "${slug}" já existe.`);
  }
  const permissions = validatePermissions(input.permissions ?? []);
  const now = new Date().toISOString();
  const role: Role = {
    id: newId(),
    slug,
    name,
    description: input.description?.trim() ?? '',
    permissions,
    system: false,
    createdAt: now,
    updatedAt: now,
  };
  await store.unshift(role);
  return role;
}

export interface UpdateRoleInput {
  name?: string;
  description?: string;
  permissions?: string[];
}

export async function updateRole(id: string, patch: UpdateRoleInput): Promise<Role> {
  const role = await findById(id);
  if (!role) throw new RoleError('NOT_FOUND', 'Role não encontrada.');
  if (role.system) {
    throw new RoleError(
      'SYSTEM_ROLE',
      'Roles do sistema não podem ser editadas.',
    );
  }
  const updates: Partial<Role> = {};
  if (patch.name !== undefined) {
    const n = patch.name.trim();
    if (!n || n.length > 80) {
      throw new RoleError('INVALID_NAME', 'Nome deve ter 1-80 caracteres.');
    }
    updates.name = n;
  }
  if (patch.description !== undefined) {
    updates.description = patch.description.trim();
  }
  if (patch.permissions !== undefined) {
    updates.permissions = validatePermissions(patch.permissions);
  }
  updates.updatedAt = new Date().toISOString();
  await store.update((r) => r.id === id, (r) => Object.assign(r, updates));
  return (await findById(id))!;
}

export async function deleteRole(id: string): Promise<void> {
  const role = await findById(id);
  if (!role) throw new RoleError('NOT_FOUND', 'Role não encontrada.');
  if (role.system) {
    throw new RoleError(
      'SYSTEM_ROLE',
      'Roles do sistema não podem ser deletadas.',
    );
  }
  await store.modify((arr) => {
    const idx = arr.findIndex((r) => r.id === id);
    if (idx >= 0) arr.splice(idx, 1);
  });
}

/** Catálogo de permissões: system + customs encontradas nos roles existentes. */
export async function listPermissions(): Promise<{
  system: string[];
  custom: string[];
}> {
  const all = await store.getAll();
  const system = [...SYSTEM_PERMISSIONS];
  const customSet = new Set<string>();
  for (const r of all) {
    for (const p of r.permissions) {
      if (!(SYSTEM_PERMISSIONS as readonly string[]).includes(p)) customSet.add(p);
    }
  }
  return {
    system,
    custom: Array.from(customSet).sort(),
  };
}

// Test-only helper para resetar o store entre testes
export async function _resetForTests(): Promise<void> {
  await store.setAll(SYSTEM_ROLES);
}

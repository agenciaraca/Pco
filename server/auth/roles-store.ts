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

/**
 * Permission codes pré-definidos (system). Granulares por área e operação.
 * Custom permissions podem ser adicionadas e serão exibidas no catálogo.
 *
 * Convenção: `<recurso>.<operação>` em snake-case com pontos.
 * Operações comuns: read, list, create, update, delete, export, manage,
 * approve, reject, refund, send, etc.
 */
export const SYSTEM_PERMISSIONS = [
  // ── Cursos ───────────────────────────────────────────────────
  'courses.read',
  'courses.create',
  'courses.update',
  'courses.delete',
  'courses.duplicate',
  'courses.publish',
  'courses.preview',
  'courses.analytics.read',
  // ── Módulos & Aulas ─────────────────────────────────────────
  'modules.create',
  'modules.update',
  'modules.delete',
  'lessons.read',
  'lessons.create',
  'lessons.update',
  'lessons.delete',
  'lessons.reorder',
  'assessments.manage',
  // ── Alunos ──────────────────────────────────────────────────
  'students.list',
  'students.read',
  'students.create',
  'students.update',
  'students.delete',
  'students.bulk_enroll',
  'students.notes.read',
  'students.notes.write',
  'students.analytics.read',
  // ── Matrículas ──────────────────────────────────────────────
  'enrollments.create',
  'enrollments.update',
  'enrollments.delete',
  'enrollments.bulk',
  // ── Pagamentos / Vendas ─────────────────────────────────────
  'orders.read',
  'orders.update',
  'orders.refund',
  'orders.cancel',
  'payments.gateways.read',
  'payments.gateways.create',
  'payments.gateways.update',
  'payments.gateways.delete',
  'products.read',
  'products.create',
  'products.update',
  'products.delete',
  'coupons.read',
  'coupons.create',
  'coupons.update',
  'coupons.delete',
  'sales.analytics.read',
  // ── Certificados ────────────────────────────────────────────
  'certificates.read',
  'certificates.issue',
  'certificates.revoke',
  'certificates.bulk_issue',
  // ── Conteúdo ────────────────────────────────────────────────
  'news.read',
  'news.write',
  'news.delete',
  'library.read',
  'library.write',
  'library.delete',
  'podcasts.read',
  'podcasts.write',
  'podcasts.delete',
  // ── Usuários do sistema ─────────────────────────────────────
  'users.list',
  'users.read',
  'users.create',
  'users.update',
  'users.delete',
  'users.password.reset',
  'users.role.change',
  'users.email.change',
  'users.totp.manage',
  'users.impersonate',
  'users.force_logout',
  'users.export',
  // ── Papéis & Permissões ─────────────────────────────────────
  'roles.read',
  'roles.create',
  'roles.update',
  'roles.delete',
  // ── Notificações & Comunicação ──────────────────────────────
  'notifications.read',
  'notifications.send',
  'notifications.broadcast',
  'email.config.manage',
  'email.templates.read',
  'reengagement.config.manage',
  // ── Suporte ─────────────────────────────────────────────────
  'support.read',
  'support.respond',
  'support.close',
  'support.delete',
  // ── Discussões / Reviews ────────────────────────────────────
  'discussions.read',
  'discussions.moderate',
  'reviews.read',
  'reviews.moderate',
  // ── Relatórios & Observabilidade ────────────────────────────
  'analytics.read',
  'audit.read',
  'audit.export',
  'errors.read',
  'errors.delete',
  'logs.read',
  'metrics.read',
  // ── Sistema ─────────────────────────────────────────────────
  'settings.read',
  'settings.update',
  'settings.backup.manage',
  'api_tokens.read',
  'api_tokens.create',
  'api_tokens.revoke',
  'api_tokens.delete',
  'webhooks.read',
  'webhooks.create',
  'webhooks.update',
  'webhooks.delete',
  'webhooks.replay',
  'imports.run',
  'imports.schedules.manage',
  'imports.connections.manage',
  'imports.rollback',
  'live_sessions.manage',
  'achievements.manage',
  'rate_limits.read',
  // ── LGPD / Compliance ───────────────────────────────────────
  'lgpd.deletion.review',
  'lgpd.deletion.approve',
  'lgpd.deletion.confirm',
] as const;

export type SystemPermission = (typeof SYSTEM_PERMISSIONS)[number];

/**
 * Catálogo de labels/descrições em português pra cada permissão system.
 * Custom permissions caem no fallback de mostrar o code + group "outros".
 */
export interface PermissionMeta {
  /** Texto curto e claro mostrado como label da checkbox (português). */
  label: string;
  /** Categoria pra agrupar na UI. */
  group: PermissionGroup;
  /** Descrição opcional, mostrada como tooltip ou abaixo do label. */
  description?: string;
}

export const PERMISSION_GROUPS = [
  'Cursos',
  'Módulos e Aulas',
  'Alunos',
  'Matrículas',
  'Pagamentos',
  'Certificados',
  'Conteúdo',
  'Usuários do sistema',
  'Papéis e Permissões',
  'Notificações',
  'Suporte',
  'Discussões e Reviews',
  'Relatórios',
  'Sistema',
  'LGPD',
  'Outros',
] as const;

export type PermissionGroup = (typeof PERMISSION_GROUPS)[number];

export const PERMISSION_META: Record<string, PermissionMeta> = {
  // Cursos
  'courses.read': { group: 'Cursos', label: 'Visualizar cursos' },
  'courses.create': { group: 'Cursos', label: 'Criar cursos' },
  'courses.update': { group: 'Cursos', label: 'Editar cursos' },
  'courses.delete': { group: 'Cursos', label: 'Excluir cursos' },
  'courses.duplicate': { group: 'Cursos', label: 'Duplicar cursos' },
  'courses.publish': { group: 'Cursos', label: 'Publicar/despublicar cursos' },
  'courses.preview': { group: 'Cursos', label: 'Pré-visualizar cursos' },
  'courses.analytics.read': { group: 'Cursos', label: 'Ver analytics do curso' },

  // Módulos e Aulas
  'modules.create': { group: 'Módulos e Aulas', label: 'Criar módulos' },
  'modules.update': { group: 'Módulos e Aulas', label: 'Editar módulos' },
  'modules.delete': { group: 'Módulos e Aulas', label: 'Excluir módulos' },
  'lessons.read': { group: 'Módulos e Aulas', label: 'Visualizar aulas' },
  'lessons.create': { group: 'Módulos e Aulas', label: 'Criar aulas' },
  'lessons.update': { group: 'Módulos e Aulas', label: 'Editar aulas' },
  'lessons.delete': { group: 'Módulos e Aulas', label: 'Excluir aulas' },
  'lessons.reorder': { group: 'Módulos e Aulas', label: 'Reordenar aulas' },
  'assessments.manage': { group: 'Módulos e Aulas', label: 'Gerenciar avaliações' },

  // Alunos
  'students.list': { group: 'Alunos', label: 'Listar alunos' },
  'students.read': { group: 'Alunos', label: 'Ver detalhes do aluno' },
  'students.create': { group: 'Alunos', label: 'Cadastrar alunos' },
  'students.update': { group: 'Alunos', label: 'Editar alunos' },
  'students.delete': { group: 'Alunos', label: 'Excluir alunos' },
  'students.bulk_enroll': { group: 'Alunos', label: 'Matricular em lote' },
  'students.notes.read': { group: 'Alunos', label: 'Ler notas internas do aluno' },
  'students.notes.write': { group: 'Alunos', label: 'Escrever notas internas' },
  'students.analytics.read': { group: 'Alunos', label: 'Ver analytics individual' },

  // Matrículas
  'enrollments.create': { group: 'Matrículas', label: 'Criar matrículas' },
  'enrollments.update': { group: 'Matrículas', label: 'Editar matrículas' },
  'enrollments.delete': { group: 'Matrículas', label: 'Cancelar matrículas' },
  'enrollments.bulk': { group: 'Matrículas', label: 'Operações em lote (bulk)' },

  // Pagamentos
  'orders.read': { group: 'Pagamentos', label: 'Ver pedidos' },
  'orders.update': { group: 'Pagamentos', label: 'Editar pedidos' },
  'orders.refund': { group: 'Pagamentos', label: 'Reembolsar pedidos' },
  'orders.cancel': { group: 'Pagamentos', label: 'Cancelar pedidos' },
  'payments.gateways.read': { group: 'Pagamentos', label: 'Ver gateways de pagamento' },
  'payments.gateways.create': { group: 'Pagamentos', label: 'Adicionar gateway' },
  'payments.gateways.update': { group: 'Pagamentos', label: 'Editar gateway' },
  'payments.gateways.delete': { group: 'Pagamentos', label: 'Remover gateway' },
  'products.read': { group: 'Pagamentos', label: 'Ver produtos' },
  'products.create': { group: 'Pagamentos', label: 'Criar produtos' },
  'products.update': { group: 'Pagamentos', label: 'Editar produtos' },
  'products.delete': { group: 'Pagamentos', label: 'Excluir produtos' },
  'coupons.read': { group: 'Pagamentos', label: 'Ver cupons' },
  'coupons.create': { group: 'Pagamentos', label: 'Criar cupons' },
  'coupons.update': { group: 'Pagamentos', label: 'Editar cupons' },
  'coupons.delete': { group: 'Pagamentos', label: 'Excluir cupons' },
  'sales.analytics.read': { group: 'Pagamentos', label: 'Ver analytics de vendas' },

  // Certificados
  'certificates.read': { group: 'Certificados', label: 'Visualizar certificados' },
  'certificates.issue': { group: 'Certificados', label: 'Emitir certificado individual' },
  'certificates.revoke': { group: 'Certificados', label: 'Revogar certificado' },
  'certificates.bulk_issue': { group: 'Certificados', label: 'Emissão retroativa em lote' },

  // Conteúdo
  'news.read': { group: 'Conteúdo', label: 'Ver notícias' },
  'news.write': { group: 'Conteúdo', label: 'Criar/editar notícias' },
  'news.delete': { group: 'Conteúdo', label: 'Excluir notícias' },
  'library.read': { group: 'Conteúdo', label: 'Ver biblioteca' },
  'library.write': { group: 'Conteúdo', label: 'Criar/editar itens da biblioteca' },
  'library.delete': { group: 'Conteúdo', label: 'Excluir itens da biblioteca' },
  'podcasts.read': { group: 'Conteúdo', label: 'Ver podcasts' },
  'podcasts.write': { group: 'Conteúdo', label: 'Criar/editar podcasts' },
  'podcasts.delete': { group: 'Conteúdo', label: 'Excluir podcasts' },

  // Usuários do sistema
  'users.list': { group: 'Usuários do sistema', label: 'Listar usuários do sistema' },
  'users.read': { group: 'Usuários do sistema', label: 'Ver detalhes de usuário' },
  'users.create': { group: 'Usuários do sistema', label: 'Criar usuários do sistema' },
  'users.update': { group: 'Usuários do sistema', label: 'Editar usuários do sistema' },
  'users.delete': {
    group: 'Usuários do sistema',
    label: 'Excluir usuários do sistema',
    description: 'Ação destrutiva — exige confirmação X-Confirm-Name',
  },
  'users.password.reset': {
    group: 'Usuários do sistema',
    label: 'Forçar reset de senha',
  },
  'users.role.change': {
    group: 'Usuários do sistema',
    label: 'Mudar papel (role) de usuário',
    description: 'Apenas superadmin no sistema atual',
  },
  'users.email.change': {
    group: 'Usuários do sistema',
    label: 'Alterar e-mail de usuário',
  },
  'users.totp.manage': {
    group: 'Usuários do sistema',
    label: 'Gerenciar 2FA do usuário',
  },
  'users.impersonate': {
    group: 'Usuários do sistema',
    label: 'Visualizar como aluno (impersonation)',
    description: 'Sessão de 30 min com banner permanente e ações sensíveis bloqueadas',
  },
  'users.force_logout': {
    group: 'Usuários do sistema',
    label: 'Forçar logout (revoga sessões ativas)',
  },
  'users.export': {
    group: 'Usuários do sistema',
    label: 'Exportar dados de usuário (LGPD self-service)',
  },

  // Papéis e Permissões
  'roles.read': { group: 'Papéis e Permissões', label: 'Ver papéis cadastrados' },
  'roles.create': { group: 'Papéis e Permissões', label: 'Criar papel personalizado' },
  'roles.update': { group: 'Papéis e Permissões', label: 'Editar papel personalizado' },
  'roles.delete': { group: 'Papéis e Permissões', label: 'Excluir papel personalizado' },

  // Notificações
  'notifications.read': { group: 'Notificações', label: 'Ler notificações' },
  'notifications.send': { group: 'Notificações', label: 'Enviar notificação individual' },
  'notifications.broadcast': {
    group: 'Notificações',
    label: 'Disparar broadcasts',
    description: 'E-mail/notificação para múltiplos destinatários',
  },
  'email.config.manage': {
    group: 'Notificações',
    label: 'Configurar provedores de e-mail',
  },
  'email.templates.read': {
    group: 'Notificações',
    label: 'Ver templates de e-mail',
  },
  'reengagement.config.manage': {
    group: 'Notificações',
    label: 'Configurar reengajamento automático',
  },

  // Suporte
  'support.read': { group: 'Suporte', label: 'Ver tickets de suporte' },
  'support.respond': { group: 'Suporte', label: 'Responder tickets' },
  'support.close': { group: 'Suporte', label: 'Fechar tickets' },
  'support.delete': { group: 'Suporte', label: 'Excluir tickets' },

  // Discussões
  'discussions.read': { group: 'Discussões e Reviews', label: 'Ler discussões' },
  'discussions.moderate': {
    group: 'Discussões e Reviews',
    label: 'Moderar discussões (deletar/ocultar)',
  },
  'reviews.read': { group: 'Discussões e Reviews', label: 'Ler avaliações de cursos' },
  'reviews.moderate': {
    group: 'Discussões e Reviews',
    label: 'Moderar avaliações',
  },

  // Relatórios
  'analytics.read': { group: 'Relatórios', label: 'Ver dashboards e métricas' },
  'audit.read': { group: 'Relatórios', label: 'Ler log de auditoria' },
  'audit.export': { group: 'Relatórios', label: 'Exportar log de auditoria (CSV)' },
  'errors.read': { group: 'Relatórios', label: 'Ver erros do servidor' },
  'errors.delete': { group: 'Relatórios', label: 'Limpar erros do servidor' },
  'logs.read': { group: 'Relatórios', label: 'Ver logs do servidor' },
  'metrics.read': { group: 'Relatórios', label: 'Ver métricas operacionais' },

  // Sistema
  'settings.read': { group: 'Sistema', label: 'Ler configurações gerais' },
  'settings.update': { group: 'Sistema', label: 'Atualizar configurações gerais' },
  'settings.backup.manage': {
    group: 'Sistema',
    label: 'Gerenciar backup de configurações',
  },
  'api_tokens.read': { group: 'Sistema', label: 'Ver API tokens' },
  'api_tokens.create': { group: 'Sistema', label: 'Criar API tokens' },
  'api_tokens.revoke': { group: 'Sistema', label: 'Revogar API tokens' },
  'api_tokens.delete': { group: 'Sistema', label: 'Excluir API tokens' },
  'webhooks.read': { group: 'Sistema', label: 'Ver webhooks' },
  'webhooks.create': { group: 'Sistema', label: 'Criar webhooks' },
  'webhooks.update': { group: 'Sistema', label: 'Editar webhooks' },
  'webhooks.delete': { group: 'Sistema', label: 'Excluir webhooks' },
  'webhooks.replay': {
    group: 'Sistema',
    label: 'Reenviar entregas falhas',
  },
  'imports.run': { group: 'Sistema', label: 'Executar importação de dados' },
  'imports.schedules.manage': {
    group: 'Sistema',
    label: 'Configurar imports agendados',
  },
  'imports.connections.manage': {
    group: 'Sistema',
    label: 'Gerenciar conexões de import',
  },
  'imports.rollback': { group: 'Sistema', label: 'Fazer rollback de import' },
  'live_sessions.manage': {
    group: 'Sistema',
    label: 'Gerenciar sessões ao vivo',
  },
  'achievements.manage': {
    group: 'Sistema',
    label: 'Gerenciar conquistas/badges',
  },
  'rate_limits.read': {
    group: 'Sistema',
    label: 'Ver telemetria de rate limits',
  },

  // LGPD
  'lgpd.deletion.review': {
    group: 'LGPD',
    label: 'Revisar pedidos de exclusão LGPD',
  },
  'lgpd.deletion.approve': {
    group: 'LGPD',
    label: 'Aprovar/rejeitar exclusão LGPD',
  },
  'lgpd.deletion.confirm': {
    group: 'LGPD',
    label: 'Confirmar exclusão LGPD (executa)',
    description: 'Ação destrutiva — apaga dados de aluno permanentemente',
  },
};

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
      // Cursos
      'courses.read',
      'courses.create',
      'courses.update',
      'courses.duplicate',
      'courses.publish',
      'courses.preview',
      'courses.analytics.read',
      // Módulos & Aulas
      'modules.create',
      'modules.update',
      'modules.delete',
      'lessons.read',
      'lessons.create',
      'lessons.update',
      'lessons.delete',
      'lessons.reorder',
      'assessments.manage',
      // Alunos
      'students.list',
      'students.read',
      'students.create',
      'students.update',
      'students.bulk_enroll',
      'students.notes.read',
      'students.notes.write',
      'students.analytics.read',
      // Matrículas
      'enrollments.create',
      'enrollments.update',
      'enrollments.delete',
      'enrollments.bulk',
      // Pagamentos
      'orders.read',
      'orders.update',
      'orders.refund',
      'orders.cancel',
      'payments.gateways.read',
      'products.read',
      'products.create',
      'products.update',
      'coupons.read',
      'coupons.create',
      'coupons.update',
      'sales.analytics.read',
      // Certificados
      'certificates.read',
      'certificates.issue',
      'certificates.bulk_issue',
      // Conteúdo
      'news.read',
      'news.write',
      'library.read',
      'library.write',
      'podcasts.read',
      'podcasts.write',
      // Usuários
      'users.list',
      'users.read',
      'users.create',
      'users.update',
      'users.password.reset',
      'users.totp.manage',
      'users.impersonate',
      'users.force_logout',
      'users.export',
      // Roles
      'roles.read',
      // Notificações
      'notifications.read',
      'notifications.send',
      'notifications.broadcast',
      'email.config.manage',
      'email.templates.read',
      'reengagement.config.manage',
      // Suporte
      'support.read',
      'support.respond',
      'support.close',
      // Discussões
      'discussions.read',
      'discussions.moderate',
      'reviews.read',
      'reviews.moderate',
      // Relatórios
      'analytics.read',
      'audit.read',
      'audit.export',
      'errors.read',
      'logs.read',
      'metrics.read',
      // Sistema
      'settings.read',
      'settings.update',
      'api_tokens.read',
      'webhooks.read',
      'imports.run',
      'imports.schedules.manage',
      'live_sessions.manage',
      'achievements.manage',
      // LGPD (review only)
      'lgpd.deletion.review',
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

/**
 * Garante que system roles existam e estejam sincronizadas com o seed canônico.
 * - Adiciona system roles ausentes
 * - Reconcilia permissions/name/description quando o seed evolui em deploys
 *   (system roles são imutáveis no UI, mas o código fonte é a verdade)
 * - NÃO toca em custom roles (system=false), nem deleta nada
 */
async function ensureSystemRoles(): Promise<void> {
  await store.modify((arr) => {
    for (const seed of SYSTEM_ROLES) {
      const idx = arr.findIndex((r) => r.slug === seed.slug);
      if (idx === -1) {
        arr.push({ ...seed });
        continue;
      }
      const current = arr[idx];
      const permsChanged =
        current.permissions.length !== seed.permissions.length ||
        current.permissions.some((p, i) => p !== seed.permissions[i]);
      if (
        permsChanged ||
        current.name !== seed.name ||
        current.description !== seed.description ||
        current.system !== true
      ) {
        arr[idx] = {
          ...current,
          name: seed.name,
          description: seed.description,
          permissions: [...seed.permissions],
          system: true,
          updatedAt: new Date().toISOString(),
        };
      }
    }
  });
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
  meta: Record<string, PermissionMeta>;
  groups: readonly PermissionGroup[];
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
    meta: PERMISSION_META,
    groups: PERMISSION_GROUPS,
  };
}

// Test-only helper para resetar o store entre testes
export async function _resetForTests(): Promise<void> {
  await store.setAll(SYSTEM_ROLES);
}

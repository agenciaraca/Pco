// Definições de campos por entidade + gerador de CSV template.
// CSV é UTF-8 com BOM, separador vírgula (RFC 4180).

import type { ImportEntityType } from '../types';

export interface FieldDef {
  name: string;
  label: string;
  required: boolean;
  example?: string;
  description?: string;
}

export interface EntityTemplate {
  entity: ImportEntityType;
  filename: string; // ex: alunos.csv
  fields: FieldDef[];
}

export const CSV_TEMPLATES: Record<ImportEntityType, EntityTemplate> = {
  student: {
    entity: 'student',
    filename: 'alunos.csv',
    fields: [
      { name: 'external_user_id', label: 'ID externo do usuário', required: false, example: 'ext_user_001' },
      { name: 'wp_user_id', label: 'ID do usuário no WordPress', required: false, example: '42' },
      { name: 'user_login', label: 'Login WP', required: false, example: 'mariana_castro' },
      { name: 'user_email', label: 'E-mail', required: true, example: 'mariana@example.com' },
      { name: 'first_name', label: 'Primeiro nome', required: false, example: 'Mariana' },
      { name: 'last_name', label: 'Sobrenome', required: false, example: 'Castro' },
      { name: 'display_name', label: 'Nome de exibição', required: false, example: 'Mariana C.' },
      { name: 'phone', label: 'Telefone', required: false, example: '+5511987654321' },
      { name: 'document', label: 'CPF/RG', required: false, example: '000.000.000-00' },
      { name: 'created_at', label: 'Criado em (ISO 8601)', required: false, example: '2025-09-12T14:30:00Z' },
      { name: 'updated_at', label: 'Atualizado em (ISO 8601)', required: false, example: '2026-04-01T10:00:00Z' },
      { name: 'status', label: 'Status (ativo/em_risco/bloqueado/inativo)', required: false, example: 'ativo' },
    ],
  },

  course: {
    entity: 'course',
    filename: 'cursos.csv',
    fields: [
      { name: 'external_course_id', label: 'ID externo', required: false, example: 'ext_course_psi' },
      { name: 'learndash_course_id', label: 'ID LearnDash', required: false, example: '101' },
      { name: 'course_slug', label: 'Slug', required: false, example: 'psicanalise-clinica' },
      { name: 'course_title', label: 'Título', required: true, example: 'Psicanálise Clínica' },
      { name: 'course_description', label: 'Descrição', required: false, example: 'Formação completa...' },
      { name: 'course_status', label: 'Status (publish/draft/private)', required: false, example: 'publish' },
      { name: 'course_price_type', label: 'Tipo (free/paid/subscribe)', required: false, example: 'paid' },
      { name: 'course_duration_days', label: 'Duração da matrícula em dias', required: false, example: '365' },
      { name: 'course_access_expires_after_days', label: 'Expira após N dias', required: false, example: '365' },
      { name: 'course_start_date', label: 'Início (ISO 8601)', required: false, example: '2026-01-15' },
      { name: 'course_end_date', label: 'Fim (ISO 8601)', required: false, example: '2027-01-15' },
      { name: 'created_at', label: 'Criado em', required: false, example: '2025-10-01T00:00:00Z' },
      { name: 'updated_at', label: 'Atualizado em', required: false, example: '2026-04-01T00:00:00Z' },
    ],
  },

  module: {
    entity: 'module',
    filename: 'modulos.csv',
    fields: [
      { name: 'external_module_id', label: 'ID externo', required: false, example: 'ext_mod_001' },
      { name: 'learndash_section_id', label: 'ID seção LearnDash', required: false, example: '201' },
      { name: 'course_external_id', label: 'ID externo do curso pai', required: false, example: 'ext_course_psi' },
      { name: 'course_learndash_id', label: 'ID LearnDash do curso', required: false, example: '101' },
      { name: 'module_title', label: 'Título', required: true, example: 'Módulo 1 — Fundamentos' },
      { name: 'module_order', label: 'Ordem', required: true, example: '1' },
      { name: 'description', label: 'Descrição', required: false, example: '...' },
      { name: 'status', label: 'Status', required: false, example: 'publish' },
    ],
  },

  lesson: {
    entity: 'lesson',
    filename: 'aulas.csv',
    fields: [
      { name: 'external_lesson_id', label: 'ID externo', required: false, example: 'ext_les_001' },
      { name: 'learndash_lesson_id', label: 'ID LearnDash', required: false, example: '301' },
      { name: 'course_external_id', label: 'ID curso', required: false, example: 'ext_course_psi' },
      { name: 'module_external_id', label: 'ID módulo pai', required: false, example: 'ext_mod_001' },
      { name: 'lesson_title', label: 'Título', required: true, example: 'Aula 1 — Introdução' },
      { name: 'lesson_content', label: 'Conteúdo HTML', required: false, example: '<p>...</p>' },
      { name: 'lesson_video_url', label: 'URL do vídeo', required: false, example: 'https://vimeo.com/123' },
      { name: 'lesson_duration_minutes', label: 'Duração (min)', required: false, example: '45' },
      { name: 'lesson_order', label: 'Ordem', required: true, example: '1' },
      { name: 'release_type', label: 'open/drip/scheduled', required: false, example: 'open' },
      { name: 'drip_days', label: 'Dias de drip', required: false, example: '0' },
      { name: 'is_mandatory', label: 'Obrigatória (true/false)', required: false, example: 'true' },
      { name: 'status', label: 'Status', required: false, example: 'publish' },
      { name: 'created_at', label: 'Criado em', required: false, example: '2025-10-01T00:00:00Z' },
      { name: 'updated_at', label: 'Atualizado em', required: false, example: '2026-04-01T00:00:00Z' },
    ],
  },

  product: {
    entity: 'product',
    filename: 'produtos.csv',
    fields: [
      { name: 'external_product_id', label: 'ID externo', required: false, example: 'ext_prod_001' },
      { name: 'wc_product_id', label: 'ID WooCommerce', required: false, example: '501' },
      { name: 'sku', label: 'SKU', required: false, example: 'CURSO-PSI-2026' },
      { name: 'product_name', label: 'Nome', required: true, example: 'Curso Psicanálise Clínica 2026' },
      { name: 'product_type', label: 'simple/variable/subscription', required: false, example: 'simple' },
      { name: 'regular_price', label: 'Preço normal (decimal)', required: true, example: '299.90' },
      { name: 'sale_price', label: 'Preço promocional', required: false, example: '249.90' },
      { name: 'currency', label: 'Moeda (ISO)', required: false, example: 'BRL' },
      { name: 'status', label: 'Status', required: false, example: 'publish' },
      { name: 'linked_course_external_id', label: 'ID externo do curso vinculado', required: false, example: 'ext_course_psi' },
      { name: 'linked_learndash_course_id', label: 'ID LearnDash do curso vinculado', required: false, example: '101' },
    ],
  },

  order: {
    entity: 'order',
    filename: 'pedidos.csv',
    fields: [
      { name: 'external_order_id', label: 'ID externo', required: false, example: 'ext_order_001' },
      { name: 'wc_order_id', label: 'ID WooCommerce', required: false, example: '7001' },
      { name: 'customer_external_id', label: 'ID externo do cliente', required: false, example: 'ext_user_001' },
      { name: 'customer_email', label: 'E-mail do cliente', required: true, example: 'mariana@example.com' },
      { name: 'order_number', label: 'Número do pedido', required: false, example: '#7001' },
      { name: 'order_status', label: 'Status WC (completed/processing/...)', required: true, example: 'completed' },
      { name: 'order_date', label: 'Data do pedido (ISO)', required: true, example: '2026-04-12T15:30:00Z' },
      { name: 'paid_date', label: 'Data do pagamento', required: false, example: '2026-04-12T15:35:00Z' },
      { name: 'completed_date', label: 'Data de conclusão', required: false, example: '2026-04-12T16:00:00Z' },
      { name: 'total', label: 'Valor total (decimal)', required: true, example: '299.90' },
      { name: 'currency', label: 'Moeda', required: false, example: 'BRL' },
      { name: 'payment_method', label: 'Método de pagamento', required: false, example: 'pix' },
      { name: 'transaction_id', label: 'ID da transação', required: false, example: 'tx_ABC123' },
      { name: 'product_ids', label: 'IDs WC dos produtos (separados por |)', required: false, example: '501|502' },
      { name: 'product_skus', label: 'SKUs (separados por |)', required: false, example: 'CURSO-PSI-2026' },
      { name: 'billing_first_name', label: 'Nome', required: false, example: 'Mariana' },
      { name: 'billing_last_name', label: 'Sobrenome', required: false, example: 'Castro' },
      { name: 'billing_email', label: 'E-mail de billing', required: false, example: 'mariana@example.com' },
      { name: 'billing_phone', label: 'Telefone', required: false, example: '+5511987654321' },
      { name: 'created_at', label: 'Criado em', required: false, example: '2026-04-12T15:30:00Z' },
      { name: 'updated_at', label: 'Atualizado em', required: false, example: '2026-04-12T16:00:00Z' },
    ],
  },

  enrollment: {
    entity: 'enrollment',
    filename: 'matriculas.csv',
    fields: [
      { name: 'external_enrollment_id', label: 'ID externo da matrícula', required: false, example: 'ext_enr_001' },
      { name: 'user_external_id', label: 'ID externo do aluno', required: false, example: 'ext_user_001' },
      { name: 'user_email', label: 'E-mail do aluno', required: true, example: 'mariana@example.com' },
      { name: 'course_external_id', label: 'ID externo do curso', required: false, example: 'ext_course_psi' },
      { name: 'learndash_course_id', label: 'ID LearnDash do curso', required: false, example: '101' },
      { name: 'order_external_id', label: 'ID externo do pedido', required: false, example: 'ext_order_001' },
      { name: 'wc_order_id', label: 'ID WooCommerce do pedido', required: false, example: '7001' },
      { name: 'product_external_id', label: 'ID externo do produto', required: false, example: 'ext_prod_001' },
      { name: 'wc_product_id', label: 'ID WooCommerce do produto', required: false, example: '501' },
      { name: 'enrollment_status', label: 'active/pending/expired/cancelled/completed', required: true, example: 'active' },
      { name: 'enrollment_start_date', label: 'Início (ISO)', required: false, example: '2026-04-12T16:00:00Z' },
      { name: 'enrollment_expiration_date', label: 'Expiração (ISO)', required: false, example: '2027-04-12T16:00:00Z' },
      { name: 'access_duration_days', label: 'Duração em dias', required: false, example: '365' },
      { name: 'completed_at', label: 'Conclusão (ISO)', required: false, example: '' },
      { name: 'created_at', label: 'Criado em', required: false, example: '2026-04-12T16:00:00Z' },
      { name: 'updated_at', label: 'Atualizado em', required: false, example: '2026-04-12T16:00:00Z' },
    ],
  },

  progress: {
    entity: 'progress',
    filename: 'progresso.csv',
    fields: [
      { name: 'user_external_id', label: 'ID externo do aluno', required: false, example: 'ext_user_001' },
      { name: 'user_email', label: 'E-mail do aluno', required: true, example: 'mariana@example.com' },
      { name: 'course_external_id', label: 'ID curso', required: false, example: 'ext_course_psi' },
      { name: 'lesson_external_id', label: 'ID aula', required: false, example: 'ext_les_001' },
      { name: 'topic_external_id', label: 'ID tópico (LD)', required: false, example: '' },
      { name: 'completed_at', label: 'Concluído em (ISO)', required: false, example: '2026-04-12T17:30:00Z' },
      { name: 'progress_percentage', label: 'Progresso 0-100', required: false, example: '100' },
      { name: 'status', label: 'started/in_progress/completed', required: false, example: 'completed' },
      { name: 'last_access_at', label: 'Último acesso', required: false, example: '2026-04-12T17:30:00Z' },
    ],
  },
};

// ---------- Geração ----------

function escapeCell(v: string): string {
  // RFC 4180: aspas duplas escapadas como ""
  if (v.includes('"') || v.includes(',') || v.includes('\n') || v.includes('\r')) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

/**
 * Gera CSV template (UTF-8 com BOM, RFC 4180) com cabeçalhos +
 * 1 linha exemplo + 1 linha vazia (pronta pra preencher).
 */
export function generateCsvTemplate(entity: ImportEntityType): string {
  const tpl = CSV_TEMPLATES[entity];
  const headers = tpl.fields.map((f) => f.name).join(',');
  const example = tpl.fields.map((f) => escapeCell(f.example ?? '')).join(',');
  const empty = tpl.fields.map(() => '').join(',');
  return `﻿${headers}\r\n${example}\r\n${empty}\r\n`;
}

export function listAllTemplates(): EntityTemplate[] {
  return Object.values(CSV_TEMPLATES);
}

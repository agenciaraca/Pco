// Helper de confirmação textual para ações destrutivas.
// Cliente envia header X-Confirm-Name com o nome exato do recurso a ser deletado.

import type { Context } from 'hono';

export function readConfirmHeader(c: Context): string {
  return c.req.header('x-confirm-name')?.trim() ?? '';
}

/**
 * Compara case-insensitive ignorando espaços extras. Use o nome HUMANO do
 * recurso (email do usuário, nome do produto, etc.) — não o id.
 */
export function confirmMatches(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  return norm(provided) === norm(expected);
}

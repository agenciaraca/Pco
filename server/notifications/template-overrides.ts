// Customizações de templates de e-mail por admin: subject, cor primária,
// logo, footer, organização. Não permite reescrever o body HTML inteiro
// (proteção contra XSS + manutenibilidade); só overrides estruturados.
//
// Os render*() em ./templates.ts checam loadOverride() antes de aplicar
// defaults pra cada slot.

import { JsonStore } from '../db/json-store';

export interface TemplateOverride {
  /** Nome do template (password_reset, order_paid, etc.). */
  name: string;
  /** Assunto do e-mail. Templates suportam {{name}}, {{course}}, etc. */
  subject?: string;
  /** Mensagem extra exibida no topo (acima do conteúdo gerado). */
  greeting?: string;
  /** Mensagem extra no rodapé (abaixo do CTA). */
  footerNote?: string;
  /** Cor primária #RRGGBB (botões + headers). Default: cor PCO. */
  brandColor?: string;
  /** URL pública do logo (PNG/SVG). */
  logoUrl?: string;
  /** Nome da organização (rodapé). */
  orgName?: string;
}

const store = new JsonStore<TemplateOverride>(
  'email-template-overrides.json',
  () => [],
);

export async function listOverrides(): Promise<TemplateOverride[]> {
  return await store.getAll();
}

export async function getOverride(
  name: string,
): Promise<TemplateOverride | null> {
  const all = await store.getAll();
  return all.find((o) => o.name === name) ?? null;
}

export async function setOverride(
  name: string,
  patch: Omit<TemplateOverride, 'name'>,
): Promise<TemplateOverride> {
  const all = await store.getAll();
  const idx = all.findIndex((o) => o.name === name);
  // Limpa campos vazios — undefined fica como "use default"
  const clean: TemplateOverride = { name };
  for (const [k, v] of Object.entries(patch)) {
    if (typeof v === 'string' && v.trim() !== '') {
      clean[k as keyof TemplateOverride] = v.trim() as never;
    }
  }
  if (idx === -1) {
    await store.unshift(clean);
  } else {
    await store.update(
      (o) => o.name === name,
      () => clean,
    );
  }
  return clean;
}

export async function deleteOverride(name: string): Promise<boolean> {
  const exists = await getOverride(name);
  if (!exists) return false;
  await store.modify((arr) => {
    const idx = arr.findIndex((o) => o.name === name);
    if (idx >= 0) arr.splice(idx, 1);
  });
  return true;
}

export async function _resetForTests(): Promise<void> {
  await store.setAll([]);
}

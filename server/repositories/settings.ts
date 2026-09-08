// Configurações gerais do AVA — persiste em data/settings.json.

import { JsonStore } from '../db/json-store';

export interface AppSettings {
  siteName: string;
  contactEmail: string;
  timezone: string;
  cookiePolicyText: string;
  termsUrl: string;
  privacyUrl: string;
  helpEmail: string;
  whatsappNumber: string;
  updatedAt: string;
}

const DEFAULTS: AppSettings = {
  siteName: 'AVA PCO — Psicanálise Clínica Online',
  contactEmail: 'contato@psicanaliseclinica.online',
  timezone: 'America/Sao_Paulo',
  cookiePolicyText:
    'Usamos cookies para melhorar sua experiência. Ao continuar navegando, você concorda com nossa Política de Privacidade.',
  termsUrl: '/termos',
  privacyUrl: '/privacidade',
  helpEmail: 'suporte@psicanaliseclinica.online',
  whatsappNumber: '',
  updatedAt: new Date(0).toISOString(),
};

const store = new JsonStore<AppSettings>('settings.json', () => [{ ...DEFAULTS }]);

export async function getSettings(): Promise<AppSettings> {
  const all = await store.getAll();
  if (all.length > 0) return all[0]!;
  await store.setAll([{ ...DEFAULTS }]);
  return { ...DEFAULTS };
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  /*
    Configuracao de uma linha tambem e leitura-seguida-de-escrita.

    O CLAUDE.md dizia que `setAll([cfg])` era "substituicao deliberada" e
    ficava fora da varredura de 7/set. Isso vale para `setAll([])` e para quem
    monta a linha inteira a partir da entrada — nao para um patch mesclado
    sobre o que estava la. Dois admins salvando abas diferentes de
    `/admin/settings` ao mesmo tempo: o segundo grava por cima da base velha
    que leu, e a mudanca do primeiro some sem erro.
  */
  return store.modify((items) => {
    const atual = items[0] ?? { ...DEFAULTS };
    const next: AppSettings = { ...atual, ...patch, updatedAt: new Date().toISOString() };
    items.length = 0;
    items.push(next);
    return next;
  });
}

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
  const current = await getSettings();
  const next: AppSettings = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await store.setAll([next]);
  return next;
}

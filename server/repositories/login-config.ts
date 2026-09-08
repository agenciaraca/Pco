// Customização do Login — persiste em data/login-config.json.
// Endpoint público apenas lê (sem auth). Admin escreve.

import { JsonStore } from '../db/json-store';

export interface LoginConfig {
  tag: string;
  title: string;
  subtitle: string;
  fromColor: string;
  viaColor: string;
  toColor: string;
  position: 'left' | 'right';
  theme: 'light' | 'dark';
  logoUrl: string | null;
  updatedAt: string;
}

const DEFAULTS: LoginConfig = {
  tag: 'Ambiente Virtual de Aprendizagem',
  title: 'Sua formação organizada em uma experiência de aprendizagem moderna.',
  subtitle:
    'Cursos, jornada de estudos, biblioteca, PCO News, PCO POD, Tutor Virtual e certificados em um só ambiente.',
  fromColor: '#063B49',
  viaColor: '#0097B2',
  toColor: '#0CC0DF',
  position: 'right',
  theme: 'light',
  logoUrl: null,
  updatedAt: new Date(0).toISOString(),
};

// Armazenamos como array de 1 elemento pra reaproveitar JsonStore<T>.
const store = new JsonStore<LoginConfig>('login-config.json', () => [{ ...DEFAULTS }]);

export async function getConfig(): Promise<LoginConfig> {
  const all = await store.getAll();
  if (all.length > 0) return all[0]!;
  await store.setAll([{ ...DEFAULTS }]);
  return { ...DEFAULTS };
}

export async function updateConfig(patch: Partial<LoginConfig>): Promise<LoginConfig> {
  // Patch mesclado sobre o que esta gravado — ver a nota em
  // `repositories/settings.ts`: isto e leitura-seguida-de-escrita, e o par
  // `getAll`+`setAll` perde a gravacao concorrente sem dar erro.
  return store.modify((items) => {
    const atual = items[0] ?? { ...DEFAULTS };
    const next: LoginConfig = { ...atual, ...patch, updatedAt: new Date().toISOString() };
    items.length = 0;
    items.push(next);
    return next;
  });
}

export async function resetConfig(): Promise<LoginConfig> {
  const next = { ...DEFAULTS, updatedAt: new Date().toISOString() };
  await store.setAll([next]);
  return next;
}

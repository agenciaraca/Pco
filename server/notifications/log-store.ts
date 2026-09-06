// Log de envios — cap em 1000 entradas, mais antigas são descartadas.

import crypto from 'node:crypto';
import { JsonStore } from '../db/json-store';
import type { EmailLog } from './types';

const MAX = 1000;
const store = new JsonStore<EmailLog>('email-logs.json', () => []);

function newId(): string {
  return `eml-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

export async function listLogs(limit = 200): Promise<EmailLog[]> {
  const all = await store.getAll();
  return [...all]
    .sort((a, b) => (b.ts > a.ts ? 1 : -1))
    .slice(0, Math.max(1, Math.min(limit, MAX)));
}

export async function pushLog(log: Omit<EmailLog, 'id' | 'ts'>): Promise<EmailLog> {
  const entry: EmailLog = {
    id: newId(),
    ts: new Date().toISOString(),
    ...log,
  };
  const all = await store.getAll();
  const next = [entry, ...all].slice(0, MAX);
  await store.setAll(next);
  return entry;
}

/**
 * Os e-mails enviados para um endereço — para a exportação e para o expurgo.
 *
 * `EmailLog.to` é o endereço do destinatário, e o `subject` diz o que a escola
 * comunicou a ele. Isso é dado pessoal, e ficou fora das duas pontas até
 * 5/set/2026 — o expurgo declarava a conta anonimizada enquanto a fila de
 * e-mails continuava dizendo quem recebeu o quê e quando.
 *
 * A chave é o e-mail, não o `userId`: o log é escrito pelo remetente, que só
 * conhece o endereço.
 */
export async function listForEmail(email: string): Promise<EmailLog[]> {
  const alvo = email.trim().toLowerCase();
  if (!alvo) return [];
  const all = await store.getAll();
  return all.filter((l) => l.to.trim().toLowerCase() === alvo);
}

/** Apaga os registros de envio para um endereço. Devolve quantos saíram. */
export async function clearForEmail(email: string): Promise<number> {
  const alvo = email.trim().toLowerCase();
  if (!alvo) return 0;
  // `modify` em vez de `getAll` + `setAll`: o par perde escrita concorrente
  // ocorrida entre as duas chamadas, e este store recebe uma linha por e-mail
  // enviado — é dos mais movimentados do sistema.
  return await store.modify((items) => {
    const antes = items.length;
    const restantes = items.filter((l) => l.to.trim().toLowerCase() !== alvo);
    items.length = 0;
    items.push(...restantes);
    return antes - items.length;
  });
}

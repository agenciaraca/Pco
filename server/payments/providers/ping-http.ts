// Um GET barato que prova que o gateway responde e ainda aceita a credencial.
//
// Duas regras que qualquer ping daqui tem de respeitar:
//
// - **Nunca cobra ninguém.** Testar conexão não pode criar cobrança, nem no
//   modo `live` nem no `test`. Todo ping é leitura.
// - **Lê o mesmo recurso que o checkout escreve.** Chave que enxerga pedido é
//   chave que consegue criar pedido; o contrário não vale para chave restrita,
//   e um ping que consulta outro recurso pode dizer "OK" para uma credencial
//   que não consegue vender.

import type { PingResult } from './types';

/** Tempo esgotado é resposta: sem isto o botão de teste ficaria pendurado. */
const TIMEOUT_MS = 10_000;

export async function pingHttp(
  url: string,
  init: RequestInit,
  rotulo: string,
): Promise<PingResult> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    // Nem chegou a falar com o gateway: DNS, TLS, rede caída ou tempo esgotado.
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, alcancou: false, message: `${rotulo}: não deu para falar (${msg}).` };
  }

  if (res.ok) {
    return { ok: true, alcancou: true, message: `${rotulo} respondeu e aceitou a credencial.` };
  }

  if (res.status === 401 || res.status === 403) {
    return {
      ok: false,
      alcancou: true,
      message:
        `${rotulo} recusou a credencial (HTTP ${res.status}). ` +
        'Confira a chave e se o modo (test/live) bate com ela.',
    };
  }

  const corpo = (await res.text().catch(() => '')).slice(0, 180).replace(/\s+/g, ' ').trim();
  return {
    ok: false,
    alcancou: true,
    message: `${rotulo} respondeu HTTP ${res.status}.${corpo ? ` ${corpo}` : ''}`,
  };
}

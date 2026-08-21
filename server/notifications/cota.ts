/**
 * Quanto o provedor de e-mail ainda deixa enviar hoje.
 *
 * Serve para não disparar às cegas: o plano gratuito do Brevo dá 300 envios por
 * dia, e o convite de primeiro acesso tem 507 destinatários. Sem essa conta na
 * tela, o admin manda tudo, uns duzentos falham por cota e ninguém percebe —
 * envio de e-mail é best-effort e não derruba nada.
 */

import * as configStore from './config-store';
import { decryptApiKey } from '../db/encryption';

export interface CotaEmail {
  provider: string;
  /** Envios restantes, quando o provedor informa. */
  restantes: number | null;
  /** Mensagem curta para a interface; null quando está tudo bem. */
  aviso: string | null;
}

/**
 * Consulta só de leitura, tolerante a falha: se o provedor não responder, a tela
 * segue funcionando sem o número — nunca ao contrário.
 */
export async function consultarCota(): Promise<CotaEmail | null> {
  const cfg = await configStore.getActiveConfig();
  if (!cfg) return { provider: 'nenhum', restantes: 0, aviso: 'Nenhum provedor de e-mail ligado.' };

  const cifrada = (cfg as { apiKeyEncrypted?: string }).apiKeyEncrypted;
  if (cfg.provider !== 'brevo' || !cifrada) {
    return { provider: cfg.provider, restantes: null, aviso: null };
  }

  try {
    const chave = decryptApiKey(cifrada);
    const r = await fetch('https://api.brevo.com/v3/account', {
      headers: { 'api-key': chave, accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) {
      const corpo = await r.text();
      const ip = corpo.match(/unrecognised IP address ([^.\s"]+(?:[.:][^.\s",]+)*)/i);
      return {
        provider: cfg.provider,
        restantes: 0,
        aviso: ip
          ? `O provedor recusa este servidor: autorize o IP ${ip[1]} no painel do Brevo. Nenhum e-mail sai enquanto isso.`
          : `O provedor recusou a conexão (HTTP ${r.status}). Nenhum e-mail sai enquanto isso.`,
      };
    }
    const conta = (await r.json()) as { plan?: Array<{ credits?: number }> };
    const restantes = (conta.plan ?? []).reduce((s, p) => s + (p.credits ?? 0), 0);
    return { provider: cfg.provider, restantes, aviso: null };
  } catch {
    // Sem resposta do provedor: melhor não afirmar nada do que afirmar errado.
    return { provider: cfg.provider, restantes: null, aviso: null };
  }
}

/**
 * Diagnóstico do provedor de e-mail — sem enviar nada.
 *
 * Existe porque a falha de e-mail é silenciosa por natureza: o envio é
 * best-effort, a aplicação segue funcionando e ninguém percebe até alguém
 * reclamar que não recebeu. Em produção, os dez últimos envios registrados
 * falharam — dois deles eram pessoas de verdade pedindo recuperação de senha em
 * junho e julho.
 *
 * A causa foi o Brevo recusar o IP do servidor. Como o AVA mudou de máquina em
 * julho, o IP autorizado ficou para trás; a mensagem de erro traz o IP atual,
 * que é justamente o que precisa ser liberado no painel do provedor.
 *
 * Só faz leitura: consulta a conta e a cota. Nenhum e-mail sai daqui.
 *
 * Uso (no VPS, dentro de ~/ava-pco):
 *   npx tsx scripts/diagnostico_email.ts
 */

import * as configStore from '../server/notifications/config-store';
import { decryptApiKey } from '../server/db/encryption';

const log = (m: string) => console.log(`[diag-email] ${m}`);

async function main(): Promise<void> {
  const publicos = await configStore.listConfigs();
  log(`provedores cadastrados: ${publicos.length}`);
  for (const p of publicos) {
    log(`  ${p.provider} · ${p.enabled ? 'ligado' : 'desligado'} · chave: ${p.hasApiKey ? 'sim' : 'não'}`);
  }

  // A visão pública esconde a chave de propósito; para falar com o provedor é
  // preciso a configuração ativa inteira.
  const ativa = await configStore.getActiveConfig();
  if (!ativa) {
    log('');
    log('NENHUM provedor ligado — nenhum e-mail sai, incluindo recuperação de senha.');
    process.exitCode = 1;
    return;
  }

  log('');
  for (const cfg of [ativa]) {
    const ligado = (cfg as { enabled?: boolean }).enabled;
    log(`provedor: ${cfg.provider} · ${ligado ? 'ligado' : 'DESLIGADO'}`);
    log(`remetente: ${cfg.fromName ?? ''} <${cfg.fromEmail ?? '?'}>`);
    const ultimo = (cfg as { lastTestedAt?: string; lastTestStatus?: string }).lastTestedAt;
    if (ultimo) {
      log(`último teste: ${ultimo} · ${(cfg as { lastTestStatus?: string }).lastTestStatus ?? '?'}`);
    }

    const cifrada = (cfg as { apiKeyEncrypted?: string }).apiKeyEncrypted;
    if (!cifrada) {
      log('  sem chave de API guardada — o envio não tem como funcionar');
      process.exitCode = 1;
      continue;
    }

    let chave: string;
    try {
      chave = decryptApiKey(cifrada);
    } catch (err) {
      log(`  a chave não pôde ser decifrada: ${err instanceof Error ? err.message : err}`);
      log('  (AI_KEY_ENCRYPTION_SECRET diferente do usado para salvar?)');
      process.exitCode = 1;
      continue;
    }

    if (cfg.provider !== 'brevo') {
      log(`  diagnóstico automático ainda só cobre o Brevo; ${cfg.provider} exige checagem manual`);
      continue;
    }

    // Só leitura: /v3/account não envia e-mail nenhum.
    const r = await fetch('https://api.brevo.com/v3/account', {
      headers: { 'api-key': chave, accept: 'application/json' },
    });
    const corpo = await r.text();

    if (r.ok) {
      const conta = JSON.parse(corpo) as {
        email?: string;
        companyName?: string;
        plan?: Array<{ type?: string; credits?: number }>;
      };
      log(`  conta aceita: ${conta.email ?? '?'} (${conta.companyName ?? '-'})`);
      for (const p of conta.plan ?? []) {
        log(`  plano ${p.type ?? '?'} · créditos: ${p.credits ?? '?'}`);
      }
      const creditos = (conta.plan ?? []).reduce((s, p) => s + (p.credits ?? 0), 0);
      if (creditos > 0 && creditos < 600) {
        log(`  ATENÇÃO: ${creditos} crédito(s) — insuficiente para os 507 convites`);
      }
      log('  RESULTADO: o provedor aceita este servidor.');
      continue;
    }

    log(`  RESULTADO: provedor recusou (HTTP ${r.status})`);
    const ipBloqueado = corpo.match(/unrecognised IP address ([^.\s"]+(?:[.:][^.\s",]+)*)/i);
    if (ipBloqueado) {
      log('');
      log(`  >>> O IP DESTE SERVIDOR NÃO ESTÁ AUTORIZADO: ${ipBloqueado[1]}`);
      log('  >>> Autorize em https://app.brevo.com/security/authorised_ips');
      log('  >>> Enquanto isso, NENHUM e-mail sai: nem convite, nem recuperação de senha.');
    } else {
      log(`  detalhe: ${corpo.slice(0, 300)}`);
    }
    process.exitCode = 1;
  }
}

void main();

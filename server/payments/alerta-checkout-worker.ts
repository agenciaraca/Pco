import * as usersStore from '../auth/users-store';
import { sendSafe } from '../notifications/sender';
import { recordAuditDirect } from '../audit/log';
import { avaliarCheckout, resumoLegivel, type SaudeDoCheckout } from './saude-do-checkout';

/**
 * Avisa quando a venda para de passar.
 *
 * ## Por que existe
 *
 * Entre 3 e 5/set/2026 **toda** compra falhou — a conta do Pagar.me não tinha o
 * produto Checkout habilitado — e a escola só soube dois dias depois, quando
 * alguém abriu `/admin/pedidos` por outro motivo. Nesse intervalo havia
 * campanha paga rodando: o dinheiro do anúncio saía e a compra não fechava.
 *
 * O botão de testar gateway não pega esse caso, e não é falha dele: ele lê
 * credencial, e a credencial estava boa. "Produto não habilitado" só aparece na
 * cobrança real. **O único sinal era a fila de pedidos falhando**, e sinal que
 * depende de alguém abrir uma tela não é detecção.
 *
 * ## Três decisões que qualquer mexida aqui tem de respeitar
 *
 * - **Silêncio quando não há base.** Sem tentativas suficientes na janela,
 *   `taxaFalhaPct` é `null` e nada é enviado. Alarme que dispara com 1 pedido
 *   abandonado num domingo é alarme que se aprende a ignorar — e aí ele não
 *   serve para o dia em que importa.
 * - **Um aviso por episódio, não um por tique.** Enquanto a condição persistir,
 *   não se manda de novo; o próximo só sai depois de a saúde voltar. Vinte
 *   e-mails iguais viram filtro de caixa de entrada.
 * - **A volta também é notícia.** Quem recebeu "a venda está quebrada" precisa
 *   saber que voltou, senão fica conferindo à mão — que é exatamente o trabalho
 *   que este worker existe para tirar de alguém.
 */

let timer: NodeJS.Timeout | null = null;
let ultimoEstado: 'ok' | 'alerta' | null = null;
let ultimoAvisoEm: string | null = null;
let ultimaAvaliacao: SaudeDoCheckout | null = null;
let ultimoErro: string | null = null;

const INTERVALO_PADRAO = 15 * 60_000;

async function admins() {
  const todos = await usersStore.listUsers();
  return todos.filter((u) => u.active && (u.role === 'admin' || u.role === 'superadmin'));
}

function corpo(s: SaudeDoCheckout, voltou: boolean): { subject: string; html: string } {
  const subject = voltou
    ? 'AVA PCO — o checkout voltou a funcionar'
    : '🔴 AVA PCO — a venda está falhando';

  const acao = voltou
    ? '<p style="margin:12px 0 0">Nada a fazer. Este aviso existe para você não ficar conferindo à mão.</p>'
    : `<p style="margin:12px 0 0"><strong>O que conferir, nesta ordem:</strong></p>
       <ol style="margin:6px 0 0;padding-left:18px">
         <li>O motivo acima — ele costuma dizer exatamente o que está errado.</li>
         <li><code>/admin/pedidos</code>, filtrando por falhos, para ver se é uma pessoa só ou todas.</li>
         <li><code>/admin/gateways</code>: o botão <em>Testar</em> confere a credencial. <strong>Ele não pega
             "produto não habilitado na conta"</strong> — isso só aparece na cobrança real.</li>
         <li>Se houver campanha paga apontando para o site, pausá-la enquanto o checkout não voltar.</li>
       </ol>`;

  const html = `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:system-ui,-apple-system,'Segoe UI',sans-serif">
<div style="max-width:600px;margin:24px auto;background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">
  <div style="background:${voltou ? '#15803d' : '#dc2626'};color:#fff;padding:16px 20px">
    <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.85">AVA PCO · Saúde do checkout</div>
    <h1 style="margin:6px 0 0;font-size:18px;font-weight:700">${voltou ? 'Voltou a funcionar' : 'A venda está falhando'}</h1>
  </div>
  <div style="padding:16px 20px;font-size:14px;color:#0f172a;line-height:1.6">
    <p style="margin:0">${escapar(resumoLegivel(s))}</p>
    ${
      s.gatewaysComFalha.length > 0
        ? `<p style="margin:8px 0 0;color:#64748b;font-size:13px">Gateway(s): ${escapar(s.gatewaysComFalha.join(', '))}</p>`
        : ''
    }
    ${acao}
  </div>
  <div style="padding:12px 20px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8">
    Medido em ${new Date().toLocaleString('pt-BR')} · janela de ${s.janelaHoras}h
  </div>
</div>
</body></html>`;
  return { subject, html };
}

function escapar(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface ResultadoDaChecagem {
  saude: SaudeDoCheckout;
  /** Mudou de estado nesta rodada? Só a mudança dispara e-mail. */
  mudou: boolean;
  enviados: number;
  falhasDeEnvio: number;
}

/**
 * Roda a checagem uma vez.
 *
 * `dryRun` mede e não envia — é o que `/admin/jobs/:id/run?dryRun=true` chama, e
 * é como se confere o limiar sem escrever para ninguém.
 */
export async function checarAgora(
  opts: { dryRun?: boolean } = {},
): Promise<ResultadoDaChecagem> {
  const saude = await avaliarCheckout();
  ultimaAvaliacao = saude;

  // Sem base para medir não é "ok" nem "alerta": é não saber. Não muda o estado
  // anterior, e portanto não dispara nem o aviso nem o "voltou".
  if (saude.taxaFalhaPct === null) {
    return { saude, mudou: false, enviados: 0, falhasDeEnvio: 0 };
  }

  const estado: 'ok' | 'alerta' = saude.alerta ? 'alerta' : 'ok';
  const mudou = ultimoEstado !== null && ultimoEstado !== estado;
  const primeiraVezRuim = ultimoEstado === null && estado === 'alerta';

  if (!mudou && !primeiraVezRuim) {
    ultimoEstado = estado;
    return { saude, mudou: false, enviados: 0, falhasDeEnvio: 0 };
  }

  if (opts.dryRun) {
    return { saude, mudou: true, enviados: 0, falhasDeEnvio: 0 };
  }

  const voltou = estado === 'ok';
  const { subject, html } = corpo(saude, voltou);
  let enviados = 0;
  let falhasDeEnvio = 0;
  for (const u of await admins()) {
    const r = await sendSafe({
      to: { email: u.email, name: u.name },
      subject,
      html,
      tag: 'checkout-alerta',
    });
    if (r.ok) enviados++;
    else falhasDeEnvio++;
  }

  ultimoEstado = estado;
  ultimoAvisoEm = new Date().toISOString();

  // Fica no log de auditoria porque é evento de negócio, não só de sistema:
  // depois se quer saber quando a venda parou e quando voltou.
  await recordAuditDirect({
    actorEmail: 'sistema',
    action: voltou ? 'checkout.recuperado' : 'checkout.falhando',
    targetType: 'checkout',
    meta: {
      taxaFalhaPct: saude.taxaFalhaPct,
      tentativas: saude.tentativas,
      falhas: saude.falhas,
      motivo: saude.motivoMaisComum,
      avisados: enviados,
    },
  }).catch(() => {});

  return { saude, mudou: true, enviados, falhasDeEnvio };
}

export function startWorker(intervalMs = INTERVALO_PADRAO): void {
  // Idempotente, como todo `startWorker` deste projeto: uma segunda chamada
  // criaria um segundo intervalo, e aqui isso dobraria o e-mail de alerta.
  if (timer) return;
  const tick = async () => {
    try {
      await checarAgora();
      ultimoErro = null;
    } catch (err) {
      // O `catch` não é vazio de propósito: este worker é o único aviso
      // automático de que a venda parou. Falhar em silêncio o transformaria
      // exatamente no problema que ele existe para resolver.
      ultimoErro = err instanceof Error ? err.message : String(err);
      console.error('[checkout-alerta] erro:', err);
    }
  };
  timer = setInterval(() => void tick(), intervalMs);
  void tick();
}

export function stopWorker(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export function getStatus() {
  return {
    enabled: timer !== null,
    estado: ultimoEstado,
    ultimoAvisoEm,
    ultimaAvaliacao,
    // `saudavel` é sobre o worker, não sobre o checkout: diz se a medição está
    // conseguindo rodar. Os dois são perguntas diferentes.
    saudavel: ultimoErro === null,
    ultimoErro,
  };
}

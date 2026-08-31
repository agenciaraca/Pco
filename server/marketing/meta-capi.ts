/**
 * Conversão pelo servidor — o evento de compra que o pixel do navegador perde.
 *
 * ## Por que existe
 *
 * O pixel no navegador mede o que consegue: bloqueador de anúncio, aba fechada
 * no meio do redirecionamento para o gateway e Safari cortando cookie de
 * terceiro derrubam uma parte grande das compras. E o nosso fluxo é justamente
 * o pior caso — quem paga sai do site para a página do provedor e muitas vezes
 * não volta. O resultado é anúncio pago otimizando com metade da informação.
 *
 * Este módulo manda o `Purchase` do **servidor**, no instante em que o pedido
 * vira pago — que é o único lugar onde a compra é fato, e não intenção.
 *
 * ## As decisões que importam
 *
 * **`event_id` é o id do pedido.** É o que permite ao Meta juntar este evento
 * com o que o pixel do navegador mandou, em vez de contar a mesma compra duas
 * vezes. Sem ele, ligar a conversão pelo servidor infla o resultado e faz o
 * anúncio parecer melhor do que é.
 *
 * **Nada de PII em claro.** E-mail, telefone e nome vão em SHA-256, como o Meta
 * exige — normalizados antes (minúsculas, sem espaço, telefone só com dígitos),
 * porque hash de texto não normalizado não casa com nada e vira dado enviado
 * à toa.
 *
 * **Nasce desligado.** Mandar dado de comprador para um terceiro é decisão de
 * dono, não padrão de fábrica: `enviarConversaoServidor` começa `false` e só
 * liga em `/admin/marketing`. Sem token e sem pixel, este módulo não faz nada.
 *
 * **Falha não derruba a compra.** O envio é best-effort e registrado; se o Meta
 * estiver fora, o aluno continua matriculado. Perder uma métrica é ruim; perder
 * uma matrícula por causa de uma métrica seria pior.
 */

import crypto from 'node:crypto';
import type { Order } from '../payments/types';
import { getTags } from './tags-store';
import { decryptApiKey } from '../db/encryption';

const VERSAO_API = 'v21.0';

/** SHA-256 do valor normalizado, como o Meta pede. Vazio vira `undefined`. */
function hash(valor: string | null | undefined, normalizar: (s: string) => string): string | undefined {
  if (!valor) return undefined;
  const n = normalizar(valor);
  if (!n) return undefined;
  return crypto.createHash('sha256').update(n).digest('hex');
}

const email = (s: string) => s.trim().toLowerCase();
const telefone = (s: string) => {
  const d = s.replace(/\D/g, '');
  if (!d) return '';
  // O Meta espera o número com código do país. 11 dígitos = celular brasileiro
  // sem o 55 na frente; acrescentar é o que faz o casamento acontecer.
  return d.length <= 11 ? `55${d}` : d;
};
const nome = (s: string) => s.trim().toLowerCase();

export interface CompradorParaConversao {
  email?: string | null;
  nome?: string | null;
  telefone?: string | null;
}

interface Resultado {
  enviado: boolean;
  motivo?: string;
}

/**
 * Manda um `Purchase` pelo servidor. Silencioso quando não está configurado —
 * chamar sem ter ligado nada é o caso normal, não um erro.
 */
export async function enviarCompra(
  pedido: Order,
  comprador: CompradorParaConversao,
): Promise<Resultado> {
  const t = await getTags();
  if (!t.ativo || !t.enviarConversaoServidor) return { enviado: false, motivo: 'desligado' };
  if (!t.metaPixelId || !t.metaCapiToken) return { enviado: false, motivo: 'sem_credencial' };

  let token: string;
  try {
    token = decryptApiKey(t.metaCapiToken);
  } catch {
    return { enviado: false, motivo: 'token_ilegivel' };
  }
  if (!token) return { enviado: false, motivo: 'sem_credencial' };

  const userData: Record<string, string[]> = {};
  const em = hash(comprador.email ?? pedido.userEmail, email);
  const ph = hash(comprador.telefone, telefone);
  const fn = hash(comprador.nome?.split(/\s+/)[0], nome);
  if (em) userData.em = [em];
  if (ph) userData.ph = [ph];
  if (fn) userData.fn = [fn];
  // Sem nenhum identificador o Meta descarta o evento — e mandar assim é gastar
  // requisição para não medir nada.
  if (Object.keys(userData).length === 0) return { enviado: false, motivo: 'sem_identificador' };

  const corpo = {
    data: [
      {
        event_name: 'Purchase',
        event_time: Math.floor(new Date(pedido.paidAt ?? pedido.updatedAt).getTime() / 1000),
        // O id do pedido é a chave de deduplicação com o pixel do navegador.
        event_id: pedido.id,
        action_source: 'website',
        user_data: userData,
        custom_data: {
          currency: pedido.currency,
          value: pedido.amountCents / 100,
          content_type: 'product',
          content_ids: [pedido.productId],
          content_name: pedido.productSnapshot?.name ?? '',
        },
      },
    ],
  };

  try {
    const r = await fetch(
      `https://graph.facebook.com/${VERSAO_API}/${encodeURIComponent(t.metaPixelId)}/events?access_token=${encodeURIComponent(token)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(corpo),
      },
    );
    if (!r.ok) {
      const texto = await r.text().catch(() => '');
      return { enviado: false, motivo: `http_${r.status} ${texto.slice(0, 200)}` };
    }
    return { enviado: true };
  } catch (err) {
    return { enviado: false, motivo: err instanceof Error ? err.message : 'erro' };
  }
}

/** Só para o teste e para o painel: mostra o que seria enviado, sem enviar. */
export function montarUserData(comprador: CompradorParaConversao): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const em = hash(comprador.email, email);
  const ph = hash(comprador.telefone, telefone);
  const fn = hash(comprador.nome?.split(/\s+/)[0], nome);
  if (em) out.em = [em];
  if (ph) out.ph = [ph];
  if (fn) out.fn = [fn];
  return out;
}

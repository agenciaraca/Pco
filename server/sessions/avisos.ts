/**
 * Avisos de sessão — o que o aluno recebe quando algo muda no agendamento.
 *
 * A tela do aluno diz, desde sempre, que "a coordenação confirma e envia o link
 * da reunião". Até 26/ago/2026 isso dependia de alguém lembrar de escrever um
 * e-mail à mão: o admin marcava `confirmed`, colava o link, e nada saía. Este
 * módulo fecha essa ponta.
 *
 * Duas escolhas que valem registro:
 *
 * 1. **Notificação no ambiente sempre, e-mail quando há o que dizer.** E-mail
 *    pode não chegar, cair em spam ou ser ignorado; a notificação fica lá para
 *    quem entrar. Por isso as duas coisas, não uma.
 * 2. **Avisar nunca derruba a operação.** Falha de envio é registrada e
 *    engolida: um gateway de e-mail fora do ar não pode fazer o admin
 *    receber 500 ao confirmar uma sessão que já está confirmada no banco.
 */

import * as notificationsRepo from '../repositories/notifications';
import { sendSafe } from '../notifications/sender';
import * as usersStore from '../auth/users-store';
import type { SessionBooking } from './bookings-repo';

const DESTINO = '/analise-supervisao';

function escapar(t: string): string {
  return t.replace(
    /[&<>"']/g,
    (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m] as string,
  );
}

function quando(booking: SessionBooking): string {
  return new Date(booking.scheduledFor).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  });
}

function moeda(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface Aviso {
  assunto: string;
  titulo: string;
  corpo: string;
  categoria: 'info' | 'success' | 'warning';
}

/** O texto de cada momento. Um lugar só, para não divergirem com o tempo. */
export function textoDe(
  evento: 'criada' | 'confirmada' | 'cancelada' | 'remarcada',
  booking: SessionBooking,
): Aviso {
  const com = `${booking.serviceName} com ${booking.professionalName}`;
  switch (evento) {
    case 'criada':
      return {
        assunto: `Sessão reservada — ${com}`,
        titulo: 'Sessão reservada',
        corpo:
          booking.status === 'pending_payment'
            ? `Sua sessão de ${com} em ${quando(booking)} está reservada aguardando o pagamento de ${moeda(booking.priceCents)}. Ela é confirmada assim que o pagamento for aprovado.`
            : `Sua sessão de ${com} está marcada para ${quando(booking)}. A coordenação confirma e envia o link da reunião.`,
        categoria: 'info',
      };
    case 'confirmada':
      return {
        assunto: `Sessão confirmada — ${com}`,
        titulo: 'Sessão confirmada',
        corpo: booking.meetingLink
          ? `Sua sessão de ${com} está confirmada para ${quando(booking)}. O link da reunião é ${booking.meetingLink}`
          : `Sua sessão de ${com} está confirmada para ${quando(booking)}. O link da reunião chega antes do horário.`,
        categoria: 'success',
      };
    case 'cancelada':
      return {
        assunto: `Sessão cancelada — ${com}`,
        titulo: 'Sessão cancelada',
        corpo: `Sua sessão de ${com}, que estava marcada para ${quando(booking)}, foi cancelada${
          booking.cancelReason ? `: ${booking.cancelReason}` : '.'
        }`,
        categoria: 'warning',
      };
    case 'remarcada':
      return {
        assunto: `Sessão remarcada — ${com}`,
        titulo: 'Sessão remarcada',
        corpo: `Sua sessão de ${com} passou para ${quando(booking)}.`,
        categoria: 'info',
      };
  }
}

/**
 * Notifica o aluno. Nunca lança: quem chama está no meio de uma operação que
 * já deu certo, e falhar o aviso não pode desfazê-la.
 */
export async function avisar(
  evento: 'criada' | 'confirmada' | 'cancelada' | 'remarcada',
  booking: SessionBooking,
): Promise<{ notificado: boolean; emailEnviado: boolean }> {
  const { assunto, titulo, corpo, categoria } = textoDe(evento, booking);
  let notificado = false;
  let emailEnviado = false;

  try {
    await notificationsRepo.createOne({
      userId: booking.userId,
      title: titulo,
      body: corpo,
      category: categoria,
      link: DESTINO,
      authorEmail: 'sistema',
    });
    notificado = true;
  } catch (err) {
    console.error('[sessoes/avisos] notificação falhou:', err);
  }

  try {
    const user = await usersStore.findUserById(booking.userId);
    const email = user?.email ?? booking.userEmail;
    if (email) {
      const base = process.env.PUBLIC_ORIGIN ?? 'https://ava.psicanaliseclinica.online';
      const r = await sendSafe({
        to: { email, name: user?.name ?? '' },
        subject: assunto,
        html: [
          `<p>Olá${user?.name ? `, ${escapar(user.name)}` : ''}.</p>`,
          `<p>${escapar(corpo)}</p>`,
          `<p><a href="${escapar(base + DESTINO)}">Ver minhas sessões</a></p>`,
        ].join('\n'),
        tag: `session-${evento}`,
      });
      emailEnviado = r.ok;
      if (!r.ok) console.error('[sessoes/avisos] e-mail falhou:', r.error);
    }
  } catch (err) {
    console.error('[sessoes/avisos] envio falhou:', err);
  }

  return { notificado, emailEnviado };
}

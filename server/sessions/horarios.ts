/**
 * Os horários que o aluno vê ao marcar uma sessão.
 *
 * Até 27/ago/2026 essa lista vivia dentro do `.tsx`, sob o título "Horários
 * disponíveis", e não consultava nada: os oito horários apareciam sempre,
 * inclusive os já ocupados e os que já passaram. O servidor barrava a colisão
 * (`horarioOcupado`), então ninguém marcava em cima de ninguém — mas o aluno
 * escolhia, preenchia e só descobria no envio. Afirmar disponibilidade sem ter
 * consultado é o mesmo defeito das telas de métricas, com outra roupa.
 *
 * ## O que o sistema sabe, e o que não sabe
 *
 * **Sabe:** quais horários daquele profissional já estão comprometidos, porque
 * os agendamentos existem e a sobreposição é calculada.
 *
 * **Não sabe:** a agenda individual de cada profissional. O modelo tem
 * `professionals.available`, que é um sim/não do dia inteiro — não uma grade.
 * Então a faixa abaixo é o horário padrão de atendimento da escola, e é assim
 * que a tela precisa apresentá-la: horário livre na agenda, não promessa de
 * que a pessoa estará lá.
 */

import { horarioOcupado } from './bookings-repo';

/**
 * Faixa padrão de atendimento. Mora aqui, e não no frontend, para que mudar o
 * horário da escola seja uma linha só — e para que a decisão de "que horas
 * atendemos" não fique escondida num componente de tela.
 */
export const HORARIOS_PADRAO = [
  '09:00',
  '10:00',
  '11:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
] as const;

export const DURACAO_PADRAO_MIN = 50;

export type MotivoIndisponivel = 'ocupado' | 'passado';

export interface HorarioDoDia {
  hora: string;
  disponivel: boolean;
  motivo?: MotivoIndisponivel;
}

export interface AgendaDoDia {
  data: string;
  professionalId: string;
  durationMinutes: number;
  slots: HorarioDoDia[];
  observacao: string;
}

const OBSERVACAO =
  'Faixa padrão de atendimento da escola. A agenda pessoal de cada profissional não é registrada no sistema — horários já comprometidos aparecem bloqueados, o resto é solicitação.';

/**
 * A agenda de um profissional num dia. `agora` é injetável para os testes —
 * "já passou" depende do relógio, e teste que depende do relógio de verdade
 * falha sozinho às 18h01.
 */
export async function agendaDoDia(
  professionalId: string,
  data: string,
  agora = new Date(),
): Promise<AgendaDoDia> {
  const slots: HorarioDoDia[] = [];

  for (const hora of HORARIOS_PADRAO) {
    // Hora local do servidor, que é o fuso em que a escola opera.
    const quando = new Date(`${data}T${hora}:00`);
    if (Number.isNaN(quando.getTime())) {
      slots.push({ hora, disponivel: false, motivo: 'passado' });
      continue;
    }
    if (quando.getTime() <= agora.getTime()) {
      slots.push({ hora, disponivel: false, motivo: 'passado' });
      continue;
    }
    const ocupado = await horarioOcupado(
      professionalId,
      quando.toISOString(),
      DURACAO_PADRAO_MIN,
    );
    slots.push(
      ocupado ? { hora, disponivel: false, motivo: 'ocupado' } : { hora, disponivel: true },
    );
  }

  return {
    data,
    professionalId,
    durationMinutes: DURACAO_PADRAO_MIN,
    slots,
    observacao: OBSERVACAO,
  };
}

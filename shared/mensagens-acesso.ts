/**
 * O que se diz ao aluno quando a matrícula está suspensa ou cancelada.
 *
 * ## Por que a frase mora aqui, e não em cada tela
 *
 * O texto já existia — em `server/access/guard.ts`, dentro de
 * `accessDeniedMessage()`, e chegava ao aluno **só** no corpo do 403 da rota de
 * conteúdo, que nenhuma tela lia. Quando o aviso passou a aparecer também na
 * estante e na página do curso, a escolha era duplicar a frase no React ou
 * trazê-la para um módulo que os dois lados leem.
 *
 * Duas cópias da mesma frase acabam discordando, e discordar aqui é pior do que
 * em regra de código: o aluno lê "pagamento pendente" numa tela e "fale com a
 * coordenação" na outra, sobre o mesmo estado, e não sabe mais o que fazer. É o
 * mesmo motivo de `shared/visibilidade.ts` e `shared/documento.ts` existirem.
 *
 * ## O tom, que foi decidido e não é acidental
 *
 * Fala do que a pessoa pode fazer, não do estado interno do sistema. E o texto
 * de cancelamento admite a possibilidade de o dado estar errado — **138 das
 * matrículas canceladas vieram da importação da loja**, e a importação já
 * errou antes (o `paidAt` preenchido em pedido cancelado quis derrubar cinco
 * matrículas legítimas). Mandar a pessoa para a coordenação quando "isso não
 * confere" é o que impede que um erro de dado vire uma porta fechada sem
 * recurso.
 */

/** Os estados em que há algo a dizer sobre a situação da matrícula. */
export type EstadoDeSituacao = 'suspended' | 'canceled';

export interface MensagemDeAcesso {
  /** Cabeçalho curto, para o topo do aviso. */
  titulo: string;
  /** O que aconteceu e o que fazer a respeito. */
  corpo: string;
  /** Rótulo curto para o selo do card na estante. */
  selo: string;
}

const MENSAGENS: Record<EstadoDeSituacao, MensagemDeAcesso> = {
  suspended: {
    titulo: 'Seu acesso a este curso está suspenso',
    corpo:
      'Seu acesso está suspenso porque há um pagamento pendente deste curso. Assim que ele for confirmado, o acesso volta sozinho.',
    selo: 'Acesso suspenso',
  },
  canceled: {
    titulo: 'A matrícula neste curso foi cancelada',
    corpo:
      'A matrícula neste curso foi cancelada. Se isso não confere, fale com a coordenação.',
    selo: 'Matrícula cancelada',
  },
};

export function mensagemDeAcesso(estado: EstadoDeSituacao): MensagemDeAcesso {
  return MENSAGENS[estado];
}

/** True quando o estado vem da situação da matrícula, não do prazo. */
export function ehEstadoDeSituacao(estado: string): estado is EstadoDeSituacao {
  return estado === 'suspended' || estado === 'canceled';
}

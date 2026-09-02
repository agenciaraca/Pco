/**
 * Prazo de acesso do aluno a um curso — a regra, num só lugar.
 *
 * O curso define quantos meses de acesso a compra dá (`accessMonths`). A
 * matrícula guarda quando começou e quando termina. Passado o prazo, o aluno
 * não estuda mais até comprar extensão; o histórico e o progresso continuam
 * intactos, porque expirar não é desmatricular.
 *
 * Duas decisões que o resto do código herda:
 *
 * 1. **`accessMonths` ausente ou 0 = vitalício.** Curso que nunca declarou
 *    prazo não passa a expirar só porque o recurso existe — a mudança é
 *    aditiva, como `publicListed`.
 * 2. **`expiresAt` gravado na matrícula manda.** É o que permite estender por
 *    compra ou por cortesia sem mexer no curso, e o que preserva o prazo já
 *    concedido quando o curso muda de política depois.
 */

/**
 * Estado do acesso de um aluno a um curso, num instante.
 *
 * `suspended` e `canceled` não são prazo: vêm da situação da matrícula
 * (`server/access/situacao-matricula.ts`), que segue o pedido. Estão aqui
 * porque são a **mesma pergunta** do ponto de vista de quem lê — "posso
 * estudar isto agora, e se não, por quê?" — e separá-los em dois campos foi
 * exatamente o que deixou 376 matrículas sem aviso nenhum: o portão dizia não
 * e a tela dizia "no prazo".
 */
export type AccessState = AccessStateDePrazo | 'suspended' | 'canceled';

/**
 * Os quatro estados que saem **só da data**. Existem separados porque há conta
 * que só pode ver estes — a simulação de impacto de prazo
 * (`server/access/impacto.ts`) é um histograma sobre eles, e um `Record` que
 * incluísse `suspended` pediria uma casa que nunca é preenchida.
 */
export type AccessStateDePrazo = 'lifetime' | 'active' | 'expiring' | 'expired';

export interface AccessInfo {
  state: AccessState;
  /** ISO do fim do acesso, ou null quando vitalício. */
  expiresAt: string | null;
  /** Dias inteiros restantes; null quando vitalício. Negativo se já expirou. */
  daysLeft: number | null;
  /** Atalho: o aluno pode consumir conteúdo agora? */
  canStudy: boolean;
}

/** Faixa em que o aviso de "seu acesso está acabando" aparece. */
export const EXPIRING_SOON_DAYS = 30;

const MS_PER_DAY = 86_400_000;

/**
 * Sinal de que o prazo do curso não vale para esta matrícula. Um curso que
 * declara meses de acesso mas cuja matrícula veio marcada como vitalícia
 * (importação antiga, cortesia, sócio) precisa de um jeito de dizer isso — e
 * `expiresAt: null` não serve, porque null também é "ainda não calculado".
 */
export const LIFETIME = 'lifetime' as const;

/**
 * Soma meses a uma data, ancorando no fim do mês quando o dia não existe no
 * mês de destino: 31/jan + 1 mês = 28/fev (ou 29 em ano bissexto), não 03/mar.
 * `Date.setMonth` sozinho transborda, e transbordar aqui daria ao aluno um ou
 * dois dias a mais de acesso a cada renovação.
 */
export function addMonths(iso: string, months: number): string {
  const start = new Date(iso);
  if (Number.isNaN(start.getTime())) {
    throw new RangeError(`data de início inválida: ${iso}`);
  }
  const day = start.getUTCDate();
  const target = new Date(start.getTime());
  target.setUTCDate(1);
  target.setUTCMonth(target.getUTCMonth() + months);
  const lastDayOfTarget = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDayOfTarget));
  return target.toISOString();
}

/**
 * Quando o acesso termina, dado o início da matrícula e a política do curso.
 * Devolve null para acesso vitalício.
 */
export function computeExpiry(
  enrolledAt: string | null | undefined,
  accessMonths: number | null | undefined,
): string | null {
  if (!enrolledAt) return null;
  if (!accessMonths || accessMonths <= 0) return null;
  return addMonths(enrolledAt, accessMonths);
}

/**
 * O prazo efetivo de uma matrícula. `storedExpiresAt` é o que está gravado na
 * linha da matrícula e tem precedência sobre o cálculo — inclusive o literal
 * `'lifetime'`, que isenta esta matrícula do prazo do curso.
 */
export function resolveExpiry(input: {
  enrolledAt?: string | null;
  storedExpiresAt?: string | null | typeof LIFETIME;
  accessMonths?: number | null;
}): string | null {
  const { enrolledAt, storedExpiresAt, accessMonths } = input;
  if (storedExpiresAt === LIFETIME) return null;
  if (typeof storedExpiresAt === 'string' && storedExpiresAt.length > 0) {
    return storedExpiresAt;
  }
  return computeExpiry(enrolledAt, accessMonths);
}

/** O que sai de `describeAccess`: nunca `suspended` nem `canceled`. */
export interface AccessInfoDePrazo extends AccessInfo {
  state: AccessStateDePrazo;
}

/** Traduz um prazo em estado utilizável pela API e pela interface. */
export function describeAccess(
  expiresAt: string | null,
  now: Date = new Date(),
): AccessInfoDePrazo {
  if (!expiresAt) {
    return { state: 'lifetime', expiresAt: null, daysLeft: null, canStudy: true };
  }
  const end = new Date(expiresAt).getTime();
  if (Number.isNaN(end)) {
    // Data corrompida não pode virar bloqueio silencioso: trata como vitalício
    // e deixa o defeito visível no dado, não na porta do aluno.
    return { state: 'lifetime', expiresAt: null, daysLeft: null, canStudy: true };
  }
  const msLeft = end - now.getTime();
  const daysLeft = Math.ceil(msLeft / MS_PER_DAY);
  if (msLeft <= 0) {
    return { state: 'expired', expiresAt, daysLeft, canStudy: false };
  }
  return {
    state: daysLeft <= EXPIRING_SOON_DAYS ? 'expiring' : 'active',
    expiresAt,
    daysLeft,
    canStudy: true,
  };
}

/** Atalho para os dois passos juntos, que é como quase todo chamador usa. */
export function accessFor(
  input: Parameters<typeof resolveExpiry>[0],
  now: Date = new Date(),
): AccessInfoDePrazo {
  return describeAccess(resolveExpiry(input), now);
}

/**
 * O acesso de uma matrícula considerando **também** a situação dela.
 *
 * ## Por que isto existe
 *
 * O portão de verdade (`courseAccessFor`, em `guard.ts`) sempre olhou os dois:
 * matrícula suspensa ou cancelada não estuda, tenha o prazo que tiver. As
 * rotas que descrevem o acesso para a **tela** olhavam só o prazo — então o
 * aluno com matrícula suspensa recebia `state: 'active'`, via o curso normal na
 * estante, clicava numa aula e batia num 403 silencioso. Em produção são
 * **238 suspensas e 138 canceladas**: 376 pessoas para quem o produto não
 * explicava nada.
 *
 * Duas rotas montam essa linha — a do aluno (`/me/course-access`) e a do admin
 * (`/admin/students/:id/course-access`). Elas passam por aqui para não
 * divergirem: regra repetida em dois lugares acaba discordando, que é o motivo
 * de `shared/visibilidade.ts` e de `shared/documento.ts` existirem.
 *
 * ## A ordem, e por que ela é esta
 *
 * A situação vence o prazo. Quem teve o pedido estornado não precisa saber que
 * o acesso também venceria em 40 dias — precisa saber que foi cancelado. E
 * `canStudy` passa a bater com o que o portão de fato faz, que é a única forma
 * de a tela parar de mentir.
 *
 * `expiresAt` e `daysLeft` do prazo são preservados: o admin continua vendo até
 * quando a matrícula ia, o que é o dado que ele usa para decidir a reativação.
 */
export function accessForEnrollment(
  input: Parameters<typeof resolveExpiry>[0],
  situacao: 'ativa' | 'suspensa' | 'cancelada' | 'nenhuma' | undefined,
  now: Date = new Date(),
): AccessInfo {
  const doPrazo = accessFor(input, now);
  if (situacao === 'suspensa' || situacao === 'cancelada') {
    return {
      ...doPrazo,
      state: situacao === 'suspensa' ? 'suspended' : 'canceled',
      canStudy: false,
    };
  }
  return doPrazo;
}

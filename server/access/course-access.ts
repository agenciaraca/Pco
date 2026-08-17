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

/** Estado do acesso de um aluno a um curso, num instante. */
export type AccessState = 'lifetime' | 'active' | 'expiring' | 'expired';

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

/** Traduz um prazo em estado utilizável pela API e pela interface. */
export function describeAccess(
  expiresAt: string | null,
  now: Date = new Date(),
): AccessInfo {
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
): AccessInfo {
  return describeAccess(resolveExpiry(input), now);
}

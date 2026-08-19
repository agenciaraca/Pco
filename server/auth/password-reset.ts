// Tokens de redefinição de senha.
//
// Dois backends, como o resto do projeto: com Postgres, gravam na tabela
// `password_reset_tokens`; sem, ficam num Map em memória (dev local).
//
// A persistência não é preciosismo. Até 19/ago/2026 estes tokens viviam SÓ em
// memória, e qualquer restart do processo invalidava todos os links já
// enviados — o aluno clicava e lia "token inválido", sem ninguém entender por
// quê. Com 1.600 pessoas recebendo convite de primeiro acesso, um deploy no meio
// do envio queimaria a leva inteira.
//
// As funções continuam síncronas na aparência? Não: passaram a ser assíncronas,
// porque falar com o banco exige. Quem chama precisa await.

import crypto from 'node:crypto';
import { and, eq, gt, isNull, lt, or } from 'drizzle-orm';
import { getDb, schema } from '../db/client';

export interface ResetToken {
  token: string;
  userId: string;
  email: string;
  createdAt: number;
  expiresAt: number;
  used: boolean;
}

/**
 * Tempo de vida do link. Trinta minutos serve para quem clicou em "esqueci
 * minha senha" agora; convite de primeiro acesso disparado em massa precisa de
 * um prazo maior, senão quem abre o e-mail à noite já chega tarde.
 */
const TTL_MS = Number(process.env.RESET_TOKEN_TTL_MINUTES ?? 30) * 60 * 1000;

const memoria = new Map<string, ResetToken>();

function purgeExpired(): void {
  const now = Date.now();
  for (const [k, v] of memoria.entries()) {
    if (v.expiresAt < now || v.used) memoria.delete(k);
  }
}

function novoToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

export async function createResetToken(userId: string, email: string): Promise<ResetToken> {
  const now = Date.now();
  const entry: ResetToken = {
    token: novoToken(),
    userId,
    email,
    createdAt: now,
    expiresAt: now + TTL_MS,
    used: false,
  };

  const db = getDb();
  if (db) {
    // Pedir um link novo invalida o anterior: dois links vivos para a mesma
    // conta é uma janela a mais para quem interceptar o primeiro e-mail.
    await db
      .delete(schema.passwordResetTokens)
      .where(eq(schema.passwordResetTokens.userId, userId));
    await db.insert(schema.passwordResetTokens).values({
      token: entry.token,
      userId,
      email,
      createdAt: new Date(entry.createdAt),
      expiresAt: new Date(entry.expiresAt),
      usedAt: null,
    });
    // Aproveita para limpar o lixo já vencido, sem job dedicado.
    await db
      .delete(schema.passwordResetTokens)
      .where(
        or(
          lt(schema.passwordResetTokens.expiresAt, new Date(now - TTL_MS)),
          lt(schema.passwordResetTokens.usedAt, new Date(now - TTL_MS)),
        ),
      );
    return entry;
  }

  for (const [k, v] of memoria.entries()) {
    if (v.userId === userId) memoria.delete(k);
  }
  memoria.set(entry.token, entry);
  purgeExpired();
  return entry;
}

/** Valida e marca como usado. Devolve null para token inexistente, vencido ou já gasto. */
export async function consumeResetToken(token: string): Promise<ResetToken | null> {
  const db = getDb();
  if (db) {
    const linhas = await db
      .update(schema.passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(schema.passwordResetTokens.token, token),
          isNull(schema.passwordResetTokens.usedAt),
          gt(schema.passwordResetTokens.expiresAt, new Date()),
        ),
      )
      .returning();
    const r = linhas[0];
    if (!r) return null;
    return {
      token: r.token,
      userId: r.userId,
      email: r.email,
      createdAt: r.createdAt.getTime(),
      expiresAt: r.expiresAt.getTime(),
      used: true,
    };
  }

  purgeExpired();
  const entry = memoria.get(token);
  if (!entry || entry.used || entry.expiresAt < Date.now()) return null;
  entry.used = true;
  memoria.set(token, entry);
  return entry;
}

/** Só consulta, sem gastar o token — usado pela tela para dizer se o link ainda vale. */
export async function peekResetToken(token: string): Promise<ResetToken | null> {
  const db = getDb();
  if (db) {
    const linhas = await db
      .select()
      .from(schema.passwordResetTokens)
      .where(
        and(
          eq(schema.passwordResetTokens.token, token),
          isNull(schema.passwordResetTokens.usedAt),
          gt(schema.passwordResetTokens.expiresAt, new Date()),
        ),
      );
    const r = linhas[0];
    if (!r) return null;
    return {
      token: r.token,
      userId: r.userId,
      email: r.email,
      createdAt: r.createdAt.getTime(),
      expiresAt: r.expiresAt.getTime(),
      used: false,
    };
  }

  purgeExpired();
  const entry = memoria.get(token);
  if (!entry || entry.used || entry.expiresAt < Date.now()) return null;
  return entry;
}

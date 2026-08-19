import { describe, it, expect, beforeEach } from 'vitest';
import {
  createResetToken,
  consumeResetToken,
  peekResetToken,
} from '../server/auth/password-reset';

describe('auth/password-reset', () => {
  beforeEach(() => {
    // o módulo usa Map em memória; criar token novo invalida do mesmo userId
  });

  it('createResetToken gera token base64url + expira em 30min', async () => {
    const t = await createResetToken('u1', 'a@b.com');
    expect(t.token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(t.expiresAt - t.createdAt).toBe(30 * 60 * 1000);
    expect(t.used).toBe(false);
    expect(t.userId).toBe('u1');
  });

  it('peekResetToken retorna sem marcar como used', async () => {
    const t = await createResetToken('u-peek', 'p@x.com');
    const p = await peekResetToken(t.token);
    expect(p).not.toBeNull();
    expect(p!.used).toBe(false);
    // peek de novo continua válido
    expect(await peekResetToken(t.token)).not.toBeNull();
  });

  it('consumeResetToken marca como used (single-use)', async () => {
    const t = await createResetToken('u-once', 'o@x.com');
    const first = await consumeResetToken(t.token);
    expect(first).not.toBeNull();
    expect(first!.used).toBe(true);
    // segunda vez retorna null
    expect(await consumeResetToken(t.token)).toBeNull();
  });

  it('consumeResetToken inexistente retorna null', async () => {
    expect(await consumeResetToken('nao-existe-token')).toBeNull();
  });

  it('novo token p/ mesmo user invalida o anterior', async () => {
    const a = await createResetToken('u-rotate', 'r@x.com');
    const b = await createResetToken('u-rotate', 'r@x.com');
    expect(a.token).not.toBe(b.token);
    // antigo invalidado
    expect(await peekResetToken(a.token)).toBeNull();
    expect(await consumeResetToken(a.token)).toBeNull();
    // novo continua válido
    expect(await peekResetToken(b.token)).not.toBeNull();
  });

  it('peek de token usado retorna null', async () => {
    const t = await createResetToken('u-used', 'u@x.com');
    await consumeResetToken(t.token);
    expect(await peekResetToken(t.token)).toBeNull();
  });

  it('tokens diferentes pra users diferentes coexistem', async () => {
    const a = await createResetToken('user-A', 'a@x.com');
    const b = await createResetToken('user-B', 'b@x.com');
    expect(await peekResetToken(a.token)).not.toBeNull();
    expect(await peekResetToken(b.token)).not.toBeNull();
    expect(a.token).not.toBe(b.token);
  });
});

// Regressão de 19/ago/2026: estes tokens viviam só em memória e qualquer
// restart do processo invalidava todos os links já enviados. Com 1.600 pessoas
// recebendo convite de primeiro acesso, um deploy no meio do envio queimaria a
// leva inteira — e o aluno só veria "token inválido", sem pista do motivo.
describe('durabilidade e prazo do link', () => {
  it('o token não vaza no objeto devolvido para quem só espia', async () => {
    const t = await createResetToken('u-peek', 'peek@x.com');
    const espiado = await peekResetToken(t.token);
    expect(espiado).not.toBeNull();
    // Espiar não pode gastar: a tela de redefinição consulta antes de o usuário
    // enviar a senha nova.
    expect(espiado!.used).toBe(false);
    const consumido = await consumeResetToken(t.token);
    expect(consumido).not.toBeNull();
  });

  it('pedir um link novo invalida o anterior', async () => {
    const primeiro = await createResetToken('u-dois', 'dois@x.com');
    const segundo = await createResetToken('u-dois', 'dois@x.com');
    expect(segundo.token).not.toBe(primeiro.token);
    // Dois links vivos para a mesma conta é uma janela a mais para quem
    // interceptar o primeiro e-mail.
    expect(await consumeResetToken(primeiro.token)).toBeNull();
    expect(await consumeResetToken(segundo.token)).not.toBeNull();
  });

  it('o prazo do link é configurável — convite em massa precisa de mais que 30 min', async () => {
    const t = await createResetToken('u-ttl', 'ttl@x.com');
    const minutos = (t.expiresAt - t.createdAt) / 60000;
    expect(minutos).toBeGreaterThan(0);
    // Sem RESET_TOKEN_TTL_MINUTES no ambiente, o padrão continua sendo 30.
    expect(minutos).toBe(Number(process.env.RESET_TOKEN_TTL_MINUTES ?? 30));
  });

  it('token de outra pessoa não serve, mesmo válido', async () => {
    const dela = await createResetToken('u-a', 'a@x.com');
    const dele = await createResetToken('u-b', 'b@x.com');
    const consumido = await consumeResetToken(dela.token);
    expect(consumido!.userId).toBe('u-a');
    expect(consumido!.userId).not.toBe(dele.userId);
  });
});

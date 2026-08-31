import { describe, it, expect } from 'vitest';
import { montarUserData } from '../server/marketing/meta-capi';
import { createHash } from 'node:crypto';

/**
 * A conversão pelo servidor manda dado de comprador para um terceiro. Isso só
 * é aceitável sob três condições, e são elas que estes testes vigiam:
 *
 * 1. **Nada em claro.** E-mail, nome e telefone vão em SHA-256.
 * 2. **Normalizado antes do hash.** Hash de texto não normalizado não casa com
 *    nada do outro lado — seria dado enviado à toa, que é o pior dos mundos:
 *    o custo de privacidade sem o benefício de medição.
 * 3. **Campo vazio não vira hash.** Hash de string vazia é um valor constante e
 *    perfeitamente identificável; mandá-lo diria "esta pessoa não tem telefone"
 *    para todo mundo que recebesse.
 */

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

describe('o que sai do servidor para o Meta', () => {
  it('manda hash, nunca o valor', () => {
    const d = montarUserData({ email: 'Maria@Exemplo.COM ', nome: 'Maria Souza' });
    expect(JSON.stringify(d)).not.toContain('maria@exemplo.com');
    expect(JSON.stringify(d)).not.toContain('Maria');
    expect(d.em?.[0]).toMatch(/^[a-f0-9]{64}$/);
  });

  it('normaliza o e-mail antes: caixa e espaço não podem mudar o hash', () => {
    const a = montarUserData({ email: '  Maria@Exemplo.COM ' });
    const b = montarUserData({ email: 'maria@exemplo.com' });
    expect(a.em?.[0]).toBe(b.em?.[0]);
    expect(a.em?.[0]).toBe(sha('maria@exemplo.com'));
  });

  it('o telefone ganha o código do país, senão não casa com nada', () => {
    const d = montarUserData({ telefone: '(11) 98401-0715' });
    expect(d.ph?.[0]).toBe(sha('5511984010715'));
  });

  it('telefone que já tem código de país não ganha outro', () => {
    const d = montarUserData({ telefone: '+55 11 98401-0715' });
    expect(d.ph?.[0]).toBe(sha('5511984010715'));
  });

  it('manda só o primeiro nome, em minúsculas, como o Meta espera', () => {
    const d = montarUserData({ nome: 'Maria Souza Lima' });
    expect(d.fn?.[0]).toBe(sha('maria'));
  });

  it('campo ausente ou vazio não vira hash de vazio', () => {
    const d = montarUserData({ email: '', nome: undefined, telefone: null });
    expect(d.em).toBeUndefined();
    expect(d.fn).toBeUndefined();
    expect(d.ph).toBeUndefined();
    expect(Object.keys(d)).toHaveLength(0);
  });
});

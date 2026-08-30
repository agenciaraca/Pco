/**
 * O endereço público mora num lugar só — e este teste é quem cobra isso.
 *
 * Antes de 30/ago/2026 o domínio estava copiado em dezoito pontos do servidor:
 * treze como `process.env.PUBLIC_ORIGIN ?? '<literal>'` e cinco como literal
 * puro, sem sequer consultar a variável. Trocar de domínio era caçar todos.
 *
 * O perigo não é o trabalho — é o que sobra quando se esquece um: e-mail de
 * boas-vindas com link de login morto, retorno de pagamento que não volta,
 * dados estruturados apontando para o endereço antigo. Nenhum desses quebra
 * teste nem derruba o site; todos falham em silêncio, com a pessoa do outro
 * lado.
 *
 * Por isso a varredura abaixo: ela falha se o literal reaparecer em qualquer
 * arquivo de `server/` que não seja o próprio helper.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  origemPublica,
  hostPublico,
  urlPublica,
  ORIGEM_PUBLICA_PADRAO,
} from '../server/origem-publica';

const SERVER_DIR = path.resolve(__dirname, '..', 'server');
const ARQUIVO_DO_HELPER = path.join(SERVER_DIR, 'origem-publica.ts');
const LITERAL = 'ava.psicanaliseclinica.online';

function arquivosTs(dir: string): string[] {
  const saida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const completo = path.join(dir, entrada);
    if (statSync(completo).isDirectory()) {
      saida.push(...arquivosTs(completo));
    } else if (entrada.endsWith('.ts')) {
      saida.push(completo);
    }
  }
  return saida;
}

describe('origem pública', () => {
  const original = process.env.PUBLIC_ORIGIN;

  beforeEach(() => {
    delete process.env.PUBLIC_ORIGIN;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.PUBLIC_ORIGIN;
    else process.env.PUBLIC_ORIGIN = original;
  });

  it('sem a variável, usa o endereço de reserva', () => {
    expect(origemPublica()).toBe(ORIGEM_PUBLICA_PADRAO);
  });

  it('com a variável, usa o que foi configurado', () => {
    process.env.PUBLIC_ORIGIN = 'https://psicanaliseclinica.online';
    expect(origemPublica()).toBe('https://psicanaliseclinica.online');
  });

  // Barra sobrando é o erro de digitação mais comum em variável de ambiente, e
  // produziria `https://exemplo.com//login` em todo link de e-mail.
  it('remove a barra final, venha quantas vier', () => {
    process.env.PUBLIC_ORIGIN = 'https://psicanaliseclinica.online///';
    expect(origemPublica()).toBe('https://psicanaliseclinica.online');
  });

  // Variável definida como string vazia é o que sobra de um `.env` com
  // `PUBLIC_ORIGIN=` sem valor. Tratar como ausente é melhor do que montar
  // links começando por `/login` sem domínio.
  it('trata variável vazia como ausente', () => {
    process.env.PUBLIC_ORIGIN = '   ';
    expect(origemPublica()).toBe(ORIGEM_PUBLICA_PADRAO);
  });

  it('monta URL absoluta sem duplicar a barra', () => {
    process.env.PUBLIC_ORIGIN = 'https://psicanaliseclinica.online';
    expect(urlPublica('/login')).toBe('https://psicanaliseclinica.online/login');
    expect(urlPublica('login')).toBe('https://psicanaliseclinica.online/login');
  });

  it('devolve só o host para a assinatura dos e-mails', () => {
    process.env.PUBLIC_ORIGIN = 'https://psicanaliseclinica.online';
    expect(hostPublico()).toBe('psicanaliseclinica.online');
  });

  // Origem malformada não pode derrubar o envio de e-mail por causa do rodapé.
  it('origem inválida cai no padrão em vez de estourar', () => {
    process.env.PUBLIC_ORIGIN = 'nao-e-uma-url';
    expect(() => hostPublico()).not.toThrow();
    expect(hostPublico()).toBe(new URL(ORIGEM_PUBLICA_PADRAO).host);
  });
});

describe('o domínio não pode voltar a ser copiado', () => {
  it('o literal só existe no helper', () => {
    const infratores = arquivosTs(SERVER_DIR)
      .filter((arquivo) => arquivo !== ARQUIVO_DO_HELPER)
      .filter((arquivo) => readFileSync(arquivo, 'utf8').includes(LITERAL))
      .map((arquivo) => path.relative(SERVER_DIR, arquivo).replace(/\\/g, '/'));

    expect(
      infratores,
      `Estes arquivos escrevem "${LITERAL}" direto. Use origemPublica(), ` +
        'hostPublico() ou urlPublica() de server/origem-publica.ts — senão a ' +
        'próxima troca de domínio deixa este ponto para trás, em silêncio.',
    ).toEqual([]);
  });
});

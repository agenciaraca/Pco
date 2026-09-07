/**
 * "Não consegui ler" era impresso como "não existe", na página que vende.
 *
 * O site público embrulha toda leitura em `safe()` para nunca dar 500 por erro
 * de banco — regra boa. O efeito colateral é que o fallback passava por
 * verdade. Em 7/set/2026 o log de produção tinha 21 leituras do site público
 * falhando por queda de conexão, e o que o visitante via naqueles momentos:
 *
 * - `/formacoes` dizendo **"Em breve novos cursos"** — a escola parecendo não
 *   ter nada à venda;
 * - `/formacao/:slug` respondendo **404** — a página que vende afirmando que o
 *   curso não existe, para o comprador e para o robô de busca, que registra a
 *   página como inexistente por uma queda de um segundo;
 * - a home **omitindo a seção inteira** de formações, com cara de completa.
 *
 * É a mesma regra que o projeto já aplica às telas de métrica e às telas do
 * aluno. Faltava onde o leitor é um desconhecido decidindo comprar.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  comColetaDeFalhas,
  houveFalhaDeLeitura,
  registrarFalhaDeLeitura,
  falhasDaRequisicao,
} from '../server/public/falhas-de-leitura';

describe('coletor de falhas de leitura', () => {
  it('sem coletor, registrar é inócuo — script e teste não podem quebrar por isso', () => {
    expect(() => registrarFalhaDeLeitura('courses')).not.toThrow();
    expect(houveFalhaDeLeitura()).toBe(false);
  });

  it('dentro de uma requisição, a falha fica visível', async () => {
    await comColetaDeFalhas(async () => {
      expect(houveFalhaDeLeitura()).toBe(false);
      registrarFalhaDeLeitura('courses');
      expect(houveFalhaDeLeitura()).toBe(true);
      expect(falhasDaRequisicao()).toEqual(['courses']);
    });
  });

  it('a falha de uma requisição NÃO vaza para a seguinte', async () => {
    await comColetaDeFalhas(async () => {
      registrarFalhaDeLeitura('courses');
    });
    await comColetaDeFalhas(async () => {
      // Se o armazém fosse variável de módulo, o visitante seguinte veria a
      // página de indisponibilidade por causa do anterior.
      expect(houveFalhaDeLeitura()).toBe(false);
    });
  });

  it('duas leituras falhando na mesma requisição são as duas registradas', async () => {
    await comColetaDeFalhas(async () => {
      registrarFalhaDeLeitura('courses');
      registrarFalhaDeLeitura('posts');
      expect(falhasDaRequisicao()).toEqual(['courses', 'posts']);
    });
  });
});

describe('safe() registra, não só loga', () => {
  let projections: typeof import('../server/public/projections');

  beforeAll(async () => {
    projections = await import('../server/public/projections');
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('a leitura que falha marca a requisição', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // `listPublicCourses` lê o repositório de cursos; derrubá-lo é o cenário
    // real (queda de conexão), e o contrato é: devolve `[]` E marca.
    const courses = await import('../server/repositories/courses');
    const espiao = vi
      .spyOn(courses, 'listCourses')
      .mockRejectedValue(new Error('Connection terminated unexpectedly'));

    await comColetaDeFalhas(async () => {
      const lista = await projections.listPublicCourses();
      expect(lista).toEqual([]);
      expect(
        houveFalhaDeLeitura(),
        'a lista voltou vazia e nada registrou que foi falha — é assim que ' +
          '"não consegui ler" vira "não existe"',
      ).toBe(true);
    });

    espiao.mockRestore();
  });

  it('e a leitura que dá certo não marca nada', async () => {
    await comColetaDeFalhas(async () => {
      await projections.listPublicCourses();
      expect(houveFalhaDeLeitura()).toBe(false);
    });
  });
});

describe('o roteador decide pelo registro, não pela lista vazia', () => {
  let fonte: string;

  beforeAll(async () => {
    fonte = await fs.readFile(
      path.join(process.cwd(), 'server', 'public', 'router.ts'),
      'utf8',
    );
  });

  it('a página de curso responde 503, e não 404, quando a leitura falhou', () => {
    const i = fonte.indexOf("publicSite.get('/formacao/:slug'");
    expect(i).toBeGreaterThan(0);
    const bloco = fonte.slice(i, i + 3000);
    expect(bloco).toContain('houveFalhaDeLeitura()');
    // 503 diz "volte"; 404 diz "não existe" — e o robô de busca acredita.
    expect(bloco).toMatch(/falhou \? 503 : 404/);
    expect(bloco).toContain("'Retry-After'");
  });

  it('a página de artigo segue a mesma regra', () => {
    const i = fonte.indexOf("publicSite.get('/blog/:slug'");
    expect(i).toBeGreaterThan(0);
    const bloco = fonte.slice(i, i + 3000);
    expect(bloco).toContain('houveFalhaDeLeitura()');
    expect(bloco).toMatch(/falhou \? 503 : 404/);
  });

  it('o catálogo não diz "Em breve novos cursos" sobre uma falha', () => {
    // A primeira ocorrência da frase é o docstring que a cita; a que importa é
    // a do render, dentro da rota do catálogo.
    const rota = fonte.indexOf("publicSite.get('/formacoes'");
    expect(rota).toBeGreaterThan(0);
    const i = fonte.indexOf('Em breve novos cursos', rota);
    expect(i).toBeGreaterThan(rota);
    // A checagem de falha tem de vir ANTES da frase de vitrine vazia.
    const antes = fonte.slice(i - 400, i);
    expect(antes).toContain('houveFalhaDeLeitura()');
  });

  it('a home não some com a seção de formações em silêncio', () => {
    const i = fonte.indexOf('Nossas formações');
    expect(i).toBeGreaterThan(0);
    const bloco = fonte.slice(i, i + 1500);
    // Havia um `: ''` puro aqui — a seção sumia e a página ficava com cara de
    // completa. Mesmo `if (!data) return null` já corrigido no /admin.
    expect(bloco).toContain('houveFalhaDeLeitura()');
    expect(bloco).toContain('blocoIndisponivel');
  });

  it('o coletor está instalado como middleware do site público', () => {
    expect(fonte).toMatch(/publicSite\.use\('\*',\s*\(c, next\) => comColetaDeFalhas/);
  });
});

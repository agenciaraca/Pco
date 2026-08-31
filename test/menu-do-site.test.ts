import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { courses as seedCourses } from '../src/app/data/seed';

/**
 * O menu tem uma porta direta para o carro-chefe — decisão do dono: "quem já
 * sabe o nome não deveria precisar de dois cliques". O preço dessa decisão é um
 * slug escrito à mão em `server/public/layout.ts`, dentro do cabeçalho que
 * aparece em TODA página do site.
 *
 * Em 31/ago/2026 esse slug era `curso-de-psicanalise-clinica-online` — que
 * responde 200 em produção e **não existia no seed do repositório**, onde o
 * curso era `psicanalise-clinica`. Ou seja: numa instalação limpa, o principal
 * item do menu levava a 404, e nada reclamava.
 *
 * Este teste amarra os dois: se alguém renomear o curso ou mexer no menu, a
 * falha aparece aqui, e não na barra de navegação do visitante.
 */
const layout = readFileSync(resolve(process.cwd(), 'server/public/layout.ts'), 'utf-8');

describe('menu do site', () => {
  it('todo link de curso no menu existe no catálogo semeado', () => {
    const doMenu = [...layout.matchAll(/href:\s*'\/formacao\/([^']+)'/g)].map((m) => m[1]);
    expect(doMenu.length, 'o menu deixou de ter porta direta para curso').toBeGreaterThan(0);

    const semeados = new Set(seedCourses.map((c) => c.slug));
    for (const slug of doMenu) {
      expect(
        semeados.has(slug),
        `o menu aponta para /formacao/${slug}, que não existe no seed. ` +
          `Slugs semeados: ${[...semeados].join(', ')}`,
      ).toBe(true);
    }
  });
});

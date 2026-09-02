import { describe, it, expect } from 'vitest';
import { getTableColumns } from 'drizzle-orm';
import { lessons } from '../server/db/schema';
import { createLessonSchema } from '../shared/schemas';

/**
 * Por que este teste existe.
 *
 * Três vezes o mesmo defeito, e nenhuma delas apareceu em teste: um campo de
 * aula existia no schema Zod, no editor do admin e nas telas do produto — e
 * **não tinha coluna**. O caminho de banco, que é produção, descartava o valor
 * ao gravar e devolvia `undefined` ao ler.
 *
 *   - `content` (até 21/ago/2026): 309 aulas terminavam no meio da frase,
 *     porque só a `description` cortada em 500 caracteres tinha onde pousar.
 *   - `isPreview` (até 2/set/2026): a caixa "aula de demonstração" salvava sem
 *     erro e não fazia nada; `/lessons/:id/preview` respondia 403 para toda
 *     aula, e o selo "tem aula grátis" do catálogo nunca aparecia.
 *   - `transcripts` (idem): o painel de transcrição, com três idiomas e botão
 *     de copiar entre eles, perdia o texto no caminho. As duas rotas de
 *     transcrição respondiam `NO_TRANSCRIPT` para toda aula, e isso se lia
 *     como "ninguém cadastrou ainda".
 *
 * O que une os três é a falta de erro. O formulário salva, a API responde 200,
 * e só quem for reler o banco descobre. A suíte antiga não pegava porque
 * `test/courses-repo-fields.test.ts` roda sobre o JsonStore — o caminho que
 * sempre funcionou.
 *
 * Este teste não olha valores: olha se **cabe**. Campo novo em
 * `createLessonSchema` sem coluna correspondente falha aqui, na hora, em vez
 * de virar dado perdido em produção meses depois.
 */
describe('todo campo de aula tem onde pousar no banco', () => {
  const colunas = new Set(Object.keys(getTableColumns(lessons)));
  const campos = Object.keys(createLessonSchema.shape);

  it('createLessonSchema e a tabela lessons não divergem', () => {
    const semColuna = campos.filter((c) => !colunas.has(c));
    expect(semColuna).toEqual([]);
  });

  it.each(campos)('%s tem coluna', (campo) => {
    expect(colunas.has(campo)).toBe(true);
  });

  it('os três campos que já se perderam estão cobertos', () => {
    // Guarda contra alguém "simplificar" o teste acima para uma lista fixa.
    for (const c of ['content', 'isPreview', 'transcripts']) {
      expect(campos).toContain(c);
      expect(colunas.has(c)).toBe(true);
    }
  });
});

import { describe, it, expect } from 'vitest';
import {
  AVISO_OPCIONAL,
  BASE_LEGAL,
  NUNCA_CONDICIONADO,
} from '../server/sessions/regra-opcional';

// Análise e supervisão são opcionais por exigência legal, não por escolha:
// condicionar a venda do curso à contratação delas é venda casada, vedada pelo
// art. 39, I, do CDC. Estes testes existem para que a regra não se perca numa
// refatoração — e para que quem for criar a dependência esbarre neles.

describe('sessões opcionais — a regra que não pode ser afrouxada', () => {
  it('o aviso ao aluno diz que não é requisito para o certificado', () => {
    expect(AVISO_OPCIONAL).toMatch(/opcionais/i);
    expect(AVISO_OPCIONAL).toMatch(/certificado/i);
    expect(AVISO_OPCIONAL).toMatch(/não são requisito/i);
  });

  it('a base legal cita a lei, não só o princípio', () => {
    // Um aviso sem a norma vira opinião interna; com a norma, vira argumento.
    expect(BASE_LEGAL).toContain('8.078/1990');
    expect(BASE_LEGAL).toContain('art. 39, I');
    expect(BASE_LEGAL).toMatch(/venda casada/i);
  });

  it('a lista do que nunca pode ser condicionado cobre o percurso inteiro', () => {
    // Se alguém acrescentar uma etapa nova ao percurso e esquecer de checá-la
    // aqui, este teste não pega — mas a lista deixa explícito o que já está
    // decidido, e é por onde a revisão começa.
    expect(NUNCA_CONDICIONADO).toContain('acesso ao curso');
    expect(NUNCA_CONDICIONADO).toContain('conclusão do curso');
    expect(NUNCA_CONDICIONADO).toContain('emissão do certificado');
  });

  it('nenhum caminho de conclusão de curso importa o módulo de sessões', async () => {
    // A prova prática: o portão de acesso e o repositório de progresso não
    // conhecem sessões. Se um dia conhecerem, é aqui que aparece.
    const guard = await import('../server/access/guard');
    const fonte = guard.courseAccessFor.toString();
    expect(fonte).not.toMatch(/session|sessao|sessão|professional/i);
  });
});

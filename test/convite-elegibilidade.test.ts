import { describe, it, expect } from 'vitest';
import { avaliar, segmentar, type AlunoParaConvite } from '../server/convites/elegibilidade';

// Convidar errado custa dos dois lados: quem desistiu ou pediu reembolso recebe
// uma cobrança disfarçada de boas-vindas, e quem não tem matrícula chega numa
// plataforma vazia e conclui que o AVA está quebrado. Estes testes travam quem
// entra na lista.

const base = (over: Partial<AlunoParaConvite> = {}): AlunoParaConvite => ({
  id: 'a1',
  email: 'pessoa@exemplo.com',
  name: 'Pessoa',
  jaEntrou: false,
  matriculas: 2,
  matriculasExpiradas: 0,
  sourceRole: 'aluno',
  ...over,
});

describe('quem recebe o convite', () => {
  it('aluno com matrícula no prazo, que nunca entrou', () => {
    expect(avaliar(base()).elegivel).toBe(true);
  });

  it('quem já entrou não recebe — não precisa de convite', () => {
    const r = avaliar(base({ jaEntrou: true }));
    expect(r.elegivel).toBe(false);
    expect(r.motivo).toBe('ja_entrou');
  });

  it('quem não tem matrícula fica de fora', () => {
    // São 986 pessoas em produção: convidar seria mandar gente para uma
    // plataforma vazia.
    const r = avaliar(base({ matriculas: 0 }));
    expect(r.elegivel).toBe(false);
    expect(r.motivo).toBe('sem_matricula');
  });

  it('desistente, inadimplente, reembolsado e inativo ficam de fora', () => {
    for (const papel of ['desistente', 'inadimplente', 'reembolsado', 'inativo']) {
      const r = avaliar(base({ sourceRole: papel }));
      expect(r.elegivel, papel).toBe(false);
      expect(r.motivo, papel).toBe(papel);
    }
  });

  it('o papel é lido sem depender de maiúsculas', () => {
    expect(avaliar(base({ sourceRole: 'Inadimplente' })).motivo).toBe('inadimplente');
  });

  it('acesso vencido em TODOS os cursos exclui; vencido em alguns, não', () => {
    expect(avaliar(base({ matriculas: 2, matriculasExpiradas: 2 })).motivo).toBe('acesso_expirado');
    expect(avaliar(base({ matriculas: 2, matriculasExpiradas: 1 })).elegivel).toBe(true);
  });

  it('sem e-mail válido não há como convidar', () => {
    expect(avaliar(base({ email: '' })).motivo).toBe('sem_email');
    expect(avaliar(base({ email: 'nao-e-email' })).motivo).toBe('sem_email');
  });

  it('quem já foi convidado não recebe de novo', () => {
    expect(avaliar(base({ jaConvidado: true })).motivo).toBe('ja_convidado');
  });

  it('"já entrou" vence os demais motivos — quem está usando não precisa de convite', () => {
    const r = avaliar(base({ jaEntrou: true, sourceRole: 'inadimplente', matriculas: 0 }));
    expect(r.motivo).toBe('ja_entrou');
  });

  it('papel desconhecido não exclui ninguém sozinho', () => {
    // Só o que a origem afirmou tira alguém da lista; ausência de informação não
    // pode virar exclusão silenciosa.
    expect(avaliar(base({ sourceRole: 'subscriber' })).elegivel).toBe(true);
    expect(avaliar(base({ sourceRole: null })).elegivel).toBe(true);
  });
});

describe('segmentação da lista inteira', () => {
  it('separa elegíveis de excluídos e conta por motivo', () => {
    const s = segmentar([
      base({ id: '1' }),
      base({ id: '2', jaEntrou: true }),
      base({ id: '3', matriculas: 0 }),
      base({ id: '4', sourceRole: 'desistente' }),
      base({ id: '5', sourceRole: 'inadimplente' }),
      base({ id: '6' }),
    ]);
    expect(s.elegiveis.map((a) => a.id)).toEqual(['1', '6']);
    expect(s.excluidos).toHaveLength(4);
    expect(s.porMotivo).toEqual({
      ja_entrou: 1,
      sem_matricula: 1,
      desistente: 1,
      inadimplente: 1,
    });
  });

  it('lista vazia não quebra e não inventa segmento', () => {
    const s = segmentar([]);
    expect(s.elegiveis).toEqual([]);
    expect(s.porMotivo).toEqual({});
  });
});

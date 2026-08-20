/**
 * Quem deve receber o convite para o ambiente novo — e, principalmente, quem não deve.
 *
 * Convidar errado tem custo dos dois lados: quem desistiu ou pediu reembolso
 * recebe uma cobrança disfarçada de boas-vindas, e quem não tem matrícula chega
 * numa plataforma vazia e conclui que o AVA está quebrado. Por isso a regra mora
 * num lugar só, com nome, e é o que a tela do admin mostra antes de qualquer
 * disparo.
 */

export type MotivoExclusao =
  | 'ja_entrou'
  | 'sem_matricula'
  | 'acesso_expirado'
  | 'desistente'
  | 'inadimplente'
  | 'reembolsado'
  | 'inativo'
  | 'sem_email'
  | 'ja_convidado';

export interface AlunoParaConvite {
  id: string;
  email: string;
  name: string;
  /** Já entrou alguma vez no ambiente novo? */
  jaEntrou: boolean;
  matriculas: number;
  /** Matrículas cujo prazo de acesso já venceu. */
  matriculasExpiradas: number;
  /** Papel na plataforma de origem: aluno, desistente, inadimplente… */
  sourceRole?: string | null;
  jaConvidado?: boolean;
}

export interface Avaliacao {
  elegivel: boolean;
  motivo?: MotivoExclusao;
}

/** Papéis de origem que, por si só, tiram a pessoa da lista. */
const PAPEL_EXCLUI: Record<string, MotivoExclusao> = {
  desistente: 'desistente',
  inadimplente: 'inadimplente',
  reembolsado: 'reembolsado',
  inativo: 'inativo',
};

/**
 * A ordem importa: o motivo devolvido é o que a tela mostra, e a pessoa quer
 * saber a razão mais forte. "Já entrou" vem antes de tudo porque quem já está
 * usando não precisa de convite, mesmo estando inadimplente.
 */
export function avaliar(a: AlunoParaConvite): Avaliacao {
  if (!a.email || !a.email.includes('@')) return { elegivel: false, motivo: 'sem_email' };
  if (a.jaEntrou) return { elegivel: false, motivo: 'ja_entrou' };
  if (a.jaConvidado) return { elegivel: false, motivo: 'ja_convidado' };

  const papel = (a.sourceRole ?? '').toLowerCase();
  const porPapel = PAPEL_EXCLUI[papel];
  if (porPapel) return { elegivel: false, motivo: porPapel };

  if (a.matriculas === 0) return { elegivel: false, motivo: 'sem_matricula' };

  // Todas vencidas: convidar seria oferecer uma porta que não abre. Quem tem ao
  // menos uma matrícula no prazo entra na lista.
  if (a.matriculasExpiradas >= a.matriculas) {
    return { elegivel: false, motivo: 'acesso_expirado' };
  }

  return { elegivel: true };
}

export const ROTULO_MOTIVO: Record<MotivoExclusao, string> = {
  ja_entrou: 'já entrou no ambiente novo',
  sem_matricula: 'sem matrícula em curso algum',
  acesso_expirado: 'acesso vencido em todos os cursos',
  desistente: 'marcado como desistente na origem',
  inadimplente: 'marcado como inadimplente na origem',
  reembolsado: 'teve reembolso',
  inativo: 'marcado como inativo na origem',
  sem_email: 'sem e-mail válido',
  ja_convidado: 'já recebeu convite',
};

export interface Segmentacao {
  elegiveis: AlunoParaConvite[];
  excluidos: Array<{ aluno: AlunoParaConvite; motivo: MotivoExclusao }>;
  porMotivo: Record<string, number>;
}

export function segmentar(alunos: AlunoParaConvite[]): Segmentacao {
  const elegiveis: AlunoParaConvite[] = [];
  const excluidos: Array<{ aluno: AlunoParaConvite; motivo: MotivoExclusao }> = [];
  const porMotivo: Record<string, number> = {};

  for (const a of alunos) {
    const r = avaliar(a);
    if (r.elegivel) {
      elegiveis.push(a);
    } else {
      const motivo = r.motivo!;
      excluidos.push({ aluno: a, motivo });
      porMotivo[motivo] = (porMotivo[motivo] ?? 0) + 1;
    }
  }
  return { elegiveis, excluidos, porMotivo };
}

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DA_LOJA,
  situacaoDoStatus,
  situacaoMaisForte,
  situacaoDeVarios,
  avisaVencimento,
} from '../server/access/situacao-matricula';

/**
 * A situação da matrícula nasceu em 1/set/2026, quando o histórico da loja
 * entrou no AVA e pagamento deixou de ser sinônimo de acesso.
 *
 * O que estes testes protegem, e por quê:
 *
 * 1. **Suspensa e cancelada trancam.** Se o portão ignorar a situação, um
 *    estorno vira acesso vitalício de graça.
 * 2. **A negativa diz a coisa certa.** Quem foi estornado não pode ler "seu
 *    acesso expirou": a mensagem manda renovar, e renovar não resolve o caso.
 * 3. **Estorno não desmatricula.** `enrolled` segue true, porque o histórico é
 *    o produto — some a matrícula, some a prova de que a pessoa comprou.
 */

vi.mock('../server/repositories/students', () => ({
  findAdminStudent: vi.fn(),
}));
vi.mock('../server/repositories/courses', () => ({
  findCourse: vi.fn(),
}));

import * as studentsRepo from '../server/repositories/students';
import * as coursesRepo from '../server/repositories/courses';
import { courseAccessFor, accessDeniedMessage } from '../server/access/guard';

const CURSO = 'c-psi';
const ONTEM = new Date(Date.now() - 86400_000).toISOString();

function alunoCom(situacao?: 'suspensa' | 'cancelada') {
  return {
    id: 'a-1',
    name: 'Fulana',
    email: 'f@e.com',
    enrolledCourseIds: [CURSO],
    progressByCourse: { [CURSO]: 10 },
    enrollmentDates: { [CURSO]: ONTEM },
    ...(situacao ? { enrollmentStatusByCourse: { [CURSO]: situacao } } : {}),
    status: 'ativo' as const,
    riskScore: 0,
    lastAccessAt: ONTEM,
    createdAt: ONTEM,
  };
}

beforeEach(() => {
  vi.mocked(coursesRepo.findCourse).mockResolvedValue({
    id: CURSO,
    // sem accessMonths: prazo não interfere, o teste é sobre situação
  } as never);
});

describe('o status do pedido decide a situação da matrícula', () => {
  it('concluído matricula; estorno e desistência derrubam; atraso suspende', () => {
    expect(DA_LOJA.completed.situacao).toBe('ativa');
    expect(DA_LOJA.processing.situacao).toBe('ativa');
    expect(DA_LOJA.refunded.situacao).toBe('cancelada');
    expect(DA_LOJA.reembolsado.situacao).toBe('cancelada');
    expect(DA_LOJA.desistente.situacao).toBe('cancelada');
    expect(DA_LOJA['em-atraso'].situacao).toBe('suspensa');
    expect(DA_LOJA['on-hold'].situacao).toBe('suspensa');
    expect(DA_LOJA.cancelled.situacao).toBe('nenhuma');
    expect(DA_LOJA.failed.situacao).toBe('nenhuma');
  });

  it('vale igual para o checkout próprio, não só para a loja', () => {
    expect(situacaoDoStatus('paid')).toBe('ativa');
    expect(situacaoDoStatus('refunded')).toBe('cancelada');
    expect(situacaoDoStatus('pending')).toBe('suspensa');
    expect(situacaoDoStatus('canceled')).toBe('nenhuma');
  });

  it('quem comprou duas vezes e foi estornado uma continua com acesso', () => {
    // Sem esta regra, um estorno antigo trancaria uma compra nova.
    expect(situacaoDeVarios(['cancelada', 'ativa'])).toBe('ativa');
    expect(situacaoMaisForte('suspensa', 'ativa')).toBe('ativa');
    expect(situacaoDeVarios(['nenhuma', 'suspensa'])).toBe('suspensa');
    expect(situacaoDeVarios([])).toBe('nenhuma');
  });
});

describe('o portão de acesso respeita a situação', () => {
  it('matrícula ativa (ausente do mapa) deixa estudar', async () => {
    vi.mocked(studentsRepo.findAdminStudent).mockResolvedValue(alunoCom() as never);
    const r = await courseAccessFor('a-1', CURSO);
    expect(r.canStudy).toBe(true);
    expect(r.reason).toBe('ok');
  });

  it('suspensa tranca, e diz que é pagamento — não prazo', async () => {
    vi.mocked(studentsRepo.findAdminStudent).mockResolvedValue(alunoCom('suspensa') as never);
    const r = await courseAccessFor('a-1', CURSO);
    expect(r.canStudy).toBe(false);
    expect(r.reason).toBe('enrollment_suspended');
    expect(r.enrolled).toBe(true); // suspender não desmatricula
    expect(accessDeniedMessage(r)).toMatch(/pagamento pendente/i);
    expect(accessDeniedMessage(r)).not.toMatch(/expirou/i);
  });

  it('cancelada tranca e não manda renovar', async () => {
    vi.mocked(studentsRepo.findAdminStudent).mockResolvedValue(alunoCom('cancelada') as never);
    const r = await courseAccessFor('a-1', CURSO);
    expect(r.canStudy).toBe(false);
    expect(r.reason).toBe('enrollment_canceled');
    expect(r.enrolled).toBe(true); // estorno não apaga o histórico
    expect(accessDeniedMessage(r)).toMatch(/cancelada/i);
  });

  it('situação vem antes do prazo: suspensa dentro do prazo continua trancada', async () => {
    vi.mocked(coursesRepo.findCourse).mockResolvedValue({
      id: CURSO,
      accessMonths: 120, // prazo folgadíssimo
    } as never);
    vi.mocked(studentsRepo.findAdminStudent).mockResolvedValue(alunoCom('suspensa') as never);
    const r = await courseAccessFor('a-1', CURSO);
    expect(r.canStudy).toBe(false);
    expect(r.reason).toBe('enrollment_suspended');
  });

  it('quem não tem matrícula continua caindo em not_enrolled', async () => {
    vi.mocked(studentsRepo.findAdminStudent).mockResolvedValue({
      ...alunoCom(),
      enrolledCourseIds: [],
    } as never);
    const r = await courseAccessFor('a-1', CURSO);
    expect(r.reason).toBe('not_enrolled');
    expect(r.enrolled).toBe(false);
  });
});

/**
 * O aviso de vencimento e a situação da matrícula se cruzam num ponto que
 * custaria caro: o worker manda "seu acesso expirou" olhando só o prazo. Para
 * quem teve o pedido estornado, essa frase manda renovar o que foi desfeito —
 * o aviso vira cobrança de quem já pediu o dinheiro de volta.
 */
describe('o aviso de vencimento não fala com quem está fora de situação', () => {
  it('só matrícula ativa (ou sem marca) recebe aviso', () => {
    expect(avisaVencimento(undefined)).toBe(true); // ausente = ativa
    expect(avisaVencimento('ativa')).toBe(true);
    expect(avisaVencimento('suspensa')).toBe(false);
    expect(avisaVencimento('cancelada')).toBe(false);
  });
});

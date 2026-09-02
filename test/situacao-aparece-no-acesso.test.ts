import { describe, it, expect } from 'vitest';
import { accessFor, accessForEnrollment } from '../server/access/course-access';

/**
 * A situação da matrícula tem de chegar às telas junto com o prazo.
 *
 * O portão de verdade (`courseAccessFor`, em `server/access/guard.ts`) sempre
 * olhou os dois: matrícula suspensa ou cancelada não estuda, tenha o prazo que
 * tiver. As rotas que **descrevem** o acesso para a interface olhavam só a
 * data — então quem tinha matrícula suspensa recebia `state: 'active'`, via o
 * curso normal na estante e batia num 403 sem explicação. Medido em produção
 * em 2/set/2026: **238 suspensas e 138 canceladas**, 376 pessoas nesse estado.
 *
 * A tela do admin era o pior lado: mostrava **"No prazo"** exatamente para quem
 * a coordenação precisa revisar caso a caso.
 *
 * ## O que estes testes protegem
 *
 * Que a situação **vença** o prazo, que `canStudy` passe a concordar com o
 * portão, e — o que mais importa — que nada aqui **libere** ninguém: esta
 * função só descreve, e descrever mais restrito nunca pode virar acesso.
 */

const ONTEM = new Date('2026-08-01T00:00:00.000Z').toISOString();
const AGORA = new Date('2026-09-02T12:00:00.000Z');

/** Matrícula folgada: sem prazo declarado, portanto vitalícia. */
const semPrazo = { enrolledAt: ONTEM, storedExpiresAt: null, accessMonths: null };

describe('a situação da matrícula vence o prazo', () => {
  it('suspensa vira `suspended`, mesmo com acesso vitalício', () => {
    expect(accessFor(semPrazo, AGORA).state).toBe('lifetime');
    const r = accessForEnrollment(semPrazo, 'suspensa', AGORA);
    expect(r.state).toBe('suspended');
    expect(r.canStudy).toBe(false);
  });

  it('cancelada vira `canceled`, e não se confunde com suspensa', () => {
    const r = accessForEnrollment(semPrazo, 'cancelada', AGORA);
    expect(r.state).toBe('canceled');
    expect(r.canStudy).toBe(false);
  });

  it('quem teve o pedido estornado não é informado do prazo, e sim do cancelamento', () => {
    // Uma matrícula pode estar cancelada E dentro do prazo. Dizer "vence em 40
    // dias" a quem foi estornado é responder a pergunta errada.
    const dentroDoPrazo = {
      enrolledAt: ONTEM,
      storedExpiresAt: new Date('2026-12-01T00:00:00.000Z').toISOString(),
      accessMonths: 12,
    };
    expect(accessFor(dentroDoPrazo, AGORA).state).toBe('active');
    expect(accessForEnrollment(dentroDoPrazo, 'cancelada', AGORA).state).toBe('canceled');
  });

  it('o prazo é preservado no dado, para o admin decidir a reativação', () => {
    const comPrazo = {
      enrolledAt: ONTEM,
      storedExpiresAt: new Date('2026-12-01T00:00:00.000Z').toISOString(),
      accessMonths: 12,
    };
    const r = accessForEnrollment(comPrazo, 'suspensa', AGORA);
    expect(r.expiresAt).toBe(new Date('2026-12-01T00:00:00.000Z').toISOString());
    expect(r.daysLeft).toBeGreaterThan(0);
  });
});

describe('e não muda nada para quem está em dia', () => {
  /**
   * O caso que mais importa depois de "não vaza": esta função **não pode
   * liberar ninguém**. Ela só descreve, e o resultado dela nunca é mais
   * permissivo do que o do prazo sozinho.
   */
  it('matrícula ativa dá exatamente o mesmo resultado de antes', () => {
    for (const situacao of ['ativa', undefined] as const) {
      expect(accessForEnrollment(semPrazo, situacao, AGORA)).toEqual(accessFor(semPrazo, AGORA));
    }
  });

  it('acesso vencido continua vencido — situação ativa não ressuscita prazo', () => {
    const vencida = {
      enrolledAt: '2024-01-01T00:00:00.000Z',
      storedExpiresAt: '2024-07-01T00:00:00.000Z',
      accessMonths: 6,
    };
    const r = accessForEnrollment(vencida, 'ativa', AGORA);
    expect(r.state).toBe('expired');
    expect(r.canStudy).toBe(false);
  });

  it('nenhuma situação torna `canStudy` verdadeiro onde o prazo já dizia falso', () => {
    const vencida = {
      enrolledAt: '2024-01-01T00:00:00.000Z',
      storedExpiresAt: '2024-07-01T00:00:00.000Z',
      accessMonths: 6,
    };
    for (const situacao of ['ativa', 'suspensa', 'cancelada', 'nenhuma', undefined] as const) {
      expect(accessForEnrollment(vencida, situacao, AGORA).canStudy).toBe(false);
    }
  });
});

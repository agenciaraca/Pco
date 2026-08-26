import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * Lembrete de sessão.
 *
 * Os avisos de `avisos.ts` reagem a mudanças; este fala quando **nada** muda —
 * a sessão marcada semanas antes e esquecida. Falta a alguém é o custo mais
 * caro de uma agenda de atendimento, porque a hora do profissional já foi
 * reservada.
 */

let tmpDir: string;
let worker: typeof import('../server/sessions/lembrete-worker');
let bookings: typeof import('../server/sessions/bookings-repo');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-lem-'));
  process.env.DATA_DIR = tmpDir;
  worker = await import('../server/sessions/lembrete-worker');
  bookings = await import('../server/sessions/bookings-repo');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

beforeEach(async () => {
  await bookings._resetParaTeste();
  await worker._resetParaTeste();
});

function daquiA(horas: number): string {
  return new Date(Date.now() + horas * 3_600_000).toISOString();
}

const base = {
  userId: 'u1',
  userEmail: 'aluno@exemplo.com',
  serviceId: 'svc-1',
  serviceName: 'Análise Pessoal',
  professionalId: 'pro-1',
  professionalName: 'Dra. Fulana',
  scheduledFor: daquiA(20),
  durationMinutes: 50,
  priceCents: 8000,
  tierId: 'escola',
  status: 'confirmed' as const,
  meetingLink: '',
  notes: '',
};

describe('faixa de lembrete', () => {
  it('sessão distante ainda não tem lembrete devido', () => {
    expect(worker.faixaPara(72)).toBeNull();
    expect(worker.faixaPara(25)).toBeNull();
  });

  it('faltando 20 horas, só a faixa de 24h foi alcançada', () => {
    expect(worker.faixasDevidas(20)).toEqual([24]);
    expect(worker.faixaPara(20)).toBe(24);
  });

  it('faltando menos de uma hora, as duas foram alcançadas — e vale a mais urgente', () => {
    // Quem agenda com meia hora de antecedência não pode receber "sua sessão é
    // amanhã". Foi exatamente esse o erro que este teste pegou na primeira
    // versão, que devolvia a faixa mais folgada.
    expect(worker.faixasDevidas(0.5)).toEqual([1, 24]);
    expect(worker.faixaPara(0.5)).toBe(1);
    expect(worker.faixaPara(1)).toBe(1);
  });

  it('sessão que já começou não recebe lembrete', () => {
    expect(worker.faixaPara(-0.1)).toBeNull();
    expect(worker.faixaPara(-50)).toBeNull();
  });
});

describe('quem entra na varredura', () => {
  it('lembra sessão confirmada que está por vir', async () => {
    await bookings.create({ ...base, scheduledFor: daquiA(20) });
    const r = await worker.tickWorker({ dryRun: true });
    expect(r.candidatos).toBe(1);
    expect(r.elegiveis).toBe(1);
  });

  it('não lembra quem ainda aguarda pagamento', async () => {
    // Chamar para uma hora que não está garantida seria pior do que calar.
    await bookings.create({ ...base, status: 'pending_payment', scheduledFor: daquiA(20) });
    const r = await worker.tickWorker({ dryRun: true });
    expect(r.candidatos).toBe(0);
  });

  it('não lembra sessão cancelada', async () => {
    const b = await bookings.create({ ...base, scheduledFor: daquiA(20) });
    await bookings.cancel(b.id, 'desistiu');
    const r = await worker.tickWorker({ dryRun: true });
    expect(r.candidatos).toBe(0);
  });

  it('não lembra sessão que já passou', async () => {
    await bookings.create({ ...base, scheduledFor: daquiA(-5) });
    const r = await worker.tickWorker({ dryRun: true });
    expect(r.candidatos).toBe(0);
  });

  it('sessão distante é candidata mas ainda não elegível', async () => {
    await bookings.create({ ...base, scheduledFor: daquiA(200) });
    const r = await worker.tickWorker({ dryRun: true });
    expect(r.candidatos).toBe(1);
    expect(r.elegiveis).toBe(0);
  });
});

describe('não repete', () => {
  it('agendou em cima da hora: recebe o de 1h e NUNCA o de "amanhã"', async () => {
    await bookings.create({ ...base, scheduledFor: daquiA(0.5) });
    const primeiro = await worker.tickWorker();
    expect(primeiro.enviados).toBe(1);
    // A faixa de 24h foi queimada junto: no tick seguinte não sobra nada para
    // dizer "amanhã" sobre uma sessão que já aconteceu ou está começando.
    const segundo = await worker.tickWorker();
    expect(segundo.enviados).toBe(0);
    expect(segundo.jaLembrados).toBe(1);
  });

  it('quem foi lembrado com 24h ainda recebe o de 1h quando a hora chega', async () => {
    const b = await bookings.create({ ...base, scheduledFor: daquiA(20) });
    expect((await worker.tickWorker()).enviados).toBe(1); // faixa 24
    // A sessão se aproxima: move para daqui a 30 minutos.
    await bookings.update(b.id, { scheduledFor: daquiA(0.5) });
    const perto = await worker.tickWorker();
    expect(perto.enviados).toBe(1); // agora a faixa 1
  });

  it('o mesmo lembrete não sai duas vezes, mesmo com tick de 15 min', async () => {
    await bookings.create({ ...base, scheduledFor: daquiA(20) });
    const primeiro = await worker.tickWorker();
    expect(primeiro.enviados).toBe(1);
    // O worker roda a cada 15 minutos; sem o ledger isto viraria dezenas de
    // e-mails para a mesma sessão.
    const segundo = await worker.tickWorker();
    expect(segundo.enviados).toBe(0);
    expect(segundo.jaLembrados).toBe(1);
  });
});

describe('texto', () => {
  it('diz "amanhã" na faixa de 24h e "em uma hora" na de 1h', () => {
    const b = { ...base, id: 'x', createdAt: '', updatedAt: '', cancelledAt: null, cancelReason: '', orderId: null };
    expect(worker.textoLembrete(24, b).corpo).toContain('amanhã');
    expect(worker.textoLembrete(1, b).corpo).toContain('em uma hora');
  });

  it('só promete link quando o link existe', () => {
    const semLink = { ...base, id: 'x', createdAt: '', updatedAt: '', cancelledAt: null, cancelReason: '', orderId: null };
    expect(worker.textoLembrete(24, semLink).corpo).not.toContain('http');
    const comLink = { ...semLink, meetingLink: 'https://meet.exemplo/z' };
    expect(worker.textoLembrete(24, comLink).corpo).toContain('https://meet.exemplo/z');
  });
});

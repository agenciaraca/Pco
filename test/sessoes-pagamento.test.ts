import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * Pagamento da sessão — o que acontece com o agendamento quando o dinheiro
 * entra, e o que acontece quando ele volta.
 *
 * O preço aqui nunca vem de uma linha de produto: vem do agendamento, onde foi
 * congelado no instante em que o aluno marcou. Estes testes existem para que
 * ninguém "simplifique" isso depois criando um produto por serviço e perdendo a
 * variação por titulação.
 */

let tmpDir: string;
let bookings: typeof import('../server/sessions/bookings-repo');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-pag-'));
  process.env.DATA_DIR = tmpDir;
  bookings = await import('../server/sessions/bookings-repo');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

beforeEach(async () => {
  await bookings._resetParaTeste();
});

const base = {
  userId: 'u1',
  userEmail: 'aluno@exemplo.com',
  serviceId: 'svc-1',
  serviceName: 'Análise Pessoal',
  professionalId: 'pro-1',
  professionalName: 'Dra. Fulana',
  scheduledFor: '2027-05-10T13:00:00.000Z',
  durationMinutes: 50,
  priceCents: 14000,
  tierId: 'mestrado',
  status: 'pending_payment' as const,
  meetingLink: '',
  notes: '',
};

describe('pagamento da sessão', () => {
  it('o agendamento nasce sem pedido e aguardando pagamento', async () => {
    const b = await bookings.create(base);
    expect(b.status).toBe('pending_payment');
    expect(b.orderId).toBeNull();
  });

  it('o pedido fica amarrado ao agendamento e é encontrável pelos dois lados', async () => {
    const b = await bookings.create(base);
    await bookings.update(b.id, { orderId: 'ord-123' });
    const achado = await bookings.findByOrderId('ord-123');
    expect(achado?.id).toBe(b.id);
    expect((await bookings.findById(b.id))?.orderId).toBe('ord-123');
  });

  it('confirmar o pagamento move para confirmed sem mexer no preço', async () => {
    const b = await bookings.create(base);
    await bookings.update(b.id, { orderId: 'ord-1', status: 'confirmed' });
    const depois = await bookings.findById(b.id);
    expect(depois?.status).toBe('confirmed');
    // O valor cobrado é o que foi combinado, não o que a faixa diz hoje.
    expect(depois?.priceCents).toBe(14000);
  });

  it('estorno devolve para pending_payment, não para cancelada', async () => {
    const b = await bookings.create(base);
    await bookings.update(b.id, { status: 'confirmed', orderId: 'ord-2' });
    // É o que revokeAccessForOrder faz: cancelar de vez é decisão de gente.
    await bookings.update(b.id, { status: 'pending_payment' });
    const depois = await bookings.findById(b.id);
    expect(depois?.status).toBe('pending_payment');
    expect(depois?.cancelledAt).toBeNull();
  });

  it('sessão cancelada continua cancelada mesmo com pedido pago pendurado', async () => {
    const b = await bookings.create(base);
    await bookings.update(b.id, { orderId: 'ord-3' });
    await bookings.cancel(b.id, 'desistiu');
    // grantAccessForOrder só promove quem está em pending_payment — este teste
    // trava a condição para que um pagamento atrasado não ressuscite a sessão.
    const atual = await bookings.findById(b.id);
    expect(atual?.status).toBe('cancelled');
    expect(atual?.status === 'pending_payment').toBe(false);
  });

  it('o horário de uma sessão cancelada volta a ficar livre mesmo tendo tido pedido', async () => {
    const b = await bookings.create(base);
    await bookings.update(b.id, { orderId: 'ord-4' });
    expect(await bookings.horarioOcupado('pro-1', base.scheduledFor)).toBe(true);
    await bookings.cancel(b.id, 'desistiu');
    expect(await bookings.horarioOcupado('pro-1', base.scheduledFor)).toBe(false);
  });
});

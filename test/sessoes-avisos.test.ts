import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * Avisos de sessão.
 *
 * A tela do aluno diz que "a coordenação confirma e envia o link da reunião".
 * Até 26/ago/2026 isso dependia de alguém lembrar de escrever o e-mail à mão.
 * Estes testes cobrem o texto de cada momento — porque texto de aviso é a parte
 * do sistema que chega ao aluno inteira, sem intermediário.
 */

let tmpDir: string;
let avisos: typeof import('../server/sessions/avisos');
type Booking = import('../server/sessions/bookings-repo').SessionBooking;

const base: Booking = {
  id: 'bkg-1',
  userId: 'u1',
  userEmail: 'aluno@exemplo.com',
  serviceId: 'svc-1',
  serviceName: 'Análise Pessoal',
  professionalId: 'pro-1',
  professionalName: 'Dra. Fulana',
  scheduledFor: '2027-03-01T17:00:00.000Z',
  durationMinutes: 50,
  priceCents: 14000,
  tierId: 'mestrado',
  status: 'pending_payment',
  meetingLink: '',
  notes: '',
  createdAt: '2026-08-26T10:00:00.000Z',
  updatedAt: '2026-08-26T10:00:00.000Z',
  cancelledAt: null,
  cancelReason: '',
  orderId: null,
};

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-avi-'));
  process.env.DATA_DIR = tmpDir;
  avisos = await import('../server/sessions/avisos');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('texto do aviso', () => {
  it('reserva aguardando pagamento fala do valor e do que falta', () => {
    const t = avisos.textoDe('criada', base);
    expect(t.corpo).toContain('aguardando o pagamento');
    expect(t.corpo).toContain('R$');
    expect(t.corpo).toContain('140,00');
  });

  it('reserva com confirmação manual NÃO promete pagamento', () => {
    const t = avisos.textoDe('criada', { ...base, status: 'scheduled' });
    expect(t.corpo).not.toContain('pagamento');
    expect(t.corpo).toContain('coordenação');
  });

  it('confirmação com link entrega o link; sem link, não promete o que não tem', () => {
    const comLink = avisos.textoDe('confirmada', {
      ...base,
      status: 'confirmed',
      meetingLink: 'https://meet.exemplo/abc',
    });
    expect(comLink.corpo).toContain('https://meet.exemplo/abc');

    const semLink = avisos.textoDe('confirmada', { ...base, status: 'confirmed' });
    expect(semLink.corpo).not.toContain('http');
    expect(semLink.corpo).toContain('antes do horário');
  });

  it('cancelamento carrega o motivo quando existe', () => {
    const com = avisos.textoDe('cancelada', {
      ...base,
      status: 'cancelled',
      cancelReason: 'profissional adoeceu',
    });
    expect(com.corpo).toContain('profissional adoeceu');
    const sem = avisos.textoDe('cancelada', { ...base, status: 'cancelled' });
    expect(sem.corpo).toContain('foi cancelada');
  });

  it('todo aviso nomeia o serviço e quem atende', () => {
    for (const ev of ['criada', 'confirmada', 'cancelada', 'remarcada'] as const) {
      const t = avisos.textoDe(ev, base);
      expect(t.assunto).toContain('Análise Pessoal');
      expect(t.assunto).toContain('Dra. Fulana');
      expect(t.titulo.length).toBeGreaterThan(0);
    }
  });

  it('o cancelamento é a única categoria de alerta', () => {
    expect(avisos.textoDe('cancelada', base).categoria).toBe('warning');
    expect(avisos.textoDe('confirmada', base).categoria).toBe('success');
    expect(avisos.textoDe('criada', base).categoria).toBe('info');
    expect(avisos.textoDe('remarcada', base).categoria).toBe('info');
  });
});

describe('robustez', () => {
  it('avisar nunca lança, mesmo sem provedor de e-mail configurado', async () => {
    // Quem chama está no meio de uma operação que já deu certo no banco: falhar
    // o aviso não pode desfazê-la nem devolver 500 ao admin.
    await expect(avisos.avisar('criada', base)).resolves.toBeDefined();
  });

  it('a notificação no ambiente é gravada mesmo quando o e-mail não sai', async () => {
    const r = await avisos.avisar('confirmada', { ...base, status: 'confirmed' });
    expect(r.notificado).toBe(true);
  });
});

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * Agendamento de sessão — as regras que impedem a tela de voltar a mentir.
 *
 * Até 25/ago/2026 "Confirmar agendamento" só avançava um passo local: nada era
 * gravado e o aluno recebia uma promessa de link por e-mail que ninguém ia
 * cumprir. Estes testes cobrem o que passou a existir, e sobretudo o que deve
 * ser recusado.
 */

let tmpDir: string;
let bookings: typeof import('../server/sessions/bookings-repo');
let sessions: typeof import('../server/repositories/sessions');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-bkg-'));
  process.env.DATA_DIR = tmpDir;
  bookings = await import('../server/sessions/bookings-repo');
  sessions = await import('../server/repositories/sessions');
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
  professionalName: 'Profissional Um',
  scheduledFor: '2027-03-01T14:00:00.000Z',
  durationMinutes: 50,
  priceCents: 8000,
  tierId: 'escola',
  status: 'pending_payment' as const,
  meetingLink: '',
  notes: '',
};

describe('agendamento de sessão', () => {
  it('grava e devolve o agendamento com id próprio', async () => {
    const b = await bookings.create(base);
    expect(b.id).toMatch(/^bkg-/);
    expect(b.createdAt).toBeTruthy();
    expect(await bookings.findById(b.id)).not.toBeNull();
  });

  it('o preço fica travado no agendamento, não segue a faixa depois', async () => {
    const b = await bookings.create({ ...base, priceCents: 8000 });
    // O admin reajusta a faixa que originou o preço.
    await sessions.upsertPriceTier({
      id: 'escola',
      label: 'Profissional da escola',
      description: '',
      priceCents: 99900,
      active: true,
      order: 1,
    });
    const guardado = await bookings.findById(b.id);
    expect(guardado?.priceCents).toBe(8000);
  });

  it('cada aluno só enxerga as próprias sessões', async () => {
    await bookings.create(base);
    await bookings.create({ ...base, userId: 'u2', scheduledFor: '2027-03-02T14:00:00.000Z' });
    expect((await bookings.listForUser('u1')).length).toBe(1);
    expect((await bookings.listForUser('u2')).length).toBe(1);
    expect((await bookings.listAll()).length).toBe(2);
  });

  it('o mesmo profissional no mesmo horário conta como ocupado', async () => {
    await bookings.create(base);
    expect(await bookings.horarioOcupado('pro-1', base.scheduledFor)).toBe(true);
    // Outro profissional no mesmo horário, livre.
    expect(await bookings.horarioOcupado('pro-2', base.scheduledFor)).toBe(false);
    // Mesmo profissional, outro horário, livre.
    expect(await bookings.horarioOcupado('pro-1', '2027-03-01T15:00:00.000Z')).toBe(false);
  });

  it('cancelar libera o horário e preserva o registro', async () => {
    const b = await bookings.create(base);
    await bookings.cancel(b.id, 'imprevisto');
    const depois = await bookings.findById(b.id);
    expect(depois?.status).toBe('cancelled');
    expect(depois?.cancelReason).toBe('imprevisto');
    expect(depois?.cancelledAt).toBeTruthy();
    // O registro continua existindo — cancelar não é apagar.
    expect((await bookings.listAll()).length).toBe(1);
    expect(await bookings.horarioOcupado('pro-1', base.scheduledFor)).toBe(false);
  });
});

describe('preço por titulação — o que impede sessão de graça', () => {
  it('titulação sem faixa correspondente marca preço indefinido, não zero', async () => {
    const criado = await sessions.createProfessional({
      name: 'Sem Faixa',
      email: 'semfaixa@exemplo.com',
      bio: '',
      credentials: '',
      level: 'titulacao-que-nao-existe',
      avatarColor: 'from-pco-blue to-pco-cyan',
      hourlyRate: 0,
      specialties: [],
      serviceIds: ['svc-1'],
      active: true,
      available: true,
    });
    expect(criado.precoIndefinido).toBe(true);
    expect(await sessions.faixaValida('titulacao-que-nao-existe')).toBe(false);
    expect(await sessions.faixaValida('escola')).toBe(true);
  });

  it('faixa inativa não precifica — desativar no admin realmente desativa', async () => {
    await sessions.upsertPriceTier({
      id: 'faixa-teste',
      label: 'Faixa de teste',
      description: '',
      priceCents: 12345,
      active: true,
      order: 9,
    });
    expect(await sessions.faixaValida('faixa-teste')).toBe(true);

    await sessions.upsertPriceTier({
      id: 'faixa-teste',
      label: 'Faixa de teste',
      description: '',
      priceCents: 12345,
      active: false,
      order: 9,
    });
    expect(await sessions.faixaValida('faixa-teste')).toBe(false);
  });
});

describe('disponibilidade falha fechada', () => {
  it('profissional sem serviço marcado não é oferecido para nenhum serviço', async () => {
    const p = await sessions.createProfessional({
      name: 'Sem Serviço',
      email: 'semservico@exemplo.com',
      bio: '',
      credentials: '',
      level: 'escola',
      avatarColor: 'from-pco-blue to-pco-cyan',
      hourlyRate: 0,
      specialties: [],
      serviceIds: [],
      active: true,
      available: true,
    });
    const oferecidos = await sessions.listAvailableProfessionals('svc-1');
    expect(oferecidos.some((x) => x.id === p.id)).toBe(false);
    // E também não vaza para a lista sem filtro de serviço.
    expect((await sessions.listAvailableProfessionals()).some((x) => x.id === p.id)).toBe(false);
  });

  it('profissional sem faixa de preço válida também não é oferecido', async () => {
    const p = await sessions.createProfessional({
      name: 'Preço Indefinido',
      email: 'indef@exemplo.com',
      bio: '',
      credentials: '',
      level: 'inexistente',
      avatarColor: 'from-pco-blue to-pco-cyan',
      hourlyRate: 0,
      specialties: [],
      serviceIds: ['svc-1'],
      active: true,
      available: true,
    });
    const oferecidos = await sessions.listAvailableProfessionals('svc-1');
    expect(oferecidos.some((x) => x.id === p.id)).toBe(false);
  });

  it('quem tem serviço e faixa aparece — a regra não fecha demais', async () => {
    const p = await sessions.createProfessional({
      name: 'Completo',
      email: 'completo@exemplo.com',
      bio: '',
      credentials: '',
      level: 'escola',
      avatarColor: 'from-pco-blue to-pco-cyan',
      hourlyRate: 0,
      specialties: [],
      serviceIds: ['svc-1'],
      active: true,
      available: true,
    });
    const oferecidos = await sessions.listAvailableProfessionals('svc-1');
    expect(oferecidos.some((x) => x.id === p.id)).toBe(true);
    // Mas não para um serviço que ele não atende.
    expect((await sessions.listAvailableProfessionals('svc-9')).some((x) => x.id === p.id)).toBe(
      false,
    );
  });
});

describe('ids de sessão', () => {
  it('não usam Date.now — criação em lote não colide', async () => {
    const criados = await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        bookings.create({ ...base, scheduledFor: `2027-04-0${(i % 9) + 1}T10:00:00.000Z` }),
      ),
    );
    const ids = new Set(criados.map((b) => b.id));
    expect(ids.size).toBe(25);
  });
});

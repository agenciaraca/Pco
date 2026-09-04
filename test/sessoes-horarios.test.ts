import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { naoVazio } from './nao-vazio';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * A agenda que o aluno vê ao marcar sessão.
 *
 * Antes de 27/ago/2026 eram oito horários fixos sob o título "Horários
 * disponíveis", sem consulta nenhuma. O servidor já barrava a colisão, então
 * ninguém marcava em cima de ninguém — mas o aluno escolhia um horário tomado,
 * preenchia tudo e só descobria no envio.
 */

let tmpDir: string;
let horarios: typeof import('../server/sessions/horarios');

/** Uma quarta-feira qualquer, às 8h da manhã: nenhum horário passou ainda. */
const MANHA = new Date(2026, 8, 2, 8, 0, 0);

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-horarios-'));
  process.env.DATA_DIR = tmpDir;

  // Uma sessão já marcada às 15:00 com o profissional p-1.
  const agendamentos = [
    {
      id: 'bk-existente',
      studentId: 's-outro',
      studentName: 'Outro Aluno',
      professionalId: 'p-1',
      professionalName: 'Profissional Um',
      serviceId: 'sv-analise',
      serviceName: 'Análise',
      scheduledFor: new Date(2026, 8, 2, 15, 0, 0).toISOString(),
      durationMinutes: 50,
      priceCents: 8000,
      status: 'confirmed',
      notes: '',
      createdAt: new Date(2026, 8, 1).toISOString(),
      updatedAt: new Date(2026, 8, 1).toISOString(),
    },
  ];
  await fs.writeFile(
    path.join(tmpDir, 'session-bookings.json'),
    JSON.stringify(agendamentos, null, 2),
    'utf8',
  );

  horarios = await import('../server/sessions/horarios');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('agenda do dia', () => {
  it('devolve a faixa padrão da escola', async () => {
    const a = await horarios.agendaDoDia('p-2', '2026-09-02', MANHA);
    expect(a.slots.map((s) => s.hora)).toEqual([...horarios.HORARIOS_PADRAO]);
    expect(a.durationMinutes).toBe(50);
  });

  it('horário já reservado sai bloqueado, com o motivo', async () => {
    const a = await horarios.agendaDoDia('p-1', '2026-09-02', MANHA);
    const quinze = a.slots.find((s) => s.hora === '15:00');
    expect(quinze?.disponivel).toBe(false);
    expect(quinze?.motivo).toBe('ocupado');
  });

  it('a sessão de 50 min não derruba o horário seguinte — encostar não é sobrepor', async () => {
    const a = await horarios.agendaDoDia('p-1', '2026-09-02', MANHA);
    expect(a.slots.find((s) => s.hora === '16:00')?.disponivel).toBe(true);
    expect(a.slots.find((s) => s.hora === '14:00')?.disponivel).toBe(true);
  });

  it('a agenda de um profissional não bloqueia a de outro', async () => {
    const a = await horarios.agendaDoDia('p-2', '2026-09-02', MANHA);
    expect(a.slots.find((s) => s.hora === '15:00')?.disponivel).toBe(true);
  });

  it('horário que já passou não é oferecido', async () => {
    // Mesmo dia, mas às 16h: só 17:00 e 18:00 sobram.
    const tarde = new Date(2026, 8, 2, 16, 0, 0);
    const a = await horarios.agendaDoDia('p-2', '2026-09-02', tarde);
    expect(a.slots.find((s) => s.hora === '09:00')?.motivo).toBe('passado');
    expect(a.slots.find((s) => s.hora === '16:00')?.motivo).toBe('passado');
    expect(a.slots.find((s) => s.hora === '17:00')?.disponivel).toBe(true);
  });

  it('dia inteiro no passado não oferece nada', async () => {
    const a = await horarios.agendaDoDia('p-2', '2026-09-01', MANHA);
    expect(naoVazio(a.slots).every((s) => !s.disponivel)).toBe(true);
    expect(naoVazio(a.slots).every((s) => s.motivo === 'passado')).toBe(true);
  });

  it('a observação não promete a agenda pessoal do profissional', async () => {
    const a = await horarios.agendaDoDia('p-2', '2026-09-02', MANHA);
    // O sistema não modela grade individual — a tela precisa dizer isso.
    expect(a.observacao).toMatch(/agenda pessoal/i);
  });

  it('não vaza quem ocupa o horário', async () => {
    const a = await horarios.agendaDoDia('p-1', '2026-09-02', MANHA);
    const bruto = JSON.stringify(a);
    expect(bruto).not.toContain('Outro Aluno');
    expect(bruto).not.toContain('s-outro');
  });
});

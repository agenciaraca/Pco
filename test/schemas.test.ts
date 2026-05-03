import { describe, it, expect } from 'vitest';
import {
  loginSchema,
  createSupportTicketSchema,
  recoveryPlanSchema,
  forgotPasswordSchema,
} from '../shared/schemas';

describe('shared/schemas', () => {
  describe('loginSchema', () => {
    it('valida payload válido', () => {
      const r = loginSchema.safeParse({
        email: 'aluno@pco.local',
        password: 'demo1234',
      });
      expect(r.success).toBe(true);
    });

    it('rejeita e-mail inválido', () => {
      const r = loginSchema.safeParse({ email: 'nao-eh-email', password: 'demo1234' });
      expect(r.success).toBe(false);
    });

    it('rejeita senha curta', () => {
      const r = loginSchema.safeParse({ email: 'a@b.com', password: '123' });
      expect(r.success).toBe(false);
    });
  });

  describe('forgotPasswordSchema', () => {
    it('aceita e-mail bem formado', () => {
      expect(forgotPasswordSchema.safeParse({ email: 'x@y.com' }).success).toBe(true);
    });

    it('rejeita string vazia', () => {
      expect(forgotPasswordSchema.safeParse({ email: '' }).success).toBe(false);
    });
  });

  describe('createSupportTicketSchema', () => {
    it('exige assunto com 4+ caracteres', () => {
      const r = createSupportTicketSchema.safeParse({
        subject: 'oi',
        category: 'duvida_aula',
        message: 'mensagem com mais de 10 caracteres',
      });
      expect(r.success).toBe(false);
    });

    it('exige mensagem com 10+ caracteres', () => {
      const r = createSupportTicketSchema.safeParse({
        subject: 'Assunto válido',
        category: 'duvida_aula',
        message: 'curta',
      });
      expect(r.success).toBe(false);
    });

    it('aceita payload completo', () => {
      const r = createSupportTicketSchema.safeParse({
        subject: 'Assunto válido',
        category: 'duvida_aula',
        message: 'Esta é uma mensagem de teste com mais de 10 caracteres',
      });
      expect(r.success).toBe(true);
    });
  });

  describe('recoveryPlanSchema', () => {
    it('aceita payload completo', () => {
      const r = recoveryPlanSchema.safeParse({
        studentId: 's-101',
        tone: 'acolhedor',
        channel: 'in_app',
        intensity: 'media',
        goal: 'Retomar o módulo 2',
        includeTutor: true,
        includePod: true,
        includeLibrary: false,
      });
      expect(r.success).toBe(true);
    });

    it('rejeita tom desconhecido', () => {
      const r = recoveryPlanSchema.safeParse({
        studentId: 's-101',
        tone: 'agressivo',
        channel: 'in_app',
        intensity: 'media',
        goal: 'algo',
        includeTutor: true,
        includePod: true,
        includeLibrary: true,
      });
      expect(r.success).toBe(false);
    });
  });
});

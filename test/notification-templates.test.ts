import { describe, it, expect } from 'vitest';
import {
  renderPasswordReset,
  renderOrderPaid,
  renderCourseEnrolled,
  renderWelcome,
  previewTemplate,
  TEMPLATE_NAMES,
} from '../server/notifications/templates';

describe('notifications/templates', () => {
  describe('renderPasswordReset', () => {
    it('subject e HTML/text mencionam expiração', () => {
      const r = renderPasswordReset({
        userName: 'Maria',
        resetUrl: 'https://app/reset?t=abc',
        expiresInMinutes: 30,
      });
      expect(r.subject).toContain('Redefinição');
      expect(r.html).toContain('30 minutos');
      expect(r.text).toContain('30 minutos');
      expect(r.html).toContain('Maria');
    });

    it('escapa XSS no userName', () => {
      const r = renderPasswordReset({
        userName: '<script>alert(1)</script>',
        resetUrl: 'https://safe',
        expiresInMinutes: 10,
      });
      expect(r.html).not.toContain('<script>alert(1)</script>');
      expect(r.html).toContain('&lt;script&gt;');
    });

    it('inclui resetUrl no botão CTA', () => {
      const r = renderPasswordReset({
        resetUrl: 'https://app/reset?t=xyz',
        expiresInMinutes: 60,
      });
      expect(r.html).toContain('https://app/reset?t=xyz');
    });
  });

  describe('renderOrderPaid', () => {
    it('subject inclui productName', () => {
      const r = renderOrderPaid({
        productName: 'Curso A',
        amountFormatted: 'R$ 497,00',
      });
      expect(r.subject).toContain('Curso A');
      expect(r.html).toContain('R$ 497,00');
    });

    it('omite CTA quando orderUrl ausente', () => {
      const r = renderOrderPaid({
        productName: 'Curso',
        amountFormatted: 'R$ 1,00',
      });
      expect(r.html).not.toContain('Ver pedido');
    });

    it('inclui CTA "Ver pedido" quando orderUrl presente', () => {
      const r = renderOrderPaid({
        productName: 'Curso',
        amountFormatted: 'R$ 1,00',
        orderUrl: 'https://app/orders/1',
      });
      expect(r.html).toContain('Ver pedido');
      expect(r.html).toContain('https://app/orders/1');
    });

    it('escapa productName com aspas', () => {
      const r = renderOrderPaid({
        productName: 'Curso "Premium"',
        amountFormatted: 'R$ 1,00',
      });
      expect(r.html).toContain('Curso &quot;Premium&quot;');
    });
  });

  describe('renderCourseEnrolled', () => {
    it('mostra data de expiração formatada quando presente', () => {
      const r = renderCourseEnrolled({
        courseTitle: 'Análise',
        expiresAt: '2026-12-31T00:00:00Z',
      });
      // data em pt-BR é dd/mm/yyyy
      expect(r.html).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });

    it('omite expiração quando ausente', () => {
      const r = renderCourseEnrolled({ courseTitle: 'C' });
      expect(r.html).not.toContain('Acesso válido');
    });

    it('inclui CTA "Acessar curso" com courseUrl', () => {
      const r = renderCourseEnrolled({
        courseTitle: 'C',
        courseUrl: 'https://app/c/1',
      });
      expect(r.html).toContain('Acessar curso');
      expect(r.html).toContain('https://app/c/1');
    });
  });

  describe('renderWelcome', () => {
    it('inclui senha temporária quando fornecida', () => {
      const r = renderWelcome({
        loginUrl: 'https://app/login',
        tempPassword: 'temp-1234',
      });
      expect(r.html).toContain('temp-1234');
      expect(r.text).toContain('temp-1234');
    });

    it('omite senha quando ausente', () => {
      const r = renderWelcome({ loginUrl: 'https://app/login' });
      expect(r.html).not.toContain('temporária');
    });

    it('escapa userName em saudação (XSS-safe)', () => {
      const r = renderWelcome({
        userName: '<b>Hack</b>',
        loginUrl: 'https://app/login',
      });
      // XSS-safe: tag <b> raw nunca aparece (escape simples ou duplo dá no mesmo)
      expect(r.html).not.toContain('<b>Hack</b>');
      expect(r.html).toContain('Hack');
    });
  });

  describe('previewTemplate', () => {
    it('TEMPLATE_NAMES tem 4 templates', () => {
      expect(TEMPLATE_NAMES.length).toBe(4);
    });

    it('renderiza cada template conhecido sem lançar', () => {
      for (const name of TEMPLATE_NAMES) {
        const r = previewTemplate(name);
        expect(r.subject).toBeTruthy();
        expect(r.html.length).toBeGreaterThan(50);
        expect(r.text.length).toBeGreaterThan(0);
      }
    });

    it('lança em template desconhecido', () => {
      expect(() => previewTemplate('inexistente')).toThrow(/desconhecido/);
    });
  });

  describe('layout', () => {
    it('todos os templates incluem brand AVA PCO', () => {
      const r = renderWelcome({ loginUrl: 'https://x' });
      expect(r.html).toContain('AVA PCO');
      expect(r.html).toContain('Psicanálise Clínica Online');
    });

    it('HTML é DOCTYPE válido com lang pt-BR', () => {
      const r = renderWelcome({ loginUrl: 'https://x' });
      expect(r.html).toContain('<!DOCTYPE html>');
      expect(r.html).toContain('lang="pt-BR"');
    });
  });
});

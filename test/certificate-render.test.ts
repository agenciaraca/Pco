import { describe, it, expect } from 'vitest';
import { renderCertificateHtml } from '../server/repositories/certificate-render';
import type { Certificate } from '../src/app/types/schema';

const baseCert: Certificate = {
  id: 'cert-test-1',
  courseId: 'c1',
  studentId: 's1',
  issuedAt: '2025-03-15T10:00:00Z',
  validationCode: 'ABC123XYZ',
  qrCodeMockUrl: '/qr/ABC.png',
  status: 'issued',
  progress: 100,
};

describe('renderCertificateHtml', () => {
  it('inclui nome do aluno e curso', () => {
    const html = renderCertificateHtml({
      certificate: baseCert,
      studentName: 'Maria Silva',
      courseName: 'Psicanálise Aplicada',
    });
    expect(html).toContain('Maria Silva');
    expect(html).toContain('Psicanálise Aplicada');
  });

  it('inclui código de validação', () => {
    const html = renderCertificateHtml({
      certificate: baseCert,
      studentName: 'João',
      courseName: 'Curso X',
    });
    expect(html).toContain('ABC123XYZ');
  });

  it('inclui carga horária quando fornecida', () => {
    const html = renderCertificateHtml({
      certificate: baseCert,
      studentName: 'João',
      courseName: 'Curso X',
      courseHours: 80,
    });
    expect(html).toContain('80h de carga horária');
  });

  it('omite carga horária quando ausente', () => {
    const html = renderCertificateHtml({
      certificate: baseCert,
      studentName: 'João',
      courseName: 'Curso X',
    });
    expect(html).not.toContain('carga horária');
  });

  it('formata data em pt-BR', () => {
    const html = renderCertificateHtml({
      certificate: baseCert,
      studentName: 'João',
      courseName: 'Curso X',
    });
    // data formatada como "15 de março de 2025" ou "14 de março" se TZ negativo
    expect(html).toMatch(/de mar(ço|ço) de 2025|14 de mar/);
  });

  it('escapa HTML para prevenir XSS', () => {
    const html = renderCertificateHtml({
      certificate: { ...baseCert, validationCode: '<script>alert(1)</script>' },
      studentName: '<img src=x onerror=alert(1)>',
      courseName: '<b>Curso</b>',
    });
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;img src=x');
    expect(html).toContain('&lt;script&gt;');
  });

  it('inclui URL de validação completa quando baseUrl fornecida', () => {
    const html = renderCertificateHtml({
      certificate: baseCert,
      studentName: 'João',
      courseName: 'Curso X',
      validationBaseUrl: 'https://meusite.com',
    });
    expect(html).toContain('https://meusite.com/verificar/ABC123XYZ');
  });

  it('botão print presente, escondido em @media print', () => {
    const html = renderCertificateHtml({
      certificate: baseCert,
      studentName: 'João',
      courseName: 'Curso X',
    });
    expect(html).toContain('window.print()');
    expect(html).toContain('@media print');
    expect(html).toContain('.actions { display: none; }');
  });

  describe('templates customizáveis', () => {
    it('usa título customizado', () => {
      const html = renderCertificateHtml({
        certificate: baseCert,
        studentName: 'Maria',
        courseName: 'X',
        template: { title: 'Diploma de Especialização' },
      });
      expect(html).toContain('Diploma de Especialização');
      expect(html).not.toContain('>Certificado de Conclusão<');
    });

    it('aplica accentColor em vez do default', () => {
      const html = renderCertificateHtml({
        certificate: baseCert,
        studentName: 'Maria',
        courseName: 'X',
        template: { accentColor: '#ff0000' },
      });
      expect(html).toContain('#ff0000');
    });

    it('substitui {{course}} e {{hours}} no bodyText', () => {
      const html = renderCertificateHtml({
        certificate: baseCert,
        studentName: 'Maria',
        courseName: 'Curso Teste',
        courseHours: 40,
        template: {
          bodyText: 'completou o curso {{course}} ({{hours}}).',
        },
      });
      expect(html).toContain('Curso Teste');
      expect(html).toContain('40h');
    });

    it('renderiza logo quando logoUrl preenchido', () => {
      const html = renderCertificateHtml({
        certificate: baseCert,
        studentName: 'Maria',
        courseName: 'X',
        template: { logoUrl: 'https://example.com/logo.png' },
      });
      expect(html).toContain('https://example.com/logo.png');
      expect(html).toContain('class="logo"');
    });

    it('preamble customizado substitui o default', () => {
      const html = renderCertificateHtml({
        certificate: baseCert,
        studentName: 'Maria',
        courseName: 'X',
        template: { preamble: 'É um privilégio declarar que' },
      });
      expect(html).toContain('É um privilégio declarar que');
      expect(html).not.toContain('>Certificamos que<');
    });

    it('signature customizada via template tem prioridade sobre ctx', () => {
      const html = renderCertificateHtml({
        certificate: baseCert,
        studentName: 'Maria',
        courseName: 'X',
        signatureName: 'Padrão',
        template: { signatureName: 'João Custom' },
      });
      expect(html).toContain('João Custom');
      expect(html).not.toContain('Padrão');
    });
  });
});

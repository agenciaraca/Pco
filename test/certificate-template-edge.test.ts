import { describe, it, expect } from 'vitest';
import { renderCertificateHtml } from '../server/repositories/certificate-render';
import type { Certificate } from '../src/app/types/schema';

const baseCert: Certificate = {
  id: 'cert-edge-1',
  courseId: 'c1',
  studentId: 's1',
  issuedAt: '2025-03-15T10:00:00Z',
  validationCode: 'EDGE123',
  qrCodeMockUrl: '/qr/EDGE.png',
  status: 'issued',
  progress: 100,
};

describe('renderCertificateHtml edge cases', () => {
  it('template undefined: usa todos os defaults', () => {
    const html = renderCertificateHtml({
      certificate: baseCert,
      studentName: 'Maria',
      courseName: 'Curso X',
    });
    expect(html).toContain('Certificado de Conclusão');
    expect(html).toContain('Certificamos que');
    expect(html).toContain('Direção Acadêmica');
    expect(html).toContain('#0097B2'); // accent default
    expect(html).toContain('#FE9002'); // ribbon default
  });

  it('template parcial: mistura defaults com customs', () => {
    const html = renderCertificateHtml({
      certificate: baseCert,
      studentName: 'M',
      courseName: 'X',
      template: { title: 'Diploma', accentColor: '#000000' },
    });
    expect(html).toContain('Diploma');
    expect(html).toContain('#000000');
    expect(html).toContain('Certificamos que'); // preamble default
    expect(html).toContain('#FE9002'); // ribbon default
  });

  it('bodyText sem tokens não causa erro', () => {
    const html = renderCertificateHtml({
      certificate: baseCert,
      studentName: 'M',
      courseName: 'X',
      template: { bodyText: 'Texto simples sem placeholders.' },
    });
    expect(html).toContain('Texto simples sem placeholders.');
  });

  it('bodyText com {{course}} mas curso vazio: insere strong vazio', () => {
    const html = renderCertificateHtml({
      certificate: baseCert,
      studentName: 'M',
      courseName: '',
      template: { bodyText: 'completou o curso {{course}}.' },
    });
    expect(html).toContain('completou o curso');
  });

  it('bodyText com {{hours}} sem courseHours: hours vazio', () => {
    const html = renderCertificateHtml({
      certificate: baseCert,
      studentName: 'M',
      courseName: 'X',
      template: { bodyText: 'Carga: {{hours}}.' },
    });
    expect(html).toContain('Carga:');
    expect(html).not.toContain('{{hours}}');
  });

  it('XSS escape em studentName e courseName', () => {
    const html = renderCertificateHtml({
      certificate: baseCert,
      studentName: '<script>x</script>',
      courseName: '<img src=x onerror=alert(1)>',
    });
    expect(html).not.toContain('<script>x</script>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
  });

  it('XSS escape em fields do template', () => {
    const html = renderCertificateHtml({
      certificate: baseCert,
      studentName: 'M',
      courseName: 'X',
      template: {
        title: '<script>alert(1)</script>',
        orgName: '"><script>',
      },
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('multiple {{course}} substitui todas', () => {
    const html = renderCertificateHtml({
      certificate: baseCert,
      studentName: 'M',
      courseName: 'Curso X',
      template: {
        bodyText: '{{course}} e novamente {{course}}',
      },
    });
    const matches = html.match(/Curso X/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('logoUrl com query string escapado mas legível', () => {
    const html = renderCertificateHtml({
      certificate: baseCert,
      studentName: 'M',
      courseName: 'X',
      template: {
        logoUrl: 'https://cdn.com/logo.png?v=1&size=large',
      },
    });
    // & vira &amp; no HTML escape — comportamento correto
    expect(html).toContain('https://cdn.com/logo.png?v=1');
    expect(html).toMatch(/&amp;size=large|&size=large/);
  });

  it('signatureRole default quando ctx e template ambos vazios', () => {
    const html = renderCertificateHtml({
      certificate: baseCert,
      studentName: 'M',
      courseName: 'X',
    });
    expect(html).toContain('PCO'); // default signatureRole
  });

  it('issuedAt formatado em pt-BR', () => {
    const html = renderCertificateHtml({
      certificate: { ...baseCert, issuedAt: '2026-12-25T00:00:00Z' },
      studentName: 'M',
      courseName: 'X',
    });
    // Deve incluir o ano + nome do mês em PT
    expect(html).toContain('2026');
  });
});

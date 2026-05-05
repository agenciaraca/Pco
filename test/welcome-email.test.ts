import { describe, it, expect } from 'vitest';
import { renderWelcomeEmail } from '../server/notifications/welcome';

describe('renderWelcomeEmail', () => {
  it('inclui nome no subject e html', () => {
    const r = renderWelcomeEmail({
      email: 'a@b.com',
      name: 'João',
    });
    expect(r.subject).toContain('João');
    expect(r.html).toContain('João');
    expect(r.text).toContain('João');
  });

  it('inclui senha temporária quando fornecida', () => {
    const r = renderWelcomeEmail({
      email: 'a@b.com',
      name: 'Maria',
      tempPassword: 'pco-test-123',
    });
    expect(r.html).toContain('pco-test-123');
    expect(r.text).toContain('pco-test-123');
  });

  it('omite seção de senha quando não fornecida', () => {
    const r = renderWelcomeEmail({
      email: 'a@b.com',
      name: 'Maria',
    });
    expect(r.html).not.toContain('senha temporária');
    expect(r.html).not.toContain('Senha temporária');
  });

  it('lista cursos quando fornecidos', () => {
    const r = renderWelcomeEmail({
      email: 'a@b.com',
      name: 'João',
      enrolledCourseTitles: ['Curso 1', 'Curso 2'],
    });
    expect(r.html).toContain('Curso 1');
    expect(r.html).toContain('Curso 2');
    expect(r.html).toContain('Cursos liberados');
  });

  it('omite cursos quando lista vazia', () => {
    const r = renderWelcomeEmail({
      email: 'a@b.com',
      name: 'João',
      enrolledCourseTitles: [],
    });
    expect(r.html).not.toContain('Cursos liberados');
  });

  it('escapa HTML em nome e cursos (XSS)', () => {
    const r = renderWelcomeEmail({
      email: 'a@b.com',
      name: '<script>alert(1)</script>',
      enrolledCourseTitles: ['<img src=x>'],
      tempPassword: '<b>not-bold</b>',
    });
    expect(r.html).not.toContain('<script>alert');
    expect(r.html).not.toContain('<img src=x>');
    expect(r.html).toContain('&lt;script&gt;');
    expect(r.html).toContain('&lt;img src=x&gt;');
    // password também escapada
    expect(r.html).toContain('&lt;b&gt;not-bold');
  });

  it('usa loginUrl customizado quando fornecido', () => {
    const r = renderWelcomeEmail({
      email: 'a@b.com',
      name: 'João',
      loginUrl: 'https://meusite.com/entrar',
    });
    expect(r.html).toContain('https://meusite.com/entrar');
  });

  it('default loginUrl', () => {
    const r = renderWelcomeEmail({
      email: 'a@b.com',
      name: 'João',
    });
    expect(r.html).toContain('ava.psicanaliseclinica.online');
  });
});

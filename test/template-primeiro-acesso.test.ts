import { describe, it, expect } from 'vitest';
import { renderPrimeiroAcesso } from '../server/notifications/templates';

// O convite vai para ~1.600 pessoas que NÃO pediram nada e não são novas: já
// eram alunas antes do AVA. Se o e-mail parecer "esqueci minha senha" ou
// "bem-vindo", vira lixeira ou denúncia de phishing — e aí a migração inteira
// trava por um problema de texto.

describe('convite de primeiro acesso', () => {
  const base = {
    userName: 'Maria Silva',
    setPasswordUrl: 'https://ava.psicanaliseclinica.online/redefinir-senha?token=abc',
    expiresInDays: 7,
  };

  it('diz logo no assunto que o acesso mudou de lugar', () => {
    const r = renderPrimeiroAcesso(base);
    expect(r.subject.toLowerCase()).toMatch(/acesso|endereço|ative/);
    expect(r.subject.toLowerCase()).not.toContain('esqueci');
  });

  it('explica que o histórico foi preservado — é o que tira o medo de ser golpe', () => {
    const r = renderPrimeiroAcesso(base);
    expect(r.text).toMatch(/hist[óo]rico|progresso/i);
  });

  it('nunca leva senha dentro do e-mail', () => {
    const r = renderPrimeiroAcesso(base);
    expect(r.text.toLowerCase()).not.toMatch(/senha tempor[áa]ria|sua senha [ée]/);
    expect(r.html.toLowerCase()).not.toMatch(/senha tempor[áa]ria/);
  });

  it('informa o prazo do link, para quem abrir dias depois saber o que fazer', () => {
    const r = renderPrimeiroAcesso(base);
    expect(r.text).toContain('7 dias');
    expect(r.text.toLowerCase()).toContain('esqueci minha senha');
  });

  it('lista os cursos quando informados, e não inventa seção vazia quando não', () => {
    const com = renderPrimeiroAcesso({ ...base, courseNames: ['Psicanálise Clínica'] });
    expect(com.html).toContain('Psicanálise Clínica');
    const sem = renderPrimeiroAcesso(base);
    expect(sem.html).not.toContain('<ul>');
  });

  it('escapa o nome — nome com HTML não vira marcação no e-mail', () => {
    const r = renderPrimeiroAcesso({ ...base, userName: '<script>x</script>' });
    expect(r.html).not.toContain('<script>');
    expect(r.html).toContain('&lt;script&gt;');
  });

  it('o link de definir senha aparece no corpo em texto puro', () => {
    const r = renderPrimeiroAcesso(base);
    expect(r.text).toContain(base.setPasswordUrl);
  });
});

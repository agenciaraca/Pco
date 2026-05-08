// Tests dos helpers MIME do provider SMTP nativo.

import { describe, it, expect } from 'vitest';
import {
  buildMimeMessage,
  dotStuff,
  rcptList,
} from '../server/notifications/providers/smtp-mime';

describe('buildMimeMessage', () => {
  const base = {
    from: { email: 'from@x.com', name: 'PCO' },
    to: [{ email: 'to@x.com', name: 'Aluno' }],
    subject: 'Olá',
    html: '<p>oi</p>',
    text: 'oi',
    date: new Date('2026-05-08T10:00:00Z'),
    messageId: '<fixed@x.com>',
  };

  it('contem headers basicos com CRLF', () => {
    const out = buildMimeMessage(base);
    expect(out).toContain('From: PCO <from@x.com>');
    expect(out).toContain('To: Aluno <to@x.com>');
    expect(out).toContain('Date: Fri, 08 May 2026 10:00:00 GMT');
    expect(out).toContain('Message-ID: <fixed@x.com>');
    expect(out).toContain('MIME-Version: 1.0');
    expect(out.includes('\r\n')).toBe(true);
  });

  it('encoda subject UTF-8 quando contem nao-ASCII', () => {
    const out = buildMimeMessage(base);
    expect(out).toMatch(/Subject: =\?UTF-8\?B\?/);
  });

  it('mantem subject em plain ASCII', () => {
    const out = buildMimeMessage({ ...base, subject: 'Hello world' });
    expect(out).toContain('Subject: Hello world');
  });

  it('multipart/alternative quando html + text', () => {
    const out = buildMimeMessage(base);
    expect(out).toMatch(/Content-Type: multipart\/alternative; boundary="----=_AVA_/);
    expect(out).toMatch(/Content-Type: text\/plain; charset=utf-8/);
    expect(out).toMatch(/Content-Type: text\/html; charset=utf-8/);
  });

  it('text/html simples quando sem text', () => {
    const out = buildMimeMessage({ ...base, text: undefined });
    expect(out).toContain('Content-Type: text/html; charset=utf-8');
    expect(out).not.toContain('multipart/alternative');
  });

  it('inclui CC e Reply-To quando passados', () => {
    const out = buildMimeMessage({
      ...base,
      cc: [{ email: 'cc@x.com' }],
      replyTo: { email: 'reply@x.com' },
    });
    expect(out).toContain('Cc: cc@x.com');
    expect(out).toContain('Reply-To: reply@x.com');
  });

  it('quoted-printable encoda chars > 127', () => {
    const out = buildMimeMessage({ ...base, text: 'Olá Aluno!' });
    expect(out).toContain('Ol=C3=A1');
  });

  it('escapa nome com aspas', () => {
    const out = buildMimeMessage({
      ...base,
      to: [{ email: 'a@b.c', name: 'Foo, Bar' }],
    });
    expect(out).toContain('"Foo, Bar" <a@b.c>');
  });
});

describe('dotStuff', () => {
  it('escapa linha que comeca com .', () => {
    expect(dotStuff('foo\r\n.bar\r\nbaz')).toBe('foo\r\n..bar\r\nbaz');
  });
  it('escapa . no inicio do body', () => {
    expect(dotStuff('.start')).toBe('..start');
  });
  it('nao mexe em outras linhas', () => {
    expect(dotStuff('foo\r\nbar')).toBe('foo\r\nbar');
  });
});

describe('rcptList', () => {
  it('combina to + cc + bcc unique', () => {
    const list = rcptList({
      from: { email: 'f@x' },
      to: [{ email: 'a@x' }, { email: 'b@x' }],
      cc: [{ email: 'c@x' }, { email: 'a@x' }], // duplicata removida
      bcc: [{ email: 'd@x' }],
      subject: '',
      html: '',
    });
    expect(list).toEqual(['a@x', 'b@x', 'c@x', 'd@x']);
  });
});

// Builder de mensagem MIME para SMTP. Funcoes puras (sem socket).
//
// Resultado: string com headers + multipart/alternative (HTML+text)
// pronto pra mandar no DATA do SMTP. Garante CRLF e dot-stuffing.

import crypto from 'node:crypto';

export interface MimeRecipient {
  email: string;
  name?: string;
}

export interface MimeInput {
  from: MimeRecipient;
  to: MimeRecipient[];
  cc?: MimeRecipient[];
  bcc?: MimeRecipient[];
  replyTo?: MimeRecipient;
  subject: string;
  html: string;
  text?: string;
  messageId?: string;
  date?: Date;
}

function fmtAddr(r: MimeRecipient): string {
  if (!r.name) return r.email;
  // Quote name se contem chars especiais
  const safe = /[",;<>@()[\]:\\]/.test(r.name)
    ? `"${r.name.replace(/"/g, '\\"')}"`
    : r.name;
  return `${safe} <${r.email}>`;
}

function fmtAddrList(rs: MimeRecipient[]): string {
  return rs.map(fmtAddr).join(', ');
}

/**
 * Encode subject/name como Q-encoded MIME header se contem nao-ASCII.
 * RFC 2047.
 */
function encodeHeader(value: string): string {
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  // UTF-8 base64 encode (B-encoding)
  const b64 = Buffer.from(value, 'utf8').toString('base64');
  return `=?UTF-8?B?${b64}?=`;
}

/**
 * Quoted-printable encoding para body MIME (legivel).
 * Implementacao simplificada: encoda chars > 127, '=' e linhas longas.
 */
function quotedPrintable(s: string): string {
  const bytes = Buffer.from(s, 'utf8');
  let out = '';
  let lineLen = 0;
  for (const b of bytes) {
    let chunk: string;
    if (b === 0x3d /* = */ || b < 0x20 || b > 0x7e) {
      if (b === 0x0a /* \n */ || b === 0x0d /* \r */) {
        chunk = b === 0x0a ? '\r\n' : '';
        if (chunk) {
          out += chunk;
          lineLen = 0;
        }
        continue;
      }
      chunk = '=' + b.toString(16).toUpperCase().padStart(2, '0');
    } else {
      chunk = String.fromCharCode(b);
    }
    if (lineLen + chunk.length > 75) {
      out += '=\r\n';
      lineLen = 0;
    }
    out += chunk;
    lineLen += chunk.length;
  }
  return out;
}

/**
 * Aplica dot-stuffing exigido pelo SMTP DATA: linha que comeca com '.'
 * vira '..'. RFC 5321 4.5.2.
 */
export function dotStuff(body: string): string {
  return body.replace(/(^|\r\n)\./g, '$1..');
}

export function buildMimeMessage(input: MimeInput): string {
  const boundary = `----=_AVA_${crypto.randomBytes(8).toString('hex')}`;
  const date = (input.date ?? new Date()).toUTCString();
  const messageId =
    input.messageId ??
    `<${crypto.randomBytes(12).toString('hex')}@${input.from.email.split('@')[1] ?? 'localhost'}>`;

  const headers: string[] = [];
  headers.push(`Date: ${date}`);
  headers.push(`Message-ID: ${messageId}`);
  headers.push(
    `From: ${fmtAddr({ ...input.from, name: input.from.name && encodeHeader(input.from.name) })}`,
  );
  headers.push(`To: ${fmtAddrList(input.to)}`);
  if (input.cc?.length) headers.push(`Cc: ${fmtAddrList(input.cc)}`);
  if (input.replyTo) headers.push(`Reply-To: ${fmtAddr(input.replyTo)}`);
  headers.push(`Subject: ${encodeHeader(input.subject)}`);
  headers.push('MIME-Version: 1.0');

  const hasText = !!input.text;
  if (hasText) {
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
  } else {
    headers.push('Content-Type: text/html; charset=utf-8');
    headers.push('Content-Transfer-Encoding: quoted-printable');
  }

  const headerBlock = headers.join('\r\n');

  let body: string;
  if (hasText) {
    const textPart = [
      `--${boundary}`,
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: quoted-printable',
      '',
      quotedPrintable(input.text!),
      '',
    ].join('\r\n');
    const htmlPart = [
      `--${boundary}`,
      'Content-Type: text/html; charset=utf-8',
      'Content-Transfer-Encoding: quoted-printable',
      '',
      quotedPrintable(input.html),
      '',
    ].join('\r\n');
    body = [textPart, htmlPart, `--${boundary}--`, ''].join('\r\n');
  } else {
    body = quotedPrintable(input.html);
  }

  return `${headerBlock}\r\n\r\n${body}`;
}

/**
 * Lista todos os destinatarios (RCPT TO) — to + cc + bcc.
 */
export function rcptList(input: MimeInput): string[] {
  const all = [
    ...input.to.map((r) => r.email),
    ...(input.cc ?? []).map((r) => r.email),
    ...(input.bcc ?? []).map((r) => r.email),
  ];
  return Array.from(new Set(all));
}

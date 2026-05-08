// SMTP provider nativo (sem nodemailer). Suporta:
// - TLS direto (port 465) ou STARTTLS (port 587)
// - AUTH LOGIN (user/pass)
// - HTML + text via multipart/alternative
//
// Implementacao minimalista: reuse de helpers MIME em smtp-mime.ts.

import * as net from 'node:net';
import * as tls from 'node:tls';
import { Buffer } from 'node:buffer';
import type { EmailProviderImpl } from './types';
import { EmailProviderError } from './types';
import {
  buildMimeMessage,
  dotStuff,
  rcptList,
  type MimeRecipient,
} from './smtp-mime';

const TIMEOUT_MS = 30_000;

interface SmtpDialog {
  readLine(): Promise<string>;
  write(line: string): Promise<void>;
  end(): void;
}

async function expect(d: SmtpDialog, prefixes: string[]): Promise<string> {
  let lines = '';
  while (true) {
    const line = await d.readLine();
    lines += line + '\n';
    // Multi-line: "250-foo", "250 bar" — terminate when third char is space
    if (line.length >= 4 && line[3] === ' ') {
      const code = line.slice(0, 3);
      if (!prefixes.includes(code)) {
        throw new EmailProviderError('SMTP_PROTOCOL', `Esperava ${prefixes.join('/')}, recebido ${line.slice(0, 200)}`);
      }
      return lines;
    }
  }
}

function makeDialog(socket: net.Socket | tls.TLSSocket): SmtpDialog {
  let buffer = '';
  const queue: string[] = [];
  let waiter: ((s: string) => void) | null = null;

  socket.setEncoding('utf8');
  socket.on('data', (chunk: string) => {
    buffer += chunk;
    let idx;
    while ((idx = buffer.indexOf('\r\n')) >= 0) {
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      if (waiter) {
        waiter(line);
        waiter = null;
      } else {
        queue.push(line);
      }
    }
  });

  return {
    readLine: () =>
      new Promise<string>((resolve, reject) => {
        if (queue.length > 0) return resolve(queue.shift()!);
        const t = setTimeout(() => reject(new Error('SMTP timeout reading line')), TIMEOUT_MS);
        waiter = (s) => {
          clearTimeout(t);
          resolve(s);
        };
      }),
    write: (line: string) =>
      new Promise<void>((resolve, reject) => {
        socket.write(line + '\r\n', (err) => (err ? reject(err) : resolve()));
      }),
    end: () => socket.end(),
  };
}

async function connectPlain(host: string, port: number): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const s = net.createConnection({ host, port, timeout: TIMEOUT_MS });
    s.once('connect', () => resolve(s));
    s.once('error', reject);
    s.once('timeout', () => reject(new Error('SMTP connect timeout')));
  });
}

async function connectTls(host: string, port: number): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const s = tls.connect({ host, port, servername: host, timeout: TIMEOUT_MS } as tls.ConnectionOptions, () =>
      resolve(s),
    );
    s.once('error', reject);
  });
}

export const smtpProvider: EmailProviderImpl = {
  async send(config, creds, input) {
    if (!creds.smtpPassword) {
      throw new EmailProviderError('NO_PASS', 'SMTP exige senha (smtpPassword).');
    }
    if (!config.smtpHost || !config.smtpPort || !config.smtpUser) {
      throw new EmailProviderError(
        'NO_CONFIG',
        'SMTP exige smtpHost, smtpPort e smtpUser.',
      );
    }

    const tos = (Array.isArray(input.to) ? input.to : [input.to]) as MimeRecipient[];
    const mime = buildMimeMessage({
      from: { email: config.fromEmail, name: config.fromName },
      to: tos,
      cc: input.cc,
      bcc: input.bcc,
      replyTo: input.replyTo ?? (config.replyToEmail ? { email: config.replyToEmail } : undefined),
      subject: input.subject,
      html: input.html,
      text: input.text,
    });

    let socket: net.Socket | tls.TLSSocket;
    if (config.smtpSecure) {
      socket = await connectTls(config.smtpHost, config.smtpPort);
    } else {
      socket = await connectPlain(config.smtpHost, config.smtpPort);
    }

    let d = makeDialog(socket);
    try {
      await expect(d, ['220']);
      await d.write(`EHLO ${config.smtpHost}`);
      const ehloLines = await expect(d, ['250']);

      // STARTTLS se nao foi TLS direto e servidor anuncia
      if (!config.smtpSecure && /STARTTLS/i.test(ehloLines)) {
        await d.write('STARTTLS');
        await expect(d, ['220']);
        // Reconectar via TLS
        const tlsSock = tls.connect({ socket: socket as net.Socket, servername: config.smtpHost });
        await new Promise<void>((resolve, reject) => {
          tlsSock.once('secureConnect', () => resolve());
          tlsSock.once('error', reject);
        });
        socket = tlsSock;
        d = makeDialog(socket);
        await d.write(`EHLO ${config.smtpHost}`);
        await expect(d, ['250']);
      }

      // AUTH LOGIN
      await d.write('AUTH LOGIN');
      await expect(d, ['334']);
      await d.write(Buffer.from(config.smtpUser).toString('base64'));
      await expect(d, ['334']);
      await d.write(Buffer.from(creds.smtpPassword).toString('base64'));
      await expect(d, ['235']);

      await d.write(`MAIL FROM:<${config.fromEmail}>`);
      await expect(d, ['250']);

      for (const rcpt of rcptList({ from: { email: config.fromEmail }, to: tos, cc: input.cc, bcc: input.bcc, subject: '', html: '' })) {
        await d.write(`RCPT TO:<${rcpt}>`);
        await expect(d, ['250']);
      }

      await d.write('DATA');
      await expect(d, ['354']);
      await d.write(dotStuff(mime));
      await d.write('.');
      const ok = await expect(d, ['250']);
      const idMatch = /\[?([\w.<>@-]+)\]?\s*$/.exec(ok.trim());

      await d.write('QUIT');
      try {
        await expect(d, ['221']);
      } catch {
        /* QUIT response is best-effort */
      }
      d.end();
      return {
        providerId: 'smtp',
        externalId: idMatch ? idMatch[1] : undefined,
        accepted: tos.length,
        rejected: 0,
      };
    } catch (err) {
      try {
        d.end();
      } catch {
        /* ignore */
      }
      if (err instanceof EmailProviderError) throw err;
      throw new EmailProviderError(
        'SMTP_FAILED',
        err instanceof Error ? err.message : String(err),
      );
    }
  },

  async ping(config, creds) {
    if (!config.smtpHost || !config.smtpPort) {
      return { ok: false, message: 'host/port ausente.' };
    }
    if (!creds.smtpPassword || !config.smtpUser) {
      return { ok: false, message: 'user/pass ausente.' };
    }
    try {
      const sock = config.smtpSecure
        ? await connectTls(config.smtpHost, config.smtpPort)
        : await connectPlain(config.smtpHost, config.smtpPort);
      const d = makeDialog(sock);
      await expect(d, ['220']);
      await d.write(`EHLO ${config.smtpHost}`);
      await expect(d, ['250']);
      await d.write('QUIT');
      try {
        await expect(d, ['221']);
      } catch {
        /* ignore */
      }
      d.end();
      return { ok: true, message: `SMTP OK (${config.smtpHost}:${config.smtpPort})` };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  },
};

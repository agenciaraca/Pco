import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * Oito provedores de e-mail estavam implementados e registrados. Três deles —
 * Mailgun, Brevo e AWS SES — apareciam no seletor do admin como
 * "mailgun — undefined", porque o rótulo vinha de um `Record` que só conhecia
 * cinco. E o SMTP aparecia como "SMTP (em breve — use Resend/SendGrid/
 * Postmark)", com o provedor pronto desde sempre.
 *
 * A causa de verdade era mais funda que o rótulo: o formulário só tinha campo
 * de API key, e a rota descartava `mailgunDomain`, `mailgunRegion` e
 * `sesRegion` em silêncio. Dava para escolher Mailgun; não dava para
 * configurá-lo — e a falha só apareceria no primeiro envio.
 */

let tmpDir: string;
let app: { fetch: (req: Request) => Response | Promise<Response> };
let token: string;

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-email-cfg-'));
  process.env.DATA_DIR = tmpDir;
  process.env.INITIAL_ADMIN_PASSWORD = 'TesteAdmin!2026';
  const mod = await import('../server/app');
  app = mod.buildApp();

  const res = await app.fetch(
    new Request('http://local/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@pco.local', password: 'TesteAdmin!2026' }),
    }),
  );
  token = ((await res.json()) as { token: string }).token;
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

function post(body: unknown): Promise<Response> {
  return Promise.resolve(
    app.fetch(
      new Request('http://local/api/admin/email/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      }),
    ),
  );
}

describe('todos os provedores implementados chegam ao seletor', () => {
  it('a rota devolve os oito', async () => {
    const res = await app.fetch(
      new Request('http://local/api/admin/email/providers', {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    const { providers } = (await res.json()) as { providers: string[] };
    expect(providers).toEqual(
      expect.arrayContaining(['mock', 'resend', 'sendgrid', 'postmark', 'mailgun', 'brevo', 'ses', 'smtp']),
    );
  });
});

describe('SMTP é configurável', () => {
  it('host, porta, usuário e TLS chegam ao registro', async () => {
    const res = await post({
      provider: 'smtp',
      fromEmail: 'envio@escola.test',
      smtpHost: 'smtp.escola.test',
      smtpPort: 465,
      smtpUser: 'envio',
      smtpPassword: 'segredo-do-smtp',
      smtpSecure: true,
    });
    expect(res.status).toBe(201);
    const cfg = (await res.json()) as Record<string, unknown>;
    expect(cfg.smtpHost).toBe('smtp.escola.test');
    expect(cfg.smtpPort).toBe(465);
    expect(cfg.smtpUser).toBe('envio');
    expect(cfg.smtpSecure).toBe(true);
    expect(cfg.hasSmtpPassword).toBe(true);
  });

  it('a senha do SMTP nunca volta em claro', async () => {
    const res = await post({
      provider: 'smtp',
      fromEmail: 'outro@escola.test',
      smtpHost: 'smtp.escola.test',
      smtpPassword: 'senha-que-nao-pode-vazar',
    });
    const bruto = await res.text();
    expect(bruto).not.toContain('senha-que-nao-pode-vazar');
    expect(bruto).toContain('hasSmtpPassword');
  });
});

describe('Mailgun é configurável', () => {
  it('domínio e região sobrevivem à rota — antes eram descartados em silêncio', async () => {
    const res = await post({
      provider: 'mailgun',
      fromEmail: 'envio@escola.test',
      apiKey: 'key-de-mentira',
      mailgunDomain: 'mg.escola.test',
      mailgunRegion: 'eu',
    });
    expect(res.status).toBe(201);
    const cfg = (await res.json()) as Record<string, unknown>;
    expect(cfg.mailgunDomain).toBe('mg.escola.test');
    expect(cfg.mailgunRegion).toBe('eu');
  });

  it('região inválida não vira lixo no registro', async () => {
    const res = await post({
      provider: 'mailgun',
      fromEmail: 'x@escola.test',
      mailgunDomain: 'mg.escola.test',
      mailgunRegion: 'marte',
    });
    const cfg = (await res.json()) as Record<string, unknown>;
    expect(cfg.mailgunRegion).toBeUndefined();
  });
});

describe('AWS SES é configurável', () => {
  it('região e secret chegam, e o secret não volta', async () => {
    const res = await post({
      provider: 'ses',
      fromEmail: 'envio@escola.test',
      apiKey: 'AKIAEXEMPLO',
      sesSecretAccessKey: 'secret-que-nao-pode-vazar',
      sesRegion: 'sa-east-1',
    });
    expect(res.status).toBe(201);
    const bruto = await res.text();
    expect(bruto).not.toContain('secret-que-nao-pode-vazar');
    const cfg = JSON.parse(bruto) as Record<string, unknown>;
    expect(cfg.sesRegion).toBe('sa-east-1');
    expect(cfg.hasSesSecret).toBe(true);
  });
});

describe('atualização parcial não apaga credencial', () => {
  it('salvar sem informar a senha mantém a que já existia', async () => {
    const criado = (await (
      await post({
        provider: 'smtp',
        fromEmail: 'mantem@escola.test',
        smtpHost: 'smtp.escola.test',
        smtpPassword: 'a-senha-original',
      })
    ).json()) as { id: string };

    const res = await app.fetch(
      new Request(`http://local/api/admin/email/configs/${criado.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        // O formulário manda string vazia quando o admin não digitou nada.
        body: JSON.stringify({ smtpPassword: '', fromName: 'Escola' }),
      }),
    );
    const cfg = (await res.json()) as Record<string, unknown>;
    expect(cfg.hasSmtpPassword).toBe(true);
    expect(cfg.fromName).toBe('Escola');
  });
});

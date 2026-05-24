// Tests do SAML helper minimal.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as zlib from 'node:zlib';
import {
  samlConfigFromEnv,
  buildAuthnRequest,
  buildRedirectUrl,
  parseSamlResponse,
  validateConditions,
  verifySamlSignature,
} from '../server/auth/saml';

const baseConfig = {
  issuer: 'ava-pco',
  idpSsoUrl: 'https://idp.example.com/sso',
  acsUrl: 'https://app.example.com/api/auth/saml/acs',
  idpCert: null as string | null,
};

beforeEach(() => {
  delete process.env.SAML_ISSUER;
  delete process.env.SAML_IDP_SSO_URL;
  delete process.env.SAML_ACS_URL;
});
afterEach(() => {
  delete process.env.SAML_ISSUER;
  delete process.env.SAML_IDP_SSO_URL;
  delete process.env.SAML_ACS_URL;
});

describe('samlConfigFromEnv', () => {
  it('null sem vars', () => {
    expect(samlConfigFromEnv()).toBeNull();
  });
  it('null com 1 var', () => {
    process.env.SAML_ISSUER = 'a';
    expect(samlConfigFromEnv()).toBeNull();
  });
  it('config completa', () => {
    process.env.SAML_ISSUER = 'ava';
    process.env.SAML_IDP_SSO_URL = 'https://idp/sso';
    process.env.SAML_ACS_URL = 'https://sp/acs';
    expect(samlConfigFromEnv()).toEqual({
      issuer: 'ava',
      idpSsoUrl: 'https://idp/sso',
      acsUrl: 'https://sp/acs',
      idpCert: null,
    });
  });
});

describe('buildAuthnRequest', () => {
  it('produz XML SAML 2.0 valido com issuer + ACS URL', () => {
    const xml = buildAuthnRequest(baseConfig, {
      id: '_test123',
      instant: new Date('2026-05-08T10:00:00Z'),
    });
    expect(xml).toContain('samlp:AuthnRequest');
    expect(xml).toContain('Version="2.0"');
    expect(xml).toContain('ID="_test123"');
    expect(xml).toContain('IssueInstant="2026-05-08T10:00:00.000Z"');
    expect(xml).toContain('AssertionConsumerServiceURL="https://app.example.com/api/auth/saml/acs"');
    expect(xml).toContain('<saml:Issuer>ava-pco</saml:Issuer>');
    expect(xml).toContain('emailAddress');
  });

  it('escapa caracteres especiais no issuer', () => {
    const xml = buildAuthnRequest({ ...baseConfig, issuer: 'a&b<c' });
    expect(xml).toContain('a&amp;b&lt;c');
  });
});

describe('buildRedirectUrl', () => {
  it('encoda SAMLRequest deflated em base64 + URL', () => {
    const xml = buildAuthnRequest(baseConfig, { id: '_x' });
    const url = buildRedirectUrl(baseConfig, xml);
    expect(url.startsWith('https://idp.example.com/sso?SAMLRequest=')).toBe(true);
    // Decode + verifica que volta pro XML
    const u = new URL(url);
    const param = u.searchParams.get('SAMLRequest')!;
    const inflated = zlib.inflateRawSync(Buffer.from(param, 'base64')).toString();
    expect(inflated).toContain('samlp:AuthnRequest');
  });

  it('inclui RelayState quando passado', () => {
    const url = buildRedirectUrl(baseConfig, '<x/>', '/dashboard');
    expect(url).toContain('RelayState=%2Fdashboard');
  });

  it('preserva ? na URL com query existente', () => {
    const url = buildRedirectUrl(
      { ...baseConfig, idpSsoUrl: 'https://idp/sso?tenant=a' },
      '<x/>',
    );
    expect(url).toContain('?tenant=a&SAMLRequest=');
  });
});

describe('parseSamlResponse', () => {
  function makeResponse(opts: {
    nameId?: string;
    notBefore?: string;
    notOnOrAfter?: string;
    attrs?: Record<string, string>;
  }): string {
    const attrs = Object.entries(opts.attrs ?? {})
      .map(
        ([k, v]) =>
          `<saml:Attribute Name="${k}"><saml:AttributeValue>${v}</saml:AttributeValue></saml:Attribute>`,
      )
      .join('');
    const cond =
      opts.notBefore || opts.notOnOrAfter
        ? `<saml:Conditions${opts.notBefore ? ` NotBefore="${opts.notBefore}"` : ''}${
            opts.notOnOrAfter ? ` NotOnOrAfter="${opts.notOnOrAfter}"` : ''
          }/>`
        : '';
    const xml =
      `<saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">` +
      `<saml:Subject><saml:NameID Format="email">${opts.nameId ?? ''}</saml:NameID></saml:Subject>` +
      cond +
      `<saml:AttributeStatement>${attrs}</saml:AttributeStatement>` +
      `</saml:Assertion>`;
    return Buffer.from(xml, 'utf8').toString('base64');
  }

  it('extrai NameID + atributos email', () => {
    const r = parseSamlResponse(
      makeResponse({
        nameId: 'aluno@x.com',
        attrs: { email: 'aluno@x.com', firstName: 'Aluno' },
      }),
    );
    expect(r.nameId).toBe('aluno@x.com');
    expect(r.email).toBe('aluno@x.com');
    expect(r.attributes.firstName).toBe('Aluno');
  });

  it('cai no NameID quando email attribute ausente mas NameID parece email', () => {
    const r = parseSamlResponse(makeResponse({ nameId: 'a@b.c' }));
    expect(r.email).toBe('a@b.c');
  });

  it('reconhece OID urn:oid:1.2.840.113549.1.9.1 como email', () => {
    const r = parseSamlResponse(
      makeResponse({
        nameId: 'opaque-id-123',
        attrs: { 'urn:oid:1.2.840.113549.1.9.1': 'a@b.c' },
      }),
    );
    expect(r.email).toBe('a@b.c');
  });

  it('captura conditions notBefore/notOnOrAfter', () => {
    const r = parseSamlResponse(
      makeResponse({
        nameId: 'x',
        notBefore: '2026-05-08T10:00:00Z',
        notOnOrAfter: '2026-05-08T11:00:00Z',
      }),
    );
    expect(r.notBefore).toBe('2026-05-08T10:00:00Z');
    expect(r.notOnOrAfter).toBe('2026-05-08T11:00:00Z');
  });
});

describe('validateConditions', () => {
  const base = {
    nameId: 'x',
    email: null,
    attributes: {},
    notBefore: null as string | null,
    notOnOrAfter: null as string | null,
  };

  it('ok sem conditions', () => {
    expect(validateConditions({ ...base }).ok).toBe(true);
  });

  it('ok dentro da janela', () => {
    const r = validateConditions(
      {
        ...base,
        notBefore: '2026-05-08T09:00:00Z',
        notOnOrAfter: '2026-05-08T11:00:00Z',
      },
      new Date('2026-05-08T10:00:00Z'),
    );
    expect(r.ok).toBe(true);
  });

  it('falha NotBefore no futuro', () => {
    const r = validateConditions(
      { ...base, notBefore: '2027-01-01T00:00:00Z' },
      new Date('2026-05-08T10:00:00Z'),
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/NotBefore/);
  });

  it('falha NotOnOrAfter passado', () => {
    const r = validateConditions(
      { ...base, notOnOrAfter: '2025-01-01T00:00:00Z' },
      new Date('2026-05-08T10:00:00Z'),
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/expirada/);
  });

  it('respeita clockSkew', () => {
    const r = validateConditions(
      { ...base, notBefore: '2026-05-08T10:01:00Z' }, // 1 min no futuro
      new Date('2026-05-08T10:00:00Z'),
      5 * 60 * 1000, // 5 min skew
    );
    expect(r.ok).toBe(true);
  });
});

describe('verifySamlSignature', () => {
  it('retorna valid quando idpCert é null (modo BETA)', () => {
    const fakeResponse = Buffer.from('<Response>test</Response>').toString('base64');
    const result = verifySamlSignature(fakeResponse, null);
    expect(result.valid).toBe(true);
  });

  it('retorna invalid quando não há assinatura no XML', () => {
    const fakeResponse = Buffer.from('<Response>sem signature</Response>').toString('base64');
    const result = verifySamlSignature(fakeResponse, 'MIIC_fake_cert');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Nenhuma assinatura');
  });

  it('retorna invalid com certificado inválido + assinatura presente', () => {
    const xml = `<Response>
      <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <ds:SignedInfo><ds:Reference URI=""/></ds:SignedInfo>
        <ds:SignatureValue>fake</ds:SignatureValue>
      </ds:Signature>
    </Response>`;
    const b64 = Buffer.from(xml).toString('base64');
    const result = verifySamlSignature(b64, 'INVALID_CERT_DATA');
    expect(result.valid).toBe(false);
  });
});

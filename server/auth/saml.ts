// SAML 2.0 SP-initiated flow com verificação de assinatura via xml-crypto.
//
// Suporta:
// - buildAuthnRequest: XML + base64 + deflate (HTTP Redirect binding)
// - parseSamlResponse: extrai NameID + email de um SAMLResponse base64
// - verifySamlSignature: valida assinatura XML do IDP via certificado X.509
// - validateConditions: confere NotBefore/NotOnOrAfter
//
// Env-gated:
//   SAML_ISSUER (entityID do SP, ex: ava-pco)
//   SAML_IDP_SSO_URL (URL onde o IDP recebe AuthnRequest)
//   SAML_ACS_URL (callback do SP onde IDP devolve SAMLResponse)
//   SAML_IDP_CERT (certificado X.509 do IDP, PEM sem header/footer, opcional)

import * as zlib from 'node:zlib';
import crypto from 'node:crypto';

export interface SamlConfig {
  issuer: string;
  idpSsoUrl: string;
  acsUrl: string;
  /** PEM do certificado X.509 do IDP (sem BEGIN/END). Se ausente, assinatura não é verificada. */
  idpCert: string | null;
}

export function samlConfigFromEnv(): SamlConfig | null {
  const issuer = process.env.SAML_ISSUER;
  const idpSsoUrl = process.env.SAML_IDP_SSO_URL;
  const acsUrl = process.env.SAML_ACS_URL;
  if (!issuer || !idpSsoUrl || !acsUrl) return null;
  const rawCert = process.env.SAML_IDP_CERT ?? null;
  return { issuer, idpSsoUrl, acsUrl, idpCert: rawCert };
}

/**
 * Constroi um SAML AuthnRequest XML.
 */
export function buildAuthnRequest(
  config: SamlConfig,
  opts?: { id?: string; instant?: Date },
): string {
  const id = opts?.id ?? `_${crypto.randomBytes(16).toString('hex')}`;
  const instant = (opts?.instant ?? new Date()).toISOString();
  return (
    `<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"` +
    ` xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"` +
    ` ID="${id}" Version="2.0" IssueInstant="${instant}"` +
    ` ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"` +
    ` AssertionConsumerServiceURL="${esc(config.acsUrl)}">` +
    `<saml:Issuer>${esc(config.issuer)}</saml:Issuer>` +
    `<samlp:NameIDPolicy Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress" AllowCreate="true"/>` +
    `</samlp:AuthnRequest>`
  );
}

/**
 * HTTP Redirect binding: deflate + base64 + URL encode no SAMLRequest.
 * Returns URL completa pra IDP.
 */
export function buildRedirectUrl(
  config: SamlConfig,
  authnRequest: string,
  relayState?: string,
): string {
  const deflated = zlib.deflateRawSync(Buffer.from(authnRequest, 'utf8'));
  const encoded = encodeURIComponent(deflated.toString('base64'));
  const sep = config.idpSsoUrl.includes('?') ? '&' : '?';
  let url = `${config.idpSsoUrl}${sep}SAMLRequest=${encoded}`;
  if (relayState) url += `&RelayState=${encodeURIComponent(relayState)}`;
  return url;
}

/**
 * Verifica a assinatura XML de um SAMLResponse usando o certificado X.509 do IDP.
 * Retorna { valid: true } se a assinatura é válida, ou { valid: false, reason } se não.
 * Se idpCert é null, pula a verificação (modo BETA).
 */
export function verifySamlSignature(
  samlResponseB64: string,
  idpCert: string | null,
): { valid: boolean; reason?: string } {
  if (!idpCert) return { valid: true };

  const xml = Buffer.from(samlResponseB64, 'base64').toString('utf8');
  const sigMatch = /<ds:Signature[^>]*xmlns:ds="http:\/\/www\.w3\.org\/2000\/09\/xmldsig#"[\s\S]*?<\/ds:Signature>/.exec(xml);
  if (!sigMatch) {
    return { valid: false, reason: 'Nenhuma assinatura encontrada no SAMLResponse.' };
  }

  try {
    const { SignedXml } = require('xml-crypto') as typeof import('xml-crypto');
    const pem = idpCert.includes('BEGIN CERTIFICATE')
      ? idpCert
      : `-----BEGIN CERTIFICATE-----\n${idpCert}\n-----END CERTIFICATE-----`;

    const sig = new SignedXml({ publicCert: pem });
    sig.loadSignature(sigMatch[0]);
    const isValid = sig.checkSignature(xml);
    if (!isValid) {
      const errors = (sig as unknown as { validationErrors?: string[] }).validationErrors ?? [];
      return { valid: false, reason: `Assinatura invalida: ${errors.join('; ')}` };
    }
    return { valid: true };
  } catch (err) {
    return {
      valid: false,
      reason: `Erro ao verificar assinatura: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export interface SamlAssertion {
  nameId: string;
  email: string | null;
  attributes: Record<string, string>;
  notBefore: string | null;
  notOnOrAfter: string | null;
}

/**
 * Parser regex-based simples (sem DOM). Suficiente pra IDPs que
 * geram XML standard sem comments/CDATA exotic. Para IDPs hostis
 * use validacao via xml-crypto antes.
 */
export function parseSamlResponse(samlResponseB64: string): SamlAssertion {
  const xml = Buffer.from(samlResponseB64, 'base64').toString('utf8');
  const nameId = matchTag(xml, /<saml2?:NameID[^>]*>([^<]+)<\/saml2?:NameID>/);
  const conditions = /<saml2?:Conditions([^>]*)/.exec(xml);
  const notBefore = conditions ? attr(conditions[1], 'NotBefore') : null;
  const notOnOrAfter = conditions ? attr(conditions[1], 'NotOnOrAfter') : null;

  // Attributes
  const attributes: Record<string, string> = {};
  const attrRe = /<saml2?:Attribute\b([^>]*)>([\s\S]*?)<\/saml2?:Attribute>/g;
  let m;
  while ((m = attrRe.exec(xml)) !== null) {
    const name = attr(m[1], 'Name') ?? attr(m[1], 'FriendlyName');
    if (!name) continue;
    const valMatch = /<saml2?:AttributeValue[^>]*>([\s\S]*?)<\/saml2?:AttributeValue>/.exec(
      m[2],
    );
    if (valMatch) attributes[name] = valMatch[1].trim();
  }

  const email =
    attributes.email ??
    attributes['urn:oid:1.2.840.113549.1.9.1'] ??
    attributes['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] ??
    (nameId && nameId.includes('@') ? nameId : null);

  return {
    nameId: nameId ?? '',
    email,
    attributes,
    notBefore,
    notOnOrAfter,
  };
}

/**
 * Verifica condicoes temporais NotBefore/NotOnOrAfter da assertion.
 */
export function validateConditions(
  a: SamlAssertion,
  now: Date = new Date(),
  clockSkewMs = 5 * 60 * 1000,
): { ok: boolean; reason?: string } {
  const nowMs = now.getTime();
  if (a.notBefore) {
    const nb = Date.parse(a.notBefore);
    if (!Number.isNaN(nb) && nowMs + clockSkewMs < nb) {
      return { ok: false, reason: 'NotBefore no futuro.' };
    }
  }
  if (a.notOnOrAfter) {
    const na = Date.parse(a.notOnOrAfter);
    if (!Number.isNaN(na) && nowMs - clockSkewMs >= na) {
      return { ok: false, reason: 'Assertion expirada.' };
    }
  }
  return { ok: true };
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function matchTag(xml: string, re: RegExp): string | null {
  const m = re.exec(xml);
  return m ? m[1].trim() : null;
}

function attr(attrStr: string, name: string): string | null {
  const re = new RegExp(`${name}="([^"]*)"`);
  const m = re.exec(attrStr);
  return m ? m[1] : null;
}

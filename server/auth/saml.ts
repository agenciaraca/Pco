// SAML 2.0 SP-initiated flow minimal — SEM xml-crypto.
//
// Suporta:
// - buildAuthnRequest: XML + base64 + deflate (HTTP Redirect binding)
// - parseSamlResponse: extrai NameID + email de um SAMLResponse base64
// - validateConditions: confere NotBefore/NotOnOrAfter
//
// IMPORTANTE: signature validation NAO esta implementada aqui. Para prod
// hardened com IDP nao confiavel, adicione xml-crypto + verificacao do
// X.509 do IDP. Esta implementacao confia no transporte HTTPS + IDP
// pre-cadastrado via env.
//
// Env-gated:
//   SAML_ISSUER (entityID do SP, ex: ava-pco)
//   SAML_IDP_SSO_URL (URL onde o IDP recebe AuthnRequest)
//   SAML_ACS_URL (callback do SP onde IDP devolve SAMLResponse)

import * as zlib from 'node:zlib';
import crypto from 'node:crypto';

export interface SamlConfig {
  /** entityID do SP (geralmente um URL ou string opaca). */
  issuer: string;
  /** URL onde o IDP recebe AuthnRequest (Redirect binding). */
  idpSsoUrl: string;
  /** Callback URL no SP. */
  acsUrl: string;
}

export function samlConfigFromEnv(): SamlConfig | null {
  const issuer = process.env.SAML_ISSUER;
  const idpSsoUrl = process.env.SAML_IDP_SSO_URL;
  const acsUrl = process.env.SAML_ACS_URL;
  if (!issuer || !idpSsoUrl || !acsUrl) return null;
  return { issuer, idpSsoUrl, acsUrl };
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

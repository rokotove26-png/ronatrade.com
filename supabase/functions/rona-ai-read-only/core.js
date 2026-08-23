export const AI_ROLES = Object.freeze([
  'OPERATIONS_DIRECTOR',
  'FINANCE',
  'LEGAL',
  'MARKET_ANALYST',
  'RAIL_LOGISTICS',
  'SYSTEM_ADMIN',
]);

export const ROLE_DOMAINS = Object.freeze({
  OPERATIONS_DIRECTOR: Object.freeze([
    'CLIENT','CONTRACT','APPLICATION','DEAL','DOCUMENT','CONTROL','SHIPMENT','RAIL_SUMMARY',
    'RESOURCE','PUBLICATION','COMMERCIAL','VED','QUALITY','TASK','PORTAL_EVENT',
  ]),
  FINANCE: Object.freeze([
    'DEAL','CONTRACT','FINANCE_DOCUMENT','PAYMENT','PAYMENT_ALLOCATION','ACCOUNTING','FINANCIAL_CONTROL','TASK','AUDIT',
  ]),
  LEGAL: Object.freeze([
    'CONTRACT','DOCUMENT','APPLICATION','DEAL','LEGAL_CONTROL','TASK','PORTAL_EVENT','SOURCE_METADATA',
  ]),
  MARKET_ANALYST: Object.freeze([
    'CLIENT','CONTRACT','APPLICATION','DEAL','COMMERCIAL','MARKET','PUBLICATION','PUBLICATION_HISTORY','SOURCE_METADATA','TASK','PORTAL_EVENT',
  ]),
  RAIL_LOGISTICS: Object.freeze([
    'DEAL','SHIPMENT','RAIL_DOCUMENT','RAIL_MOVEMENT','RAIL_MONITORING','LOGISTICS_CONTROL','DOCUMENT','TASK','PORTAL_EVENT',
  ]),
  SYSTEM_ADMIN: Object.freeze([
    'TECHNICAL','IAM','AUDIT','SESSION_SECURITY','INTEGRATION_HEALTH','TASK','PORTAL_EVENT',
  ]),
});

export const HISTORY_DOMAINS = Object.freeze({
  OPERATIONS_DIRECTOR: Object.freeze(['contracts','deals','documents','publications','tasks']),
  FINANCE: Object.freeze(['contracts','deals','payments','tasks','audit']),
  LEGAL: Object.freeze(['contracts','documents','tasks']),
  MARKET_ANALYST: Object.freeze(['contracts','deals','publications','tasks']),
  RAIL_LOGISTICS: Object.freeze(['rail','shipments','tasks']),
  SYSTEM_ADMIN: Object.freeze(['audit','tasks','sessions']),
});

export const BUSINESS_WRITE_PATHS = Object.freeze([
  '/v1/staff/applications/:id/decision',
  '/v1/staff/applications/:id/register-deal',
  '/v1/staff/deals/:id/supplier-requests',
  '/v1/staff/supplier-requests/:id/responses',
  '/v1/staff/deals/:id/resource-decision',
  '/v1/staff/tasks/:id/status',
  '/v1/staff/tasks/:id/messages',
  '/v1/staff/canonical-deltas',
  '/v1/staff/canonical-deltas/:id/transition',
  '/v1/admin/contracts/:id/signed-document/confirm',
  '/v1/admin/iam/*',
  '/v1/client/*',
  '/v1/agent/*',
]);

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function isAiRole(role) {
  return AI_ROLES.includes(String(role || ''));
}

export function roleAllowsDomain(role, domain) {
  return isAiRole(role) && (ROLE_DOMAINS[role] || []).includes(String(domain || '').toUpperCase());
}

export function roleAllowsHistory(role, domain) {
  return isAiRole(role) && (HISTORY_DOMAINS[role] || []).includes(String(domain || '').toLowerCase());
}

function b64urlEncodeBytes(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}

function b64urlEncodeJson(value) {
  return b64urlEncodeBytes(encoder.encode(JSON.stringify(value)));
}

function b64urlDecodeBytes(value) {
  const base64 = value.replaceAll('-','+').replaceAll('_','/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(base64);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

function b64urlDecodeJson(value) {
  return JSON.parse(decoder.decode(b64urlDecodeBytes(value)));
}

function timingSafeBytes(a, b) {
  if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array) || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function sha256Hex(value) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(String(value))));
  return [...digest].map(v => v.toString(16).padStart(2,'0')).join('');
}

export function timingSafeHex(a, b) {
  if (!/^[0-9a-f]+$/i.test(String(a || '')) || !/^[0-9a-f]+$/i.test(String(b || ''))) return false;
  if (String(a).length !== String(b).length || String(a).length % 2) return false;
  const aa = Uint8Array.from(String(a).match(/../g).map(x => parseInt(x,16)));
  const bb = Uint8Array.from(String(b).match(/../g).map(x => parseInt(x,16)));
  return timingSafeBytes(aa,bb);
}

async function hmac(keyText, input) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(String(keyText)), { name:'HMAC', hash:'SHA-256' }, false, ['sign','verify']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(input)));
}

export async function signAiToken({ signingKey, identityId, role, credentialVersion, ttlSeconds = 300, nowSeconds = Math.floor(Date.now()/1000), jti = crypto.randomUUID() }) {
  if (!signingKey || String(signingKey).length < 32) throw new Error('AI_SIGNING_KEY_INVALID');
  if (!/^AI-[A-Z0-9_-]{3,80}$/.test(String(identityId || ''))) throw new Error('AI_IDENTITY_INVALID');
  if (!isAiRole(role) || role === 'OWNER_ADMIN') throw new Error('AI_ROLE_INVALID');
  const ttl = Math.max(60, Math.min(900, Number(ttlSeconds || 300)));
  const header = { alg:'HS256', typ:'JWT', kid:'rona-ai-v1' };
  const payload = {
    iss:'rona-ai-identity-broker',
    aud:'rona-ai-read-only',
    sub:String(identityId),
    role:String(role),
    ver:Number(credentialVersion),
    iat:nowSeconds,
    nbf:nowSeconds,
    exp:nowSeconds + ttl,
    jti:String(jti),
    actor_type:'AI',
    scope:'READ_ONLY',
  };
  const unsigned = `${b64urlEncodeJson(header)}.${b64urlEncodeJson(payload)}`;
  const signature = b64urlEncodeBytes(await hmac(signingKey,unsigned));
  return { token:`${unsigned}.${signature}`, payload };
}

export async function verifyAiToken(token, signingKey, nowSeconds = Math.floor(Date.now()/1000)) {
  try {
    if (!signingKey || String(signingKey).length < 32) return { ok:false, code:'AI_SIGNING_KEY_INVALID' };
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return { ok:false, code:'AI_TOKEN_INVALID' };
    const unsigned = `${parts[0]}.${parts[1]}`;
    const expected = await hmac(signingKey,unsigned);
    const actual = b64urlDecodeBytes(parts[2]);
    if (!timingSafeBytes(expected,actual)) return { ok:false, code:'AI_TOKEN_SIGNATURE_INVALID' };
    const header = b64urlDecodeJson(parts[0]);
    const payload = b64urlDecodeJson(parts[1]);
    if (header?.alg !== 'HS256' || header?.typ !== 'JWT') return { ok:false, code:'AI_TOKEN_HEADER_INVALID' };
    if (payload?.iss !== 'rona-ai-identity-broker' || payload?.aud !== 'rona-ai-read-only') return { ok:false, code:'AI_TOKEN_AUDIENCE_INVALID' };
    if (payload?.actor_type !== 'AI' || payload?.scope !== 'READ_ONLY') return { ok:false, code:'AI_TOKEN_SCOPE_INVALID' };
    if (!isAiRole(payload?.role) || payload?.role === 'OWNER_ADMIN') return { ok:false, code:'AI_TOKEN_ROLE_INVALID' };
    if (!/^AI-[A-Z0-9_-]{3,80}$/.test(String(payload?.sub || ''))) return { ok:false, code:'AI_TOKEN_SUBJECT_INVALID' };
    if (!Number.isInteger(payload?.ver) || payload.ver < 1) return { ok:false, code:'AI_TOKEN_VERSION_INVALID' };
    if (!Number.isFinite(payload?.exp) || !Number.isFinite(payload?.nbf) || nowSeconds >= payload.exp) return { ok:false, code:'AI_TOKEN_EXPIRED' };
    if (nowSeconds < payload.nbf) return { ok:false, code:'AI_TOKEN_NOT_YET_VALID' };
    if (!/^[0-9a-f-]{36}$/i.test(String(payload?.jti || ''))) return { ok:false, code:'AI_TOKEN_JTI_INVALID' };
    return { ok:true, header, payload };
  } catch {
    return { ok:false, code:'AI_TOKEN_INVALID' };
  }
}

export function bearerToken(req) {
  const value = req?.headers?.get?.('authorization') || '';
  return value.startsWith('Bearer ') ? value.slice(7).trim() : '';
}

export function requestIds(req) {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const r = req.headers.get('x-request-id') || '';
  const c = req.headers.get('x-correlation-id') || '';
  return {
    requestId: uuid.test(r) ? r : crypto.randomUUID(),
    correlationId: uuid.test(c) ? c : null,
  };
}

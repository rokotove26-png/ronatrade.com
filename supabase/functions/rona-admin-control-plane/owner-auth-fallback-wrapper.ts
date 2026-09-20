// Emergency owner-auth fallback layered over exact production v9 control-plane core.
let capturedHandler: ((req: Request) => Response | Promise<Response>) | null = null;
const originalServe = Deno.serve.bind(Deno);
const captureServe = ((first: unknown, second?: unknown) => {
  const handler = typeof first === 'function' ? first : second;
  if (typeof handler !== 'function') throw new Error('ADMIN_CONTROL_PLANE_HANDLER_CAPTURE_FAILED');
  capturedHandler = handler as (req: Request) => Response | Promise<Response>;
  return undefined as never;
}) as typeof Deno.serve;
(Deno as unknown as { serve: typeof Deno.serve }).serve = captureServe;
await import('https://raw.githubusercontent.com/rokotove26-png/ronatrade.com/5df1977520ade11fff60e3672d4d4b0b2e79d313/supabase/functions/rona-admin-control-plane/index.ts');
(Deno as unknown as { serve: typeof Deno.serve }).serve = originalServe;
if (!capturedHandler) throw new Error('ADMIN_CONTROL_PLANE_PRODUCTION_HANDLER_MISSING');

const OWNER_AUTH_USER_ID='c4a167ae-cd4f-4296-8f13-ef09ced41968';
const OWNER_EMAIL='office_kg@ronaoil.com';
const OWNER_IDENTITY='OWNER_ADMIN';
const EXPECTED_ISSUER='https://sxawrwzeobaqwwmlkzws.supabase.co/auth/v1';

function decodeJwtPayload(token: string) {
  try {
    const part = String(token || '').split('.')[1] || '';
    if (!part) return null;
    const normalized = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    return JSON.parse(atob(normalized));
  } catch {
    return null;
  }
}
function ownerClaimsValid(payload: any) {
  const now = Math.floor(Date.now() / 1000);
  const aud = payload?.aud;
  const audience = Array.isArray(aud) ? aud.includes('authenticated') : aud === 'authenticated';
  return payload?.iss === EXPECTED_ISSUER
    && payload?.sub === OWNER_AUTH_USER_ID
    && String(payload?.email || '').toLowerCase() === OWNER_EMAIL
    && String(payload?.role || '') === 'authenticated'
    && audience
    && Number.isFinite(Number(payload?.exp)) && Number(payload.exp) > now
    && (!payload?.nbf || Number(payload.nbf) <= now)
    && typeof payload?.session_id === 'string' && payload.session_id.length > 0
    && String(payload?.app_metadata?.portal_identity || '') === OWNER_IDENTITY;
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, no-cache, must-revalidate',
      'x-content-type-options': 'nosniff',
    },
  });
}

originalServe(async (req: Request) => {
  const url = new URL(req.url);
  if (url.pathname.endsWith('/owner-auth-fallback')) {
    if (req.method !== 'GET') return json({ ok: false, code: 'METHOD_NOT_ALLOWED' }, 405);
    const auth = String(req.headers.get('authorization') || '');
    if (!auth.startsWith('Bearer ')) return json({ ok: false, code: 'AUTHORIZATION_REQUIRED' }, 401);
    const payload = decodeJwtPayload(auth.slice(7));
    if (!ownerClaimsValid(payload)) return json({ ok: false, code: 'OWNER_IDENTITY_REQUIRED' }, 403);
    return json({
      ok: true,
      authority: 'SUPABASE_EDGE_VERIFIED_OWNER',
      roles: ['ADMIN'],
      auth_user_id: payload.sub,
      session_id: payload.session_id,
    });
  }
  return await capturedHandler!(req);
});

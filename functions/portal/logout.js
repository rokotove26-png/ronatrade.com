const SUPABASE_URL = 'https://sxawrwzeobaqwwmlkzws.supabase.co';

function cookieValue(request, name) {
  const raw = request.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return rest.join('=');
  }
  return null;
}

function clearCookie(name) {
  return `${name}=; Path=/portal; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function securityHeaders() {
  return {
    'cache-control': 'private, no-store',
    'pragma': 'no-cache',
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'content-security-policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  };
}

function sameOrigin(request) {
  const url = new URL(request.url);
  const origin = request.headers.get('origin');
  if (origin) return origin === url.origin;
  const ref = request.headers.get('referer');
  if (!ref) return false;
  try { return new URL(ref).origin === url.origin; } catch { return false; }
}

function clearedResponse(status, location = null) {
  const h = new Headers(securityHeaders());
  h.append('set-cookie', clearCookie('rona_portal_at'));
  h.append('set-cookie', clearCookie('rona_portal_rt'));
  if (location) h.set('location', location);
  return new Response(null, { status, headers: h });
}

export async function onRequestPost(context) {
  if (!sameOrigin(context.request)) return clearedResponse(403);
  const accessToken = cookieValue(context.request, 'rona_portal_at');
  if (accessToken) {
    const headers = { Authorization: `Bearer ${accessToken}` };
    const publishable = context.env.SUPABASE_PUBLISHABLE_KEY || context.env.SUPABASE_ANON_KEY || '';
    if (publishable) headers.apikey = publishable;
    try {
      await fetch(`${SUPABASE_URL}/auth/v1/logout?scope=local`, {
        method: 'POST',
        headers,
      });
    } catch (_) {}
  }
  return clearedResponse(303, 'https://ronaoil.com');
}

export function onRequestGet() {
  return Response.redirect('https://ronaoil.com', 303);
}

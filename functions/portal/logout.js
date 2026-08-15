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
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'content-security-policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  };
}

export async function onRequestPost(context) {
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
    } catch (_) {
      // Cookie invalidation remains mandatory even if upstream logout is temporarily unreachable.
    }
  }
  const h = new Headers(securityHeaders());
  h.append('set-cookie', clearCookie('rona_portal_at'));
  h.append('set-cookie', clearCookie('rona_portal_rt'));
  h.set('location', '/portal/login');
  return new Response(null, { status: 303, headers: h });
}

export function onRequestGet() {
  return Response.redirect('/portal/login', 303);
}

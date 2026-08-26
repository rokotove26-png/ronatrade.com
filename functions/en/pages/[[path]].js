class RealAuthHeadInjector {
  element(element) {
    element.prepend('<script id="rona-g82-real-auth-entry-loader-v1" src="/assets/g82/portal-real-auth-entry-v1.js" defer></script><script id="rona-g82-inline-auth-loader-v2" src="/assets/g82/portal-home-inline-auth-v2.js" defer></script>', { html: true });
  }
}

const HOME = new Set(['/en/pages/home_large','/en/pages/home_large.html','/en/pages/home_compact','/en/pages/home_compact.html']);

export async function onRequest(context) {
  const { request, env } = context;
  const response = await env.ASSETS.fetch(request);
  if (request.method !== 'GET' || !HOME.has(new URL(request.url).pathname)) return response;
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok || !contentType.toLowerCase().includes('text/html')) return response;
  const transformed = new HTMLRewriter().on('head', new RealAuthHeadInjector()).transform(response);
  const headers = new Headers(transformed.headers);
  headers.delete('content-length');
  headers.delete('etag');
  headers.set('cache-control', 'no-cache, no-store, must-revalidate');
  headers.set('x-rona-real-auth-entry', 'g8.2-production-login-fix-v1');
  headers.set('x-rona-inline-auth-entry', 'g8.2-inline-auth-v2');
  return new Response(transformed.body, { status: transformed.status, statusText: transformed.statusText, headers });
}

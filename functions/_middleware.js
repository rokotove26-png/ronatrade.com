const FORM_TRANSPORT_MAP = Object.freeze({
  'https://formsubmit.co/ajax/office_kg@ronaoil.com': '/api/forms/trade',
  'https://formsubmit.co/ajax/rokotove26@gmail.com': '/api/forms/investments'
});

const FORM_PAGES = new Set([
  '/pages/home_large.html',
  '/pages/home_compact.html',
  '/en/pages/home_large.html',
  '/en/pages/home_compact.html',
  '/investments/home.html',
  '/en/investments/home.html'
]);

const BRIDGE_SCRIPT = `<script id="rona-controlled-form-transport-v1-1">
(()=>{
  'use strict';
  if(window.__RONA_CONTROLLED_FORM_TRANSPORT__) return;
  window.__RONA_CONTROLLED_FORM_TRANSPORT__ = true;

  const MAP = Object.freeze({
    'https://formsubmit.co/ajax/office_kg@ronaoil.com':'/api/forms/trade',
    'https://formsubmit.co/ajax/rokotove26@gmail.com':'/api/forms/investments'
  });

  function rawUrl(input){
    if(typeof input === 'string') return input;
    if(input instanceof URL) return input.href;
    return input && typeof input.url === 'string' ? input.url : '';
  }

  function absoluteTarget(target){
    return new URL(target, window.location.origin).href;
  }

  function remapInput(input){
    const target = MAP[rawUrl(input)];
    if(!target) return input;
    const url = absoluteTarget(target);
    return input instanceof Request ? new Request(url, input) : url;
  }

  const parentFetch = window.fetch.bind(window);
  window.fetch = (input, init) => parentFetch(remapInput(input), init);

  try {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'srcdoc');
    if(descriptor && descriptor.get && descriptor.set && descriptor.configurable){
      Object.defineProperty(HTMLIFrameElement.prototype, 'srcdoc', {
        configurable: descriptor.configurable,
        enumerable: descriptor.enumerable,
        get: descriptor.get,
        set(value){
          if(typeof value === 'string'){
            for(const [from, to] of Object.entries(MAP)){
              value = value.split(from).join(absoluteTarget(to));
            }
          }
          return descriptor.set.call(this, value);
        }
      });
    }
  } catch (_) {}

  function patchFrame(frame){
    try {
      const w = frame && frame.contentWindow;
      if(!w || w.__RONA_CONTROLLED_FORM_TRANSPORT__) return;
      const frameFetch = w.fetch.bind(w);
      w.fetch = (input, init) => {
        const target = MAP[rawUrl(input)];
        if(!target) return frameFetch(input, init);
        const url = absoluteTarget(target);
        const nextInput = input instanceof w.Request ? new w.Request(url, input) : url;
        return frameFetch(nextInput, init);
      };
      w.__RONA_CONTROLLED_FORM_TRANSPORT__ = true;
    } catch (_) {}
  }

  function installFrameBridges(){
    document.querySelectorAll('iframe').forEach(frame => {
      frame.addEventListener('load', () => patchFrame(frame));
      patchFrame(frame);
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', installFrameBridges, { once:true });
  } else {
    installFrameBridges();
  }
})();
</script>`;

class HeadInjector {
  element(element) {
    element.prepend(BRIDGE_SCRIPT, { html: true });
  }
}

export async function onRequest(context) {
  const { request } = context;
  if (request.method !== 'GET') return context.next();

  const pathname = new URL(request.url).pathname;
  if (!FORM_PAGES.has(pathname)) return context.next();

  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok || !contentType.toLowerCase().includes('text/html')) return response;

  const transformed = new HTMLRewriter()
    .on('head', new HeadInjector())
    .transform(response);

  const headers = new Headers(transformed.headers);
  headers.delete('content-length');
  headers.delete('etag');
  headers.set('x-rona-form-transport', 'controlled-v1.1');

  return new Response(transformed.body, {
    status: transformed.status,
    statusText: transformed.statusText,
    headers
  });
}

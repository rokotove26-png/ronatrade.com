// @ts-nocheck
// Slug-agnostic entrypoint for rona-owner-ai-sync.
// The runtime implementation is preserved in runtime.ts; this entrypoint normalizes
// only the two public sync routes before the registered handler sees the request.

const nativeServe = Deno.serve.bind(Deno);
let runtimeHandler = null;

function normalizeAiSyncPath(pathname) {
  const p = String(pathname || '');
  if (p.endsWith('/admin/sync')) return '/admin/sync';
  if (p.endsWith('/agent/sync')) return '/agent/sync';
  return p;
}

const capturedServe = (...args) => {
  const handler = typeof args[0] === 'function' ? args[0] : args[1];
  if (typeof handler !== 'function') throw new Error('AI_SYNC_HANDLER_CAPTURE_FAILED');
  runtimeHandler = handler;
  return {
    finished: Promise.resolve(),
    ref() {},
    unref() {},
    shutdown() { return Promise.resolve(); },
    addr: { transport: 'tcp', hostname: '0.0.0.0', port: 0 },
  };
};

const serveDescriptor = Object.getOwnPropertyDescriptor(Deno, 'serve');
Object.defineProperty(Deno, 'serve', { value: capturedServe, configurable: true, writable: true });
await import('./runtime.ts');
if (serveDescriptor) Object.defineProperty(Deno, 'serve', serveDescriptor);
else Object.defineProperty(Deno, 'serve', { value: nativeServe, configurable: true, writable: true });
if (typeof runtimeHandler !== 'function') throw new Error('AI_SYNC_HANDLER_NOT_REGISTERED');

nativeServe(async (req) => {
  const url = new URL(req.url);
  const normalizedPath = normalizeAiSyncPath(url.pathname);
  if (normalizedPath !== url.pathname) url.pathname = normalizedPath;
  const init = { method: req.method, headers: req.headers, redirect: req.redirect, signal: req.signal };
  if (req.method !== 'GET' && req.method !== 'HEAD') init.body = req.body;
  return runtimeHandler(new Request(url.toString(), init));
});

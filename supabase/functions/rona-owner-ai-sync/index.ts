// @ts-nocheck
// Slug-agnostic entrypoint for rona-owner-ai-sync.
// Runtime business reads remain in runtime.ts. Owner Payments V3 enriches only the
// authenticated Admin read model and performs no business-data mutation.

import postgres from 'postgres';
import { enrichOwnerPaymentsSemanticsV3 } from './owner-payments-semantics-v3.ts';

const nativeServe = Deno.serve.bind(Deno);
const DB = Deno.env.get('SUPABASE_DB_URL');
const v3sql = DB ? postgres(DB,{prepare:false,max:1,idle_timeout:1,max_lifetime:30,connect_timeout:5}) : null;
let runtimeHandler = null;

function normalizeAiSyncPath(pathname) {
  const p = String(pathname || '');
  if (/\/admin\/sync\/?$/.test(p)) return '/admin/sync';
  if (/\/agent\/sync\/?$/.test(p)) return '/agent/sync';
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
  const response = await runtimeHandler(new Request(url.toString(), init));
  if (normalizedPath !== '/admin/sync' || !response.ok || !v3sql) return response;
  const payload = await response.json().catch(()=>null);
  if (!payload?.data?.financeFragment) return new Response(JSON.stringify({ok:false,code:'OWNER_PAYMENTS_V3_FINANCE_FRAGMENT_MISSING'}),{status:502,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
  payload.data.financeFragment = await enrichOwnerPaymentsSemanticsV3(payload.data.financeFragment,v3sql);
  const headers = new Headers(response.headers);
  headers.set('content-type','application/json; charset=utf-8');
  headers.set('cache-control','no-store');
  headers.set('x-rona-owner-payments-semantics','ADMIN_PAYMENTS_OWNER_SEMANTICS_V3');
  headers.delete('content-length');
  return new Response(JSON.stringify(payload),{status:response.status,statusText:response.statusText,headers});
});
